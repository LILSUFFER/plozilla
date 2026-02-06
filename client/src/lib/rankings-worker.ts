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

export interface HandGroupData {
  encodedCards: number[];
}

export interface WorkerMessage {
  type: 'compute';
  hands: HandGroupData[];
  samplesPerHand: number;
}

export interface WorkerProgress {
  type: 'progress';
  current: number;
  total: number;
}

export interface WorkerComplete {
  type: 'complete';
  equities: number[];
}

export interface WorkerStatus {
  type: 'status';
  message: string;
}

export type WorkerResponse = WorkerProgress | WorkerComplete | WorkerStatus;

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  if (e.data.type === 'compute') {
    const { hands, samplesPerHand } = e.data;

    (self as unknown as { postMessage(msg: WorkerResponse): void }).postMessage({ type: 'status', message: 'loading' });
    const wasm = await loadWasmInWorker();

    (self as unknown as { postMessage(msg: WorkerResponse): void }).postMessage({ type: 'status', message: 'computing' });

    wasm.setNumPlayers(1);
    wasm.setPlayerLen(0, 5);
    wasm.setSeed(Date.now() & 0xFFFFFFFF);

    const equities: number[] = new Array(hands.length);
    const totalGroups = hands.length;

    for (let gi = 0; gi < totalGroups; gi++) {
      const cards = hands[gi].encodedCards;

      for (let i = 0; i < 5; i++) {
        wasm.setPlayerHand(0, i, cards[i]);
      }

      let usedLow = 0;
      let usedHigh = 0;
      for (let i = 0; i < 5; i++) {
        const c = cards[i];
        if (c < 32) usedLow |= 1 << c;
        else usedHigh |= 1 << (c - 32);
      }
      wasm.buildDeck(usedLow, usedHigh);

      wasm.calculateVsRandom(samplesPerHand);
      const w = wasm.getWins(0);
      const t = wasm.getTies(0);
      equities[gi] = (w + t / 2) / samplesPerHand * 100;

      if (gi % 200 === 0 || gi === totalGroups - 1) {
        (self as unknown as { postMessage(msg: WorkerResponse): void }).postMessage({
          type: 'progress',
          current: gi + 1,
          total: totalGroups,
        });
      }
    }

    (self as unknown as { postMessage(msg: WorkerResponse): void }).postMessage({
      type: 'complete',
      equities,
    });
  }
};
