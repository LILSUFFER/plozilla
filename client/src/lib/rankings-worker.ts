interface WasmExports {
  init(): void;
  eval5(c0: number, c1: number, c2: number, c3: number, c4: number): number;
  setPlayerHand(playerIdx: number, idx: number, card: number): void;
  setPlayerLen(playerIdx: number, len: number): void;
  setNumPlayers(n: number): void;
  buildDeck(usedMaskLow: number, usedMaskHigh: number): void;
  setSeed(s: number): void;
  setHandRank(index: number, rank: number): void;
  markTableLoaded(): void;
  isTableLoaded(): boolean;
  calculateVsRandom(numTrials: number): number;
  getWins(playerIdx: number): number;
  getTies(playerIdx: number): number;
  memory: WebAssembly.Memory;
}

const TABLE_SIZE = 2598960;
const TOTAL_HANDS = 2598960;

async function loadWasmInWorker(): Promise<WasmExports> {
  const response = await fetch('/evaluator.wasm');
  const bytes = await response.arrayBuffer();
  const module = await WebAssembly.instantiate(bytes, {
    env: {
      abort: () => {},
      seed: () => Date.now()
    }
  });

  const wasm = module.instance.exports as unknown as WasmExports;
  wasm.init();

  const tableResponse = await fetch('/hand-ranks.bin');
  if (tableResponse.ok) {
    const buffer = await tableResponse.arrayBuffer();
    const data = new Uint32Array(buffer);
    if (data.length === TABLE_SIZE) {
      for (let i = 0; i < TABLE_SIZE; i++) {
        wasm.setHandRank(i, data[i]);
      }
      wasm.markTableLoaded();
    }
  }

  return wasm;
}

export interface WorkerMessage {
  type: 'compute';
  trialsPerHand: number;
}

export type WorkerResponse =
  | { type: 'status'; message: string }
  | { type: 'progress'; current: number; total: number }
  | { type: 'complete'; cards: ArrayBuffer; equities: ArrayBuffer; sortOrder: ArrayBuffer };

const post = (msg: WorkerResponse, transfer?: Transferable[]) => {
  (self as unknown as { postMessage(msg: WorkerResponse, transfer?: Transferable[]): void }).postMessage(msg, transfer || []);
};

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  if (e.data.type !== 'compute') return;

  const { trialsPerHand } = e.data;

  post({ type: 'status', message: 'loading' });
  const wasm = await loadWasmInWorker();

  post({ type: 'status', message: 'computing' });

  wasm.setNumPlayers(1);
  wasm.setPlayerLen(0, 5);
  wasm.setSeed(Date.now() & 0xFFFFFFFF);

  const equities = new Float32Array(TOTAL_HANDS);
  const cards = new Uint8Array(TOTAL_HANDS * 5);

  let handIdx = 0;
  for (let c0 = 0; c0 < 48; c0++) {
    for (let c1 = c0 + 1; c1 < 49; c1++) {
      for (let c2 = c1 + 1; c2 < 50; c2++) {
        for (let c3 = c2 + 1; c3 < 51; c3++) {
          for (let c4 = c3 + 1; c4 < 52; c4++) {
            const base = handIdx * 5;
            cards[base] = c0;
            cards[base + 1] = c1;
            cards[base + 2] = c2;
            cards[base + 3] = c3;
            cards[base + 4] = c4;

            wasm.setPlayerHand(0, 0, c0);
            wasm.setPlayerHand(0, 1, c1);
            wasm.setPlayerHand(0, 2, c2);
            wasm.setPlayerHand(0, 3, c3);
            wasm.setPlayerHand(0, 4, c4);

            let usedLow = 0;
            let usedHigh = 0;
            if (c0 < 32) usedLow |= 1 << c0; else usedHigh |= 1 << (c0 - 32);
            if (c1 < 32) usedLow |= 1 << c1; else usedHigh |= 1 << (c1 - 32);
            if (c2 < 32) usedLow |= 1 << c2; else usedHigh |= 1 << (c2 - 32);
            if (c3 < 32) usedLow |= 1 << c3; else usedHigh |= 1 << (c3 - 32);
            if (c4 < 32) usedLow |= 1 << c4; else usedHigh |= 1 << (c4 - 32);

            wasm.buildDeck(usedLow, usedHigh);
            wasm.calculateVsRandom(trialsPerHand);

            const w = wasm.getWins(0);
            const t = wasm.getTies(0);
            equities[handIdx] = (w + t / 2) / trialsPerHand * 100;

            handIdx++;
          }
        }
      }

      if (handIdx % 10000 < 10) {
        post({ type: 'progress', current: handIdx, total: TOTAL_HANDS });
      }
    }
  }

  post({ type: 'progress', current: TOTAL_HANDS, total: TOTAL_HANDS });

  const sortOrder = new Uint32Array(TOTAL_HANDS);
  for (let i = 0; i < TOTAL_HANDS; i++) sortOrder[i] = i;
  sortOrder.sort((a, b) => equities[b] - equities[a]);

  const cBuf = cards.buffer;
  const eBuf = equities.buffer;
  const sBuf = sortOrder.buffer;
  post(
    { type: 'complete', cards: cBuf, equities: eBuf, sortOrder: sBuf },
    [cBuf, eBuf, sBuf]
  );
};
