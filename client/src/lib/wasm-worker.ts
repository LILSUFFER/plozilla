// WASM-based equity calculation worker with range support
// Uses the same WASM module as main thread but runs in parallel

let wasmModule: WebAssembly.Instance | null = null;
let handRanksLoaded = false;

interface WasmExports {
  init(): void;
  setHandRank(index: number, rank: number): void;
  markTableLoaded(): void;
  isTableLoaded(): boolean;
  setNumPlayers(n: number): void;
  setPlayerHand(playerIdx: number, idx: number, card: number): void;
  setPlayerLen(playerIdx: number, len: number): void;
  setBoardCard(idx: number, card: number): void;
  setBoardLen(len: number): void;
  buildDeck(usedLow: number, usedHigh: number): void;
  calculateExhaustive(): number;
  calculateExhaustiveRange(startC0: number, endC0: number): number;
  getMaxC0(): number;
  getWins(playerIdx: number): number;
  getTies(playerIdx: number): number;
}

async function initWasm(wasmBytes: ArrayBuffer, rankBytes: ArrayBuffer): Promise<void> {
  const result = await WebAssembly.instantiate(wasmBytes);
  wasmModule = result.instance;
  const exports = wasmModule.exports as unknown as WasmExports;
  
  exports.init();
  
  // Load hand ranks
  const ranks = new Uint32Array(rankBytes);
  for (let i = 0; i < ranks.length; i++) {
    exports.setHandRank(i, ranks[i]);
  }
  exports.markTableLoaded();
  handRanksLoaded = true;
}

function calculate(
  playerHands: number[][],
  boardCards: number[],
  startC0: number,
  endC0: number
): { wins: number[], ties: number[], runouts: number, maxC0: number } {
  if (!wasmModule || !handRanksLoaded) {
    return { wins: [], ties: [], runouts: 0, maxC0: 0 };
  }
  
  const exports = wasmModule.exports as unknown as WasmExports;
  const np = playerHands.length;
  
  // Set players
  exports.setNumPlayers(np);
  for (let p = 0; p < np; p++) {
    const hand = playerHands[p];
    exports.setPlayerLen(p, hand.length);
    for (let i = 0; i < hand.length; i++) {
      exports.setPlayerHand(p, i, hand[i]);
    }
  }
  
  // Set board
  exports.setBoardLen(boardCards.length);
  for (let i = 0; i < boardCards.length; i++) {
    exports.setBoardCard(i, boardCards[i]);
  }
  
  // Build deck (usedLow/usedHigh bitmasks)
  let usedLow = 0;
  let usedHigh = 0;
  for (const hand of playerHands) {
    for (const card of hand) {
      if (card < 32) usedLow |= (1 << card);
      else usedHigh |= (1 << (card - 32));
    }
  }
  for (const card of boardCards) {
    if (card < 32) usedLow |= (1 << card);
    else usedHigh |= (1 << (card - 32));
  }
  exports.buildDeck(usedLow, usedHigh);
  
  const maxC0 = exports.getMaxC0();
  
  // Use range-based calculation for preflop (cn===5)
  let runouts: number;
  if (boardCards.length === 0 && startC0 >= 0 && endC0 > startC0) {
    runouts = exports.calculateExhaustiveRange(startC0, endC0);
  } else {
    runouts = exports.calculateExhaustive();
  }
  
  // Get results
  const wins: number[] = [];
  const ties: number[] = [];
  for (let p = 0; p < np; p++) {
    wins.push(exports.getWins(p));
    ties.push(exports.getTies(p));
  }
  
  return { wins, ties, runouts, maxC0 };
}

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data;
  
  if (msg.type === 'init') {
    try {
      await initWasm(msg.wasmBytes, msg.rankBytes);
      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'error', error: String(err) });
    }
  } else if (msg.type === 'calculate') {
    const result = calculate(
      msg.playerHands,
      msg.boardCards,
      msg.startC0 ?? 0,
      msg.endC0 ?? 999
    );
    self.postMessage({ type: 'result', ...result });
  }
};
