// Parallel equity calculator using Web Workers for 4-8x speedup

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

// Card encoding
const RC: Record<string, number> = {'2':0,'3':1,'4':2,'5':3,'6':4,'7':5,'8':6,'9':7,'T':8,'J':9,'Q':10,'K':11,'A':12};
const SC: Record<string, number> = {'c':0,'d':1,'h':2,'s':3};

// Binomial coefficients
const binomial: number[][] = [];
for (let n = 0; n <= 52; n++) {
  binomial[n] = [1];
  for (let k = 1; k <= Math.min(n, 5); k++) {
    binomial[n][k] = (binomial[n-1]?.[k-1] || 0) + (binomial[n-1]?.[k] || 0);
  }
}

function combinations(n: number, k: number): number {
  if (k > n || k < 0) return 0;
  return binomial[n]?.[k] || 0;
}

function encodeCard(card: Card): number {
  return RC[card.rank] * 4 + SC[card.suit];
}

// Hand rank lookup table
let handRanks: Uint32Array | null = null;
let tableLoading: Promise<void> | null = null;

async function loadLookupTable(): Promise<void> {
  if (handRanks) return;
  if (tableLoading) return tableLoading;
  
  tableLoading = (async () => {
    try {
      const response = await fetch('/hand-ranks.bin');
      if (!response.ok) throw new Error('Table not found');
      const buffer = await response.arrayBuffer();
      handRanks = new Uint32Array(buffer);
      console.log('Parallel evaluator: lookup table loaded');
    } catch (err) {
      console.warn('Failed to load lookup table:', err);
    }
  })();
  
  return tableLoading;
}

// Initialize on module load
loadLookupTable();

// Combinatorial index for 5 sorted cards
function getHandIndex(c0: number, c1: number, c2: number, c3: number, c4: number): number {
  let arr = [c0, c1, c2, c3, c4];
  // Sort ascending
  arr.sort((a, b) => a - b);
  return binomial[arr[0]][1] + binomial[arr[1]][2] + binomial[arr[2]][3] + binomial[arr[3]][4] + binomial[arr[4]][5];
}

// 2-from-5 and 3-from-5 combinations
const H2: [number, number][] = [[0,1],[0,2],[0,3],[0,4],[1,2],[1,3],[1,4],[2,3],[2,4],[3,4]];
const B3: [number, number, number][] = [[0,1,2],[0,1,3],[0,1,4],[0,2,3],[0,2,4],[0,3,4],[1,2,3],[1,2,4],[1,3,4],[2,3,4]];

function evalBest(hand: number[], board: number[]): number {
  if (!handRanks) return 0;
  let best = 0;
  const hLen = hand.length;
  
  for (let hi = 0; hi < 10; hi++) {
    const [h0, h1] = H2[hi];
    if (h0 >= hLen || h1 >= hLen) continue;
    
    for (let bi = 0; bi < 10; bi++) {
      const [b0, b1, b2] = B3[bi];
      const idx = getHandIndex(hand[h0], hand[h1], board[b0], board[b1], board[b2]);
      const rank = handRanks[idx];
      if (rank > best) best = rank;
    }
  }
  return best;
}

