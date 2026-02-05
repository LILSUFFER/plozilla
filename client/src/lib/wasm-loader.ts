// WASM Poker Evaluator Loader

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
  getWins(playerIdx: number): number;
  getTies(playerIdx: number): number;
  memory: WebAssembly.Memory;
}

let wasmInstance: WasmExports | null = null;
let wasmLoading: Promise<WasmExports> | null = null;

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
    return wasmInstance;
  })();
  
  return wasmLoading;
}

export function getWasm(): WasmExports | null {
  return wasmInstance;
}
