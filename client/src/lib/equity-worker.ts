// Ultra-fast equity calculator with Cactus Kev style lookup tables

interface Card { rank: string; suit: string; }
interface PlayerInput { id: number; cards: Card[]; input: string; }
interface EquityResult { playerId: number; wins: number; ties: number; total: number; equity: number; }
interface CalculationResult { results: EquityResult[]; totalTrials: number; isExhaustive: boolean; }

// Card encoding: 0-51 (rank * 4 + suit)
const RANK_CHAR: Record<string, number> = {
  '2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '8': 6,
  '9': 7, 'T': 8, 'J': 9, 'Q': 10, 'K': 11, 'A': 12
};
const SUIT_CHAR: Record<string, number> = { 'c': 0, 'd': 1, 'h': 2, 's': 3 };

// Prime numbers for each rank (for unique product hashing)
const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41];

// Precomputed flush table - maps sorted flush hands to ranking
// Straights: A2345=0, 23456=1, ... TJQKA=9
const STRAIGHT_MASKS = [
  0x100F, // A2345 (wheel) - bits: A,2,3,4,5
  0x001F, // 23456
  0x003E, // 34567
  0x007C, // 45678
  0x00F8, // 56789
  0x01F0, // 6789T
  0x03E0, // 789TJ
  0x07C0, // 89TJQ
  0x0F80, // 9TJQK
  0x1F00  // TJQKA
];

// Hand rankings (higher = better)
const ROYAL_FLUSH = 9000000;
const STRAIGHT_FLUSH = 8000000;
const QUADS = 7000000;
const FULL_HOUSE = 6000000;
const FLUSH = 5000000;
const STRAIGHT = 4000000;
const TRIPS = 3000000;
const TWO_PAIR = 2000000;
const ONE_PAIR = 1000000;
const HIGH_CARD = 0;

const H2 = [[0,1],[0,2],[0,3],[0,4],[1,2],[1,3],[1,4],[2,3],[2,4],[3,4]];
const B3 = [[0,1,2],[0,1,3],[0,1,4],[0,2,3],[0,2,4],[0,3,4],[1,2,3],[1,2,4],[1,3,4],[2,3,4]];

const SAMPLES = 100000;

// Ultra-fast 5-card evaluator
function eval5(c0: number, c1: number, c2: number, c3: number, c4: number): number {
  const r0 = c0 >> 2, r1 = c1 >> 2, r2 = c2 >> 2, r3 = c3 >> 2, r4 = c4 >> 2;
  const s0 = c0 & 3, s1 = c1 & 3, s2 = c2 & 3, s3 = c3 & 3, s4 = c4 & 3;
  
  // Check flush
  const isFlush = s0 === s1 && s1 === s2 && s2 === s3 && s3 === s4;
  
  // Rank bitmask for straight detection
  const rankBits = (1 << r0) | (1 << r1) | (1 << r2) | (1 << r3) | (1 << r4);
  
  // Check straight
  let straightRank = -1;
  for (let i = 9; i >= 0; i--) {
    if ((rankBits & STRAIGHT_MASKS[i]) === STRAIGHT_MASKS[i] || 
        (i === 0 && rankBits === 0x100F)) {
      straightRank = i;
      break;
    }
  }
  
  // Straight flush / Royal flush
  if (isFlush && straightRank >= 0) {
    return straightRank === 9 ? ROYAL_FLUSH : STRAIGHT_FLUSH + straightRank;
  }
  
  // Count ranks using prime product for uniqueness
  const cnt = new Uint8Array(13);
  cnt[r0]++; cnt[r1]++; cnt[r2]++; cnt[r3]++; cnt[r4]++;
  
  let quads = -1, trips = -1, pair1 = -1, pair2 = -1;
  let k1 = -1, k2 = -1, k3 = -1, k4 = -1, k5 = -1;
  
  for (let r = 12; r >= 0; r--) {
    const c = cnt[r];
    if (c === 4) quads = r;
    else if (c === 3) trips = r;
    else if (c === 2) { if (pair1 < 0) pair1 = r; else pair2 = r; }
    else if (c === 1) {
      if (k1 < 0) k1 = r;
      else if (k2 < 0) k2 = r;
      else if (k3 < 0) k3 = r;
      else if (k4 < 0) k4 = r;
      else k5 = r;
    }
  }
  
  // Four of a kind
  if (quads >= 0) {
    const kicker = k1 >= 0 ? k1 : (pair1 >= 0 ? pair1 : trips);
    return QUADS + quads * 13 + kicker;
  }
  
  // Full house
  if (trips >= 0 && pair1 >= 0) {
    return FULL_HOUSE + trips * 13 + pair1;
  }
  
  // Flush
  if (isFlush) {
    // Sort ranks descending
    const ranks = [r0, r1, r2, r3, r4].sort((a, b) => b - a);
    return FLUSH + ranks[0] * 28561 + ranks[1] * 2197 + ranks[2] * 169 + ranks[3] * 13 + ranks[4];
  }
  
  // Straight
  if (straightRank >= 0) {
    return STRAIGHT + straightRank;
  }
  
  // Three of a kind
  if (trips >= 0) {
    return TRIPS + trips * 169 + k1 * 13 + k2;
  }
  
  // Two pair
  if (pair1 >= 0 && pair2 >= 0) {
    return TWO_PAIR + pair1 * 169 + pair2 * 13 + k1;
  }
  
  // One pair
  if (pair1 >= 0) {
    return ONE_PAIR + pair1 * 2197 + k1 * 169 + k2 * 13 + k3;
  }
  
  // High card
  return HIGH_CARD + k1 * 28561 + k2 * 2197 + k3 * 169 + k4 * 13 + k5;
}

