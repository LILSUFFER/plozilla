// Parallel equity calculation with WASM workers

import type { Card } from './poker-evaluator';
import type { PlayerInput, CalculationResult, EquityResult } from './equity-calculator';

const NUM_WORKERS = Math.min(navigator.hardwareConcurrency || 4, 8);

interface WasmWorkerResult {
  wins: number[];
  ties: number[];
  runouts: number;
}

let workers: Worker[] = [];
let wasmBytes: ArrayBuffer | null = null;
let rankBytes: ArrayBuffer | null = null;
let workersReady = false;
let initPromise: Promise<void> | null = null;

async function loadResources(): Promise<void> {
  const [wasmResp, rankResp] = await Promise.all([
    fetch('/evaluator.wasm'),
    fetch('/hand-ranks.bin')
  ]);
  wasmBytes = await wasmResp.arrayBuffer();
  rankBytes = await rankResp.arrayBuffer();
}

async function initWorkerPool(): Promise<void> {
  if (workersReady) return;
  if (initPromise) return initPromise;
  
  initPromise = (async () => {
    console.log(`Initializing ${NUM_WORKERS} WASM workers...`);
    await loadResources();
    
    workers = [];
    const promises: Promise<void>[] = [];
    
    for (let i = 0; i < NUM_WORKERS; i++) {
      const worker = new Worker(
        new URL('./wasm-worker.ts', import.meta.url),
        { type: 'module' }
      );
      workers.push(worker);
      
      promises.push(new Promise((resolve, reject) => {
        const handler = (e: MessageEvent) => {
          if (e.data.type === 'ready') {
            worker.removeEventListener('message', handler);
            resolve();
          } else if (e.data.type === 'error') {
            worker.removeEventListener('message', handler);
            reject(new Error(e.data.error));
          }
        };
        worker.addEventListener('message', handler);
        
        // Clone bytes for each worker
        worker.postMessage({
          type: 'init',
          wasmBytes: wasmBytes!.slice(0),
          rankBytes: rankBytes!.slice(0)
        });
      }));
    }
    
    await Promise.all(promises);
    workersReady = true;
    console.log(`${NUM_WORKERS} WASM workers ready`);
  })();
  
  return initPromise;
}

const RC: Record<string, number> = {'2':0,'3':1,'4':2,'5':3,'6':4,'7':5,'8':6,'9':7,'10':8,'T':8,'J':9,'Q':10,'K':11,'A':12};
const SC: Record<string, number> = {'c':0,'d':1,'h':2,'s':3};

function encodeCard(card: Card): number {
  const rankIdx = RC[card.rank] ?? RC['T'];
  const suitIdx = SC[card.suit] ?? 0;
  return rankIdx * 4 + suitIdx;
}

export async function calculateEquityParallelWasm(
  players: PlayerInput[],
  board: Card[]
): Promise<CalculationResult> {
  await initWorkerPool();
  
  const validPlayers = players.filter(p => p.cards.length >= 2 && p.cards.length <= 5);
  if (validPlayers.length < 2) {
    return { results: [], totalTrials: 0, isExhaustive: false };
  }
  
  const playerHands = validPlayers.map(p => p.cards.map(encodeCard));
  const boardCards = board.map(encodeCard);
  
  // For preflop (no board), split work among workers by first loop variable
  // For other cases, just use single worker
  const isPreflop = boardCards.length === 0;
  const np = playerHands.length;
  
  if (isPreflop) {
    // First get maxC0 from one worker
    const probeResult = await new Promise<{maxC0: number}>((resolve) => {
      const handler = (e: MessageEvent) => {
        if (e.data.type === 'result') {
          workers[0].removeEventListener('message', handler);
          resolve({ maxC0: e.data.maxC0 });
        }
      };
      workers[0].addEventListener('message', handler);
      workers[0].postMessage({
        type: 'calculate',
        playerHands,
        boardCards,
        startC0: 0,
        endC0: 1 // Just one iteration to get maxC0
      });
    });
    
    const maxC0 = probeResult.maxC0;
    const numWorkers = workers.length;
    const chunkSize = Math.ceil(maxC0 / numWorkers);
    
    // Run all workers in parallel
    const promises = workers.map((w, i) => {
      const startC0 = i * chunkSize;
      const endC0 = Math.min((i + 1) * chunkSize, maxC0);
      if (startC0 >= maxC0) return Promise.resolve({ wins: Array(np).fill(0), ties: Array(np).fill(0), runouts: 0 });
      
      return new Promise<{wins: number[], ties: number[], runouts: number}>((resolve) => {
        const handler = (e: MessageEvent) => {
          if (e.data.type === 'result') {
            w.removeEventListener('message', handler);
            resolve({ wins: e.data.wins, ties: e.data.ties, runouts: e.data.runouts });
          }
        };
        w.addEventListener('message', handler);
        w.postMessage({ type: 'calculate', playerHands, boardCards, startC0, endC0 });
      });
    });
    
    const results = await Promise.all(promises);
    
    // Aggregate results
    const totalWins = Array(np).fill(0);
    const totalTies = Array(np).fill(0);
    let totalRunouts = 0;
    
    for (const r of results) {
      for (let p = 0; p < np; p++) {
        totalWins[p] += r.wins[p];
        totalTies[p] += r.ties[p];
      }
      totalRunouts += r.runouts;
    }
    
    const equityResults: EquityResult[] = validPlayers.map((p, i) => ({
      playerId: p.id,
      wins: totalWins[i],
      ties: totalTies[i],
      total: totalRunouts,
      equity: ((totalWins[i] + totalTies[i] / 2) / totalRunouts) * 100
    }));
    
    return {
      results: equityResults,
      totalTrials: totalRunouts,
      isExhaustive: true
    };
  }
  
  // Non-preflop: use single worker
  const result = await new Promise<WasmWorkerResult>((resolve) => {
    const handler = (e: MessageEvent) => {
      if (e.data.type === 'result') {
        workers[0].removeEventListener('message', handler);
        resolve({
          wins: e.data.wins,
          ties: e.data.ties,
          runouts: e.data.runouts
        });
      }
    };
    workers[0].addEventListener('message', handler);
    workers[0].postMessage({
      type: 'calculate',
      playerHands,
      boardCards,
      startC0: 0,
      endC0: 999
    });
  });
  
  const equityResults: EquityResult[] = validPlayers.map((p, i) => ({
    playerId: p.id,
    wins: result.wins[i],
    ties: result.ties[i],
    total: result.runouts,
    equity: ((result.wins[i] + result.ties[i] / 2) / result.runouts) * 100
  }));
  
  return {
    results: equityResults,
    totalTrials: result.runouts,
    isExhaustive: true
  };
}

// Start loading in background
initWorkerPool().catch(err => console.warn('Worker pool init failed:', err));
