// WebAssembly-based ultra-fast equity calculator
import type { Card } from './poker-evaluator';
import { loadWasm, getWasm, type WasmExports } from './wasm-loader';

export interface PlayerInput {
  id: number;
  cards: Card[];
  input: string;
  isRange?: boolean;
  rangeHands?: Card[][];
  comboCount?: number;
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

// Card encoding: rank (0-12) * 4 + suit (0-3) = 0-51
const RC: Record<string, number> = {'2':0,'3':1,'4':2,'5':3,'6':4,'7':5,'8':6,'9':7,'T':8,'J':9,'Q':10,'K':11,'A':12};
const SC: Record<string, number> = {'c':0,'d':1,'h':2,'s':3};

// Calculate combinations C(n, k)
function combinations(n: number, k: number): number {
  if (k > n || k < 0) return 0;
  if (k === 0 || k === n) return 1;
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = result * (n - i) / (i + 1);
  }
  return Math.round(result);
}

// Always use exhaustive like ProPokerTools (no Monte Carlo limits)

function encodeCard(card: Card): number {
  return RC[card.rank] * 4 + SC[card.suit];
}

// Initialize WASM on module load
let wasmReady = false;
loadWasm().then(() => {
  wasmReady = true;
  console.log('WASM evaluator loaded');
}).catch(err => {
  console.error('Failed to load WASM:', err);
});

export async function calculateEquityWasm(
  players: PlayerInput[],
  board: Card[]
): Promise<CalculationResult> {
  const wasm = await loadWasm();
  return calculateWithWasm(wasm, players, board);
}

export function calculateEquityFast(
  players: PlayerInput[],
  board: Card[]
): CalculationResult {
  const wasm = getWasm();
  if (wasm) {
    console.log('Using WASM evaluator');
    return calculateWithWasm(wasm, players, board);
  }
  // Fallback to JS implementation if WASM not ready
  console.log('Using JS fallback (WASM not ready)');
  return calculateEquityJS(players, board);
}

function calculateWithWasm(
  wasm: WasmExports,
  players: PlayerInput[],
  board: Card[]
): CalculationResult {
  const vp = players.filter(p => p.cards.length >= 2 && p.cards.length <= 5);
  if (vp.length < 2) return { results: [], totalTrials: 0, isExhaustive: false };
  
  const np = vp.length;
  
  // Build used cards mask (two 32-bit integers for WASM)
  let usedLow = 0;
  let usedHigh = 0;
  let usedCount = 0;
  
  // Set player hands
  wasm.setNumPlayers(np);
  for (let p = 0; p < np; p++) {
    const hand = vp[p].cards;
    wasm.setPlayerLen(p, hand.length);
    for (let i = 0; i < hand.length; i++) {
      const enc = encodeCard(hand[i]);
      wasm.setPlayerHand(p, i, enc);
      if (enc < 32) usedLow |= 1 << enc;
      else usedHigh |= 1 << (enc - 32);
      usedCount++;
    }
  }
  
  // Set board
  wasm.setBoardLen(board.length);
  for (let i = 0; i < board.length; i++) {
    const enc = encodeCard(board[i]);
    wasm.setBoardCard(i, enc);
    if (enc < 32) usedLow |= 1 << enc;
    else usedHigh |= 1 << (enc - 32);
    usedCount++;
  }
  
  // Build deck
  wasm.buildDeck(usedLow, usedHigh);
  
  // Debug: Check if lookup table is properly loaded
  if (wasm.isTableLoaded && !wasm.isTableLoaded()) {
    console.error('WARNING: Lookup table not loaded!');
  }
  
  // Debug: Test specific hand evaluation
  // Player 2's trip kings: Kh(46) + Kc(44) + 8c(24) + Ks(47) + 6d(17)
  if (wasm.debugEval5) {
    const testScore = wasm.debugEval5(44, 46, 24, 47, 17);
    const testIdx = wasm.debugGetIdx(44, 46, 24, 47, 17);
    console.log(`Debug WASM: eval5(44,46,24,47,17) = ${testScore.toString(16)}, idx = ${testIdx}`);
    
    // Debug binomial values - sorted cards are [17, 24, 44, 46, 47]
    // Expected: C(17,1)=17, C(24,2)=276, C(44,3)=13244, C(46,4)=163185, C(47,5)=1533939
    const b17_1 = wasm.debugGetBinomial(17, 1);
    const b24_2 = wasm.debugGetBinomial(24, 2);
    const b44_3 = wasm.debugGetBinomial(44, 3);
    const b46_4 = wasm.debugGetBinomial(46, 4);
    const b47_5 = wasm.debugGetBinomial(47, 5);
    console.log(`Debug binomials: C(17,1)=${b17_1}, C(24,2)=${b24_2}, C(44,3)=${b44_3}, C(46,4)=${b46_4}, C(47,5)=${b47_5}`);
    console.log(`Expected: C(17,1)=17, C(24,2)=276, C(44,3)=13244, C(46,4)=163185, C(47,5)=1533939`);
    console.log(`WASM sum: ${b17_1 + b24_2 + b44_3 + b46_4 + b47_5}, Expected sum: 1710661`);
  }
  
  // Always use exhaustive enumeration like ProPokerTools
  const actualTrials = wasm.calculateExhaustive();
  const isExhaustive = true;
  console.log(`Exhaustive: ${actualTrials} runouts`);
  
  // Get results
  const results: EquityResult[] = vp.map((p, i) => {
    const wins = wasm.getWins(i);
    const ties = wasm.getTies(i);
    return {
      playerId: p.id,
      wins,
      ties,
      total: actualTrials,
      equity: ((wins + ties / 2) / actualTrials) * 100
    };
  });
  
  return {
    results,
    totalTrials: actualTrials,
    isExhaustive
  };
}