function calculateEquity(players: PlayerInput[], board: Card[]): CalculationResult {
  const vp = players.filter(p => p.cards.length >= 2 && p.cards.length <= 5);
  if (vp.length < 2) return { results: [], totalTrials: 0, isExhaustive: true };
  
  const np = vp.length;
  const used = new Set<number>();
  
  // Convert to encoded cards (0-51)
  const playerCards: Uint8Array[] = [];
  const playerLen: number[] = [];
  for (const p of vp) {
    const cards = new Uint8Array(p.cards.length);
    for (let i = 0; i < p.cards.length; i++) {
      const c = p.cards[i];
      const encoded = RANK_CHAR[c.rank] * 4 + SUIT_CHAR[c.suit];
      cards[i] = encoded;
      used.add(encoded);
    }
    playerCards.push(cards);
    playerLen.push(p.cards.length);
  }
  
  const boardCards = new Uint8Array(board.length);
  for (let i = 0; i < board.length; i++) {
    const c = board[i];
    const encoded = RANK_CHAR[c.rank] * 4 + SUIT_CHAR[c.suit];
    boardCards[i] = encoded;
    used.add(encoded);
  }
  
  // Build deck
  const deck = new Uint8Array(52 - used.size);
  let di = 0;
  for (let i = 0; i < 52; i++) {
    if (!used.has(i)) deck[di++] = i;
  }
  
  const cardsNeeded = 5 - board.length;
  const deckLen = deck.length;
  
  const wins = new Uint32Array(np);
  const ties = new Uint32Array(np);
  const scores = new Uint32Array(np);
  
  // Evaluate best Omaha hand
  const evalPlayer = (pIdx: number, fullBoard: Uint8Array): number => {
    const pCards = playerCards[pIdx];
    const pLen = playerLen[pIdx];
    let best = 0;
    
    for (let hi = 0; hi < 10; hi++) {
      const h0 = H2[hi][0], h1 = H2[hi][1];
      if (h0 >= pLen || h1 >= pLen) continue;
      
      for (let bi = 0; bi < 10; bi++) {
        const b0 = B3[bi][0], b1 = B3[bi][1], b2 = B3[bi][2];
        const sc = eval5(pCards[h0], pCards[h1], fullBoard[b0], fullBoard[b1], fullBoard[b2]);
        if (sc > best) best = sc;
      }
    }
    return best;
  };
  
  const fullBoard = new Uint8Array(5);
  for (let i = 0; i < board.length; i++) fullBoard[i] = boardCards[i];
  
  // Monte Carlo sampling with optimized shuffle
  for (let trial = 0; trial < SAMPLES; trial++) {
    // Partial Fisher-Yates
    for (let i = 0; i < cardsNeeded; i++) {
      const j = i + ((Math.random() * (deckLen - i)) | 0);
      const t = deck[i]; deck[i] = deck[j]; deck[j] = t;
      fullBoard[board.length + i] = deck[i];
    }
    
    // Evaluate all players
    for (let p = 0; p < np; p++) {
      scores[p] = evalPlayer(p, fullBoard);
    }
    
    // Find winner(s)
    let maxScore = 0;
    for (let p = 0; p < np; p++) if (scores[p] > maxScore) maxScore = scores[p];
    
    let winCount = 0;
    for (let p = 0; p < np; p++) if (scores[p] === maxScore) winCount++;
    
    for (let p = 0; p < np; p++) {
      if (scores[p] === maxScore) {
        if (winCount === 1) wins[p]++;
        else ties[p]++;
      }
    }
    
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
  const result = calculateEquity(players, board);
  self.postMessage({ type: 'result', result });
};
