// Worker pool for parallel equity calculation

import type { Card } from './poker-evaluator';

export interface PlayerInput {
  id: number;
  cards: Card[];
  input: string;
}

export interface EquityResult {
  playerId: number;
  wins: number;
  ties: number;
  total: number;
  equity: number;
}

export interface CalculationResult {
  results: EquityResult[];
  totalTrials: number;
  isExhaustive: boolean;
}

const RC: Record<string, number> = {'2':0,'3':1,'4':2,'5':3,'6':4,'7':5,'8':6,'9':7,'T':8,'J':9,'Q':10,'K':11,'A':12};
const SC: Record<string, number> = {'c':0,'d':1,'h':2,'s':3};

const binomial: number[][] = [];
for (let n = 0; n <= 52; n++) {
  binomial[n] = [1];
  for (let k = 1; k <= Math.min(n, 5); k++) {
    binomial[n][k] = (binomial[n-1]?.[k-1] || 0) + (binomial[n-1]?.[k] || 0);
  }
}

function combinations(n: number, k: number): number {
  return binomial[n]?.[k] || 0;
}

function encodeCard(card: Card): number {
  return RC[card.rank] * 4 + SC[card.suit];
}

// Number of workers (use available cores, max 8)
const NUM_WORKERS = Math.min(navigator.hardwareConcurrency || 4, 8);

let workers: Worker[] = [];
let tableBuffer: ArrayBuffer | null = null;
let workersReady = false;
let initPromise: Promise<void> | null = null;

async function initWorkers(): Promise<void> {
  if (workersReady) return;
  if (initPromise) return initPromise;
  
  initPromise = (async () => {
    // Load lookup table
    const response = await fetch('/hand-ranks.bin');
    tableBuffer = await response.arrayBuffer();
    
    // Create workers using inline blob
    const workerCode = await fetch('/src/lib/equity-worker-code.ts').then(r => r.text());
    
    // For Vite, we need to use dynamic import
    // Create workers using module type
    const workerPromises: Promise<void>[] = [];
    
    for (let i = 0; i < NUM_WORKERS; i++) {
      const worker = new Worker(
        new URL('./equity-worker-code.ts', import.meta.url),
        { type: 'module' }
      );
      
      workers.push(worker);
      
      workerPromises.push(new Promise<void>((resolve) => {
        worker.onmessage = (e) => {
          if (e.data.type === 'ready') resolve();
        };
        // Clone the buffer for each worker
        worker.postMessage({ 
          type: 'init', 
          tableBuffer: tableBuffer!.slice(0)
        });
      }));
    }
    
    await Promise.all(workerPromises);
    workersReady = true;
    console.log(`Worker pool initialized: ${NUM_WORKERS} workers`);
  })();
  
  return initPromise;
}

// Initialize on module load
initWorkers().catch(err => console.warn('Worker init failed:', err));

export async function calculateEquityParallel(
  players: PlayerInput[],
  board: Card[]
): Promise<CalculationResult> {
  await initWorkers();
  
  const vp = players.filter(p => p.cards.length >= 2 && p.cards.length <= 5);
  if (vp.length < 2) return { results: [], totalTrials: 0, isExhaustive: false };
  
  const np = vp.length;
  
  // Encode cards
  const used = new Set<number>();
  const playerHands = vp.map(p => p.cards.map(c => {
    const enc = encodeCard(c);
    used.add(enc);
    return enc;
  }));
  
  const boardCards = board.map(c => {
    const enc = encodeCard(c);
    used.add(enc);
    return enc;
  });
  
  // Build deck
  const deck: number[] = [];
  for (let i = 0; i < 52; i++) {
    if (!used.has(i)) deck.push(i);
  }
  
  const cardsNeeded = 5 - board.length;
  const totalRunouts = combinations(deck.length, cardsNeeded);
  
  if (totalRunouts === 0) {
    return { results: [], totalTrials: 0, isExhaustive: false };
  }
  
  // Split work among workers
  const chunkSize = Math.ceil(totalRunouts / workers.length);
  
  const resultPromises: Promise<{ wins: number[], ties: number[], runouts: number }>[] = [];
  
  for (let i = 0; i < workers.length; i++) {
    const startIdx = i * chunkSize;
    const endIdx = Math.min((i + 1) * chunkSize, totalRunouts);
    
    if (startIdx >= totalRunouts) break;
    
    resultPromises.push(new Promise((resolve) => {
      const handler = (e: MessageEvent) => {
        if (e.data.type === 'result') {
          workers[i].removeEventListener('message', handler);
          resolve({
            wins: e.data.wins,
            ties: e.data.ties,
            runouts: e.data.runouts
          });
        }
      };
      workers[i].addEventListener('message', handler);
      workers[i].postMessage({
        type: 'calculate',
        playerHands,
        boardCards,
        deck,
        cardsNeeded,
        startIdx,
        endIdx
      });
    }));
  }
  
  // Wait for all workers
  const results = await Promise.all(resultPromises);
  
  // Aggregate results
  const totalWins = new Array(np).fill(0);
  const totalTies = new Array(np).fill(0);
  let actualRunouts = 0;
  
  for (const r of results) {
    for (let p = 0; p < np; p++) {
      totalWins[p] += r.wins[p];
      totalTies[p] += r.ties[p];
    }
    actualRunouts += r.runouts;
  }
  
  return {
    results: vp.map((p, i) => ({
      playerId: p.id,
      wins: totalWins[i],
      ties: totalTies[i],
      total: actualRunouts,
      equity: ((totalWins[i] + totalTies[i] / 2) / actualRunouts) * 100
    })),
    totalTrials: actualRunouts,
    isExhaustive: true
  };
}
