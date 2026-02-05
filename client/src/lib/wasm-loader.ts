// WASM Poker Evaluator Loader with Two Plus Two Lookup Table

export interface WasmExports {
  init(): void;
  eval5(c0: number, c1: number, c2: number, c3: number, c4: number): number;
  setPlayerHand(playerIdx: number, idx: number, card: number): void;
  setPlayerLen(playerIdx: number, len: number): void;
  setNumPlayers(n: number): void;
  setBoardCard(idx: number, card: number): void;
  setBoardLen(len: number): void;
  buildDeck(usedMaskLow: number, usedMaskHigh: number): void;
  setSeed(s: number): void;
  calculate(numTrials: number): void;
  calculateExhaustive(): number;
  getDeckLen(): number;
  getWins(playerIdx: number): number;
  getTies(playerIdx: number): number;
  setHandRank(index: number, rank: number): void;
  markTableLoaded(): void;
  isTableLoaded(): boolean;
  memory: WebAssembly.Memory;
}

let wasmInstance: WasmExports | null = null;
let wasmLoading: Promise<WasmExports> | null = null;

const TABLE_SIZE = 2598960;

async function loadLookupTable(wasm: WasmExports): Promise<void> {
  console.log('Loading hand rank lookup table...');
  const startTime = performance.now();
  
  try {
    const response = await fetch('/hand-ranks.bin');
    if (!response.ok) {
      console.warn('Lookup table not found, using fallback evaluator');
      return;
    }
    
    const buffer = await response.arrayBuffer();
    const data = new Uint32Array(buffer);
    
    if (data.length !== TABLE_SIZE) {
      console.warn(`Lookup table size mismatch: expected ${TABLE_SIZE}, got ${data.length}`);
      return;
    }
    
    // Load table into WASM memory
    for (let i = 0; i < TABLE_SIZE; i++) {
      wasm.setHandRank(i, data[i]);
    }
    
    wasm.markTableLoaded();
    
    const elapsed = performance.now() - startTime;
    console.log(`Lookup table loaded in ${elapsed.toFixed(0)}ms (${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB)`);
  } catch (err) {
    console.warn('Failed to load lookup table:', err);
  }
}

export async function loadWasm(): Promise<WasmExports> {
  if (wasmInstance) return wasmInstance;
  
  if (wasmLoading) return wasmLoading;
  
  wasmLoading = (async () => {
    const response = await fetch('/evaluator.wasm');
    const bytes = await response.arrayBuffer();
    const module = await WebAssembly.instantiate(bytes, {
      env: {
        abort: () => console.error('WASM abort called'),
        seed: () => Date.now()
      }
    });
    
    wasmInstance = module.instance.exports as unknown as WasmExports;
    wasmInstance.init();
    
    // Load lookup table for O(1) hand evaluation
    await loadLookupTable(wasmInstance);
    
    return wasmInstance;
  })();
  
  return wasmLoading;
}

export function getWasm(): WasmExports | null {
  return wasmInstance;
}