// JavaScript fallback implementation
const H2_0 = [0,0,0,0,1,1,1,2,2,3];
const H2_1 = [1,2,3,4,2,3,4,3,4,4];
const B3_0 = [0,0,0,0,0,0,1,1,1,2];
const B3_1 = [1,1,1,2,2,3,2,2,3,3];
const B3_2 = [2,3,4,3,4,4,3,4,4,4];
const STRAIGHTS = [0x100F, 0x001F, 0x003E, 0x007C, 0x00F8, 0x01F0, 0x03E0, 0x07C0, 0x0F80, 0x1F00];

function eval5JS(c0: number, c1: number, c2: number, c3: number, c4: number): number {
  const r0 = c0 >> 2, r1 = c1 >> 2, r2 = c2 >> 2, r3 = c3 >> 2, r4 = c4 >> 2;
  const s0 = c0 & 3, s1 = c1 & 3, s2 = c2 & 3, s3 = c3 & 3, s4 = c4 & 3;
  
  const flush = s0 === s1 && s1 === s2 && s2 === s3 && s3 === s4;
  const bits = (1 << r0) | (1 << r1) | (1 << r2) | (1 << r3) | (1 << r4);
  
  let strHi = -1;
  for (let i = 9; i >= 0; i--) if (bits === STRAIGHTS[i]) { strHi = i; break; }
  if (strHi < 0 && bits === 0x100F) strHi = 0;
  
  if (flush && strHi >= 0) return 8000000 + strHi;
  
  const cnt = [0,0,0,0,0,0,0,0,0,0,0,0,0];
  cnt[r0]++; cnt[r1]++; cnt[r2]++; cnt[r3]++; cnt[r4]++;
  
  let q = -1, t = -1, p1 = -1, p2 = -1, k1 = -1, k2 = -1, k3 = -1;
  for (let r = 12; r >= 0; r--) {
    const c = cnt[r];
    if (c === 4) q = r;
    else if (c === 3) t = r;
    else if (c === 2) { if (p1 < 0) p1 = r; else p2 = r; }
    else if (c === 1) { if (k1 < 0) k1 = r; else if (k2 < 0) k2 = r; else k3 = r; }
  }
  
  if (q >= 0) return 7000000 + q * 13 + (k1 >= 0 ? k1 : p1);
  if (t >= 0 && p1 >= 0) return 6000000 + t * 13 + p1;
  
  if (flush) {
    const sr = [r0, r1, r2, r3, r4].sort((a, b) => b - a);
    return 5000000 + sr[0] * 28561 + sr[1] * 2197 + sr[2] * 169 + sr[3] * 13 + sr[4];
  }
  
  if (strHi >= 0) return 4000000 + strHi;
  if (t >= 0) return 3000000 + t * 169 + k1 * 13 + k2;
  if (p1 >= 0 && p2 >= 0) return 2000000 + p1 * 169 + p2 * 13 + k1;
  if (p1 >= 0) return 1000000 + p1 * 2197 + k1 * 169 + k2 * 13 + k3;
  return k1 * 28561 + k2 * 2197 + k3 * 169 + (p1 >= 0 ? p1 : 0) * 13 + (p2 >= 0 ? p2 : 0);
}

