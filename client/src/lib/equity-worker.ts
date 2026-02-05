// Maximum performance equity calculator - zero allocations in hot path

interface Card { rank: string; suit: string; }
interface PlayerInput { id: number; cards: Card[]; input: string; }

// Card encoding: rank (0-12) * 4 + suit (0-3) = 0-51
const RC: Record<string, number> = {'2':0,'3':1,'4':2,'5':3,'6':4,'7':5,'8':6,'9':7,'T':8,'J':9,'Q':10,'K':11,'A':12};
const SC: Record<string, number> = {'c':0,'d':1,'h':2,'s':3};

// Precomputed combinations: 2 from 5 (indices)
const H2_0 = new Uint8Array([0,0,0,0,1,1,1,2,2,3]);
const H2_1 = new Uint8Array([1,2,3,4,2,3,4,3,4,4]);
// 3 from 5
const B3_0 = new Uint8Array([0,0,0,0,0,0,1,1,1,2]);
const B3_1 = new Uint8Array([1,1,1,2,2,3,2,2,3,3]);
const B3_2 = new Uint8Array([2,3,4,3,4,4,3,4,4,4]);

// Straight detection bitmasks
const STRAIGHTS = new Uint16Array([
  0x100F, 0x001F, 0x003E, 0x007C, 0x00F8, 0x01F0, 0x03E0, 0x07C0, 0x0F80, 0x1F00
]);

const SAMPLES = 100000;

// Preallocated arrays for hot path
const counts = new Uint8Array(13);
const sortedRanks = new Uint8Array(5);

// Ultra-fast 5-card evaluator - returns score (higher = better)
function eval5(c0: number, c1: number, c2: number, c3: number, c4: number): number {
  const r0 = c0 >> 2, r1 = c1 >> 2, r2 = c2 >> 2, r3 = c3 >> 2, r4 = c4 >> 2;
  const s0 = c0 & 3, s1 = c1 & 3, s2 = c2 & 3, s3 = c3 & 3, s4 = c4 & 3;
  
  // Check flush
  const flush = s0 === s1 && s1 === s2 && s2 === s3 && s3 === s4;
  
  // Rank bitmask for straight
  const bits = (1 << r0) | (1 << r1) | (1 << r2) | (1 << r3) | (1 << r4);
  
  // Check straight
  let strHi = -1;
  for (let i = 9; i >= 0; i--) {
    if (bits === STRAIGHTS[i]) { strHi = i; break; }
  }
  if (strHi < 0 && bits === 0x100F) strHi = 0; // Wheel A-2-3-4-5
  
  // Royal/Straight flush
  if (flush && strHi >= 0) return 8000000 + strHi;
  
  // Count ranks
  counts.fill(0);
  counts[r0]++; counts[r1]++; counts[r2]++; counts[r3]++; counts[r4]++;
  
  let q = -1, t = -1, p1 = -1, p2 = -1, k1 = -1, k2 = -1, k3 = -1;
  for (let r = 12; r >= 0; r--) {
    const c = counts[r];
    if (c === 4) q = r;
    else if (c === 3) t = r;
    else if (c === 2) { if (p1 < 0) p1 = r; else p2 = r; }
    else if (c === 1) { if (k1 < 0) k1 = r; else if (k2 < 0) k2 = r; else k3 = r; }
  }
  
  // Quads
  if (q >= 0) return 7000000 + q * 13 + (k1 >= 0 ? k1 : p1);
  
  // Full house
  if (t >= 0 && p1 >= 0) return 6000000 + t * 13 + p1;
  
  // Flush - need sorted ranks
  if (flush) {
    sortedRanks[0] = r0; sortedRanks[1] = r1; sortedRanks[2] = r2; sortedRanks[3] = r3; sortedRanks[4] = r4;
    // Simple insertion sort (only 5 elements)
    for (let i = 1; i < 5; i++) {
      const v = sortedRanks[i];
      let j = i - 1;
      while (j >= 0 && sortedRanks[j] < v) { sortedRanks[j + 1] = sortedRanks[j]; j--; }
      sortedRanks[j + 1] = v;
    }
    return 5000000 + sortedRanks[0] * 28561 + sortedRanks[1] * 2197 + sortedRanks[2] * 169 + sortedRanks[3] * 13 + sortedRanks[4];
  }
  
  // Straight
  if (strHi >= 0) return 4000000 + strHi;
  
  // Trips
  if (t >= 0) return 3000000 + t * 169 + k1 * 13 + k2;
  
  // Two pair
  if (p1 >= 0 && p2 >= 0) return 2000000 + p1 * 169 + p2 * 13 + k1;
  
  // One pair
  if (p1 >= 0) return 1000000 + p1 * 2197 + k1 * 169 + k2 * 13 + k3;
  
  // High card
  return k1 * 28561 + k2 * 2197 + k3 * 169 + (p1 >= 0 ? p1 : 0) * 13 + (p2 >= 0 ? p2 : 0);
}