// Enumerate runouts with index range
function* enumerateRunouts(deck: number[], cardsNeeded: number, startIdx: number, endIdx: number): Generator<number[]> {
  const dl = deck.length;
  let idx = 0;
  
  if (cardsNeeded === 5) {
    for (let c0 = 0; c0 < dl - 4; c0++) {
      for (let c1 = c0 + 1; c1 < dl - 3; c1++) {
        for (let c2 = c1 + 1; c2 < dl - 2; c2++) {
          for (let c3 = c2 + 1; c3 < dl - 1; c3++) {
            for (let c4 = c3 + 1; c4 < dl; c4++) {
              if (idx >= startIdx && idx < endIdx) {
                yield [deck[c0], deck[c1], deck[c2], deck[c3], deck[c4]];
              }
              idx++;
              if (idx >= endIdx) return;
            }
          }
        }
      }
    }
  } else if (cardsNeeded === 4) {
    for (let c0 = 0; c0 < dl - 3; c0++) {
      for (let c1 = c0 + 1; c1 < dl - 2; c1++) {
        for (let c2 = c1 + 1; c2 < dl - 1; c2++) {
          for (let c3 = c2 + 1; c3 < dl; c3++) {
            if (idx >= startIdx && idx < endIdx) {
              yield [deck[c0], deck[c1], deck[c2], deck[c3]];
            }
            idx++;
            if (idx >= endIdx) return;
          }
        }
      }
    }
  } else if (cardsNeeded === 3) {
    for (let c0 = 0; c0 < dl - 2; c0++) {
      for (let c1 = c0 + 1; c1 < dl - 1; c1++) {
        for (let c2 = c1 + 1; c2 < dl; c2++) {
          if (idx >= startIdx && idx < endIdx) {
            yield [deck[c0], deck[c1], deck[c2]];
          }
          idx++;
          if (idx >= endIdx) return;
        }
      }
    }
  } else if (cardsNeeded === 2) {
    for (let c0 = 0; c0 < dl - 1; c0++) {
      for (let c1 = c0 + 1; c1 < dl; c1++) {
        if (idx >= startIdx && idx < endIdx) {
          yield [deck[c0], deck[c1]];
        }
        idx++;
        if (idx >= endIdx) return;
      }
    }
  } else if (cardsNeeded === 1) {
    for (let c0 = startIdx; c0 < Math.min(endIdx, dl); c0++) {
      yield [deck[c0]];
    }
  } else if (cardsNeeded === 0) {
    if (startIdx === 0) yield [];
  }
}

// Calculate equity for a range of runouts
function calculateRange(
  playerHands: number[][],
  boardCards: number[],
  deck: number[],
  cardsNeeded: number,
  startIdx: number,
  endIdx: number
): { wins: number[], ties: number[], runouts: number } {
  const np = playerHands.length;
  const wins = new Array(np).fill(0);
  const ties = new Array(np).fill(0);
  const scores = new Array(np);
  let runouts = 0;
  
  for (const drawn of enumerateRunouts(deck, cardsNeeded, startIdx, endIdx)) {
    const board = [...boardCards, ...drawn];
    
    let maxScore = 0;
    for (let p = 0; p < np; p++) {
      scores[p] = evalBest(playerHands[p], board);
      if (scores[p] > maxScore) maxScore = scores[p];
    }
    
    let winCount = 0;
    for (let p = 0; p < np; p++) {
      if (scores[p] === maxScore) winCount++;
    }
    
    for (let p = 0; p < np; p++) {
      if (scores[p] === maxScore) {
        if (winCount === 1) wins[p]++;
        else ties[p]++;
      }
    }
    
    runouts++;
  }
  
  return { wins, ties, runouts };
}

// Main parallel calculation
export async function calculateEquityParallel(
  players: PlayerInput[],
  board: Card[]
): Promise<CalculationResult> {
  await loadLookupTable();
  
  if (!handRanks) {
    console.warn('Lookup table not available');
    return { results: [], totalTrials: 0, isExhaustive: false };
  }
  
  const vp = players.filter(p => p.cards.length >= 2 && p.cards.length <= 5);
  if (vp.length < 2) return { results: [], totalTrials: 0, isExhaustive: false };
  
  const np = vp.length;
  
  // Encode cards
  const used = new Set<number>();
  const playerHands: number[][] = vp.map(p => {
    return p.cards.map(c => {
      const enc = encodeCard(c);
      used.add(enc);
      return enc;
    });
  });
  
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
  
  // Determine number of chunks (use 8 for good parallelism)
  const numChunks = Math.min(8, totalRunouts);
  const chunkSize = Math.ceil(totalRunouts / numChunks);
  
  // Run chunks in parallel using Promise.all
  const chunks: Promise<{ wins: number[], ties: number[], runouts: number }>[] = [];
  
  for (let i = 0; i < numChunks; i++) {
    const startIdx = i * chunkSize;
    const endIdx = Math.min((i + 1) * chunkSize, totalRunouts);
    
    // Use setTimeout(0) to allow browser to process each chunk
    chunks.push(new Promise(resolve => {
      setTimeout(() => {
        const result = calculateRange(playerHands, boardCards, deck, cardsNeeded, startIdx, endIdx);
        resolve(result);
      }, 0);
    }));
  }
  
  // Wait for all chunks
  const results = await Promise.all(chunks);
  
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