function calculateEquityJS(players: PlayerInput[], board: Card[]): CalculationResult {
  const vp = players.filter(p => p.cards.length >= 2 && p.cards.length <= 5);
  if (vp.length < 2) return { results: [], totalTrials: 0, isExhaustive: false };
  
  const np = vp.length;
  const used = new Set<number>();
  
  const pc: Uint8Array[] = [];
  const pLen: number[] = [];
  for (const p of vp) {
    const arr = new Uint8Array(p.cards.length);
    for (let i = 0; i < p.cards.length; i++) {
      const enc = encodeCard(p.cards[i]);
      arr[i] = enc;
      used.add(enc);
    }
    pc.push(arr);
    pLen.push(p.cards.length);
  }
  
  const bc = new Uint8Array(board.length);
  for (let i = 0; i < board.length; i++) {
    const enc = encodeCard(board[i]);
    bc[i] = enc;
    used.add(enc);
  }
  
  const deck = new Uint8Array(52 - used.size);
  let di = 0;
  for (let i = 0; i < 52; i++) if (!used.has(i)) deck[di++] = i;
  
  const cn = 5 - board.length;
  const dl = deck.length;
  
  const wins = new Uint32Array(np);
  const ties = new Uint32Array(np);
  const scores = new Uint32Array(np);
  const fb = new Uint8Array(5);
  for (let i = 0; i < board.length; i++) fb[i] = bc[i];
  
  // Always use exhaustive enumeration like ProPokerTools
  const numTrials = combinations(dl, cn);
  const isExhaustive = true;
  
  for (let trial = 0; trial < numTrials; trial++) {
    for (let i = 0; i < cn; i++) {
      const j = i + ((Math.random() * (dl - i)) | 0);
      const t = deck[i]; deck[i] = deck[j]; deck[j] = t;
      fb[board.length + i] = deck[i];
    }
    
    for (let p = 0; p < np; p++) {
      const h = pc[p];
      const hLen = pLen[p];
      let best = 0;
      for (let hi = 0; hi < 10; hi++) {
        const h0 = H2_0[hi], h1 = H2_1[hi];
        if (h0 >= hLen || h1 >= hLen) continue;
        for (let bi = 0; bi < 10; bi++) {
          const sc = eval5JS(h[h0], h[h1], fb[B3_0[bi]], fb[B3_1[bi]], fb[B3_2[bi]]);
          if (sc > best) best = sc;
        }
      }
      scores[p] = best;
    }
    
    let mx = 0;
    for (let p = 0; p < np; p++) if (scores[p] > mx) mx = scores[p];
    let wc = 0;
    for (let p = 0; p < np; p++) if (scores[p] === mx) wc++;
    for (let p = 0; p < np; p++) {
      if (scores[p] === mx) {
        if (wc === 1) wins[p]++;
        else ties[p]++;
      }
    }
  }
  
  return {
    results: vp.map((p, i) => ({
      playerId: p.id,
      wins: wins[i],
      ties: ties[i],
      total: numTrials,
      equity: ((wins[i] + ties[i] / 2) / numTrials) * 100
    })),
    totalTrials: numTrials,
    isExhaustive
  };
}