function calculate(players: PlayerInput[], board: Card[]) {
  const vp = players.filter(p => p.cards.length >= 2 && p.cards.length <= 5);
  if (vp.length < 2) return { results: [], totalTrials: 0, isExhaustive: false };
  
  const np = vp.length;
  const used = new Set<number>();
  
  // Encode player cards
  const pc: Uint8Array[] = [];
  const pLen: number[] = [];
  for (const p of vp) {
    const arr = new Uint8Array(p.cards.length);
    for (let i = 0; i < p.cards.length; i++) {
      const enc = RC[p.cards[i].rank] * 4 + SC[p.cards[i].suit];
      arr[i] = enc;
      used.add(enc);
    }
    pc.push(arr);
    pLen.push(p.cards.length);
  }
  
  // Encode board
  const bc = new Uint8Array(board.length);
  for (let i = 0; i < board.length; i++) {
    const enc = RC[board[i].rank] * 4 + SC[board[i].suit];
    bc[i] = enc;
    used.add(enc);
  }
  
  // Build deck
  const deck = new Uint8Array(52 - used.size);
  let di = 0;
  for (let i = 0; i < 52; i++) if (!used.has(i)) deck[di++] = i;
  
  const cn = 5 - board.length;
  const dl = deck.length;
  
  const wins = new Uint32Array(np);
  const ties = new Uint32Array(np);
  const scores = new Uint32Array(np);
  
  // Full board buffer
  const fb = new Uint8Array(5);
  for (let i = 0; i < board.length; i++) fb[i] = bc[i];
  
  // Main Monte Carlo loop
  for (let trial = 0; trial < SAMPLES; trial++) {
    // Partial Fisher-Yates shuffle
    for (let i = 0; i < cn; i++) {
      const j = i + ((Math.random() * (dl - i)) | 0);
      const t = deck[i]; deck[i] = deck[j]; deck[j] = t;
      fb[board.length + i] = deck[i];
    }
    
    // Evaluate each player
    for (let p = 0; p < np; p++) {
      const h = pc[p];
      const hLen = pLen[p];
      let best = 0;
      
      // Iterate all 2-from-hole × 3-from-board combinations
      for (let hi = 0; hi < 10; hi++) {
        const h0 = H2_0[hi], h1 = H2_1[hi];
        if (h0 >= hLen || h1 >= hLen) continue;
        
        for (let bi = 0; bi < 10; bi++) {
          const sc = eval5(h[h0], h[h1], fb[B3_0[bi]], fb[B3_1[bi]], fb[B3_2[bi]]);
          if (sc > best) best = sc;
        }
      }
      scores[p] = best;
    }
    
    // Find max score
    let mx = 0;
    for (let p = 0; p < np; p++) if (scores[p] > mx) mx = scores[p];
    
    // Count winners
    let wc = 0;
    for (let p = 0; p < np; p++) if (scores[p] === mx) wc++;
    
    // Update stats
    for (let p = 0; p < np; p++) {
      if (scores[p] === mx) {
        if (wc === 1) wins[p]++;
        else ties[p]++;
      }
    }
    
    // Progress update every 4096 iterations
    if ((trial & 0xFFF) === 0) {
      self.postMessage({ type: 'progress', progress: trial / SAMPLES });
    }
  }
  
  return {
    results: vp.map((p, i) => ({
      playerId: p.id,
      wins: wins[i],
      ties: ties[i],
      total: SAMPLES,
      equity: ((wins[i] + ties[i] / 2) / SAMPLES) * 100
    })),
    totalTrials: SAMPLES,
    isExhaustive: false
  };
}

self.onmessage = (e: MessageEvent) => {
  const { players, board } = e.data;
  const result = calculate(players, board);
  self.postMessage({ type: 'result', result });
};
