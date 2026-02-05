// Two Plus Two style evaluator in AssemblyScript
// Generates compact lookup tables for O(1) hand evaluation

// Hand rankings (higher = better)
const HIGH_CARD: i32 = 0;
const ONE_PAIR: i32 = 1;
const TWO_PAIR: i32 = 2;
const THREE_OF_A_KIND: i32 = 3;
const STRAIGHT: i32 = 4;
const FLUSH: i32 = 5;
const FULL_HOUSE: i32 = 6;
const FOUR_OF_A_KIND: i32 = 7;
const STRAIGHT_FLUSH: i32 = 8;

// Lookup tables
const FLUSH_TABLE = new StaticArray<i32>(8192);      // 2^13 for rank bitmask
const UNIQUE5_TABLE = new StaticArray<i32>(8192);    // Non-flush unique ranks
const PAIRS_TABLE = new StaticArray<i32>(6561);      // 3^8 for pair patterns (only need first 8 ranks)

// Precomputed straight bitmasks (A-5 through T-A)
const STRAIGHTS: StaticArray<i32> = [
  0x100F, // A2345 (wheel)
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

// 2-from-5 combinations (10 total)
const H2_0: StaticArray<i32> = [0,0,0,0,1,1,1,2,2,3];
const H2_1: StaticArray<i32> = [1,2,3,4,2,3,4,3,4,4];

// 3-from-5 combinations (10 total)
const B3_0: StaticArray<i32> = [0,0,0,0,0,0,1,1,1,2];
const B3_1: StaticArray<i32> = [1,1,1,2,2,3,2,2,3,3];
const B3_2: StaticArray<i32> = [2,3,4,3,4,4,3,4,4,4];

// Memory layout for player hands and board
// Offset 0-99: Player 1 hand (up to 5 cards as i32)
// Offset 100-199: Player 2 hand
// etc.

let initialized: bool = false;

function popcount(x: i32): i32 {
  x = x - ((x >> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
  x = (x + (x >> 4)) & 0x0F0F0F0F;
  x = x + (x >> 8);
  x = x + (x >> 16);
  return x & 0x3F;
}

function highBit(x: i32): i32 {
  let n: i32 = 0;
  if (x >= 0x100) { x >>= 8; n += 8; }
  if (x >= 0x10) { x >>= 4; n += 4; }
  if (x >= 0x4) { x >>= 2; n += 2; }
  if (x >= 0x2) { n += 1; }
  return n;
}

function initTables(): void {
  if (initialized) return;
  
  // Initialize flush table - for 5 unique ranks (flush hands)
  for (let bits: i32 = 0; bits < 8192; bits++) {
    if (popcount(bits) !== 5) {
      unchecked(FLUSH_TABLE[bits] = 0);
      continue;
    }
    
    // Check for straight flush
    let straightHi: i32 = -1;
    for (let s: i32 = 9; s >= 0; s--) {
      if (bits === unchecked(STRAIGHTS[s])) {
        straightHi = s;
        break;
      }
    }
    
    if (straightHi >= 0) {
      // Straight flush
      unchecked(FLUSH_TABLE[bits] = (STRAIGHT_FLUSH << 20) | straightHi);
    } else {
      // Regular flush - encode high cards
      let remaining: i32 = bits;
      let score: i32 = 0;
      for (let i: i32 = 0; i < 5; i++) {
        let high: i32 = highBit(remaining);
        score = score * 13 + high;
        remaining &= ~(1 << high);
      }
      unchecked(FLUSH_TABLE[bits] = (FLUSH << 20) | score);
    }
  }
  
  // Initialize unique5 table - for 5 unique ranks (non-flush)
  for (let bits: i32 = 0; bits < 8192; bits++) {
    if (popcount(bits) !== 5) {
      unchecked(UNIQUE5_TABLE[bits] = 0);
      continue;
    }
    
    // Check for straight
    let straightHi: i32 = -1;
    for (let s: i32 = 9; s >= 0; s--) {
      if (bits === unchecked(STRAIGHTS[s])) {
        straightHi = s;
        break;
      }
    }
    
    if (straightHi >= 0) {
      unchecked(UNIQUE5_TABLE[bits] = (STRAIGHT << 20) | straightHi);
    } else {
      // High card - encode all 5 ranks
      let remaining: i32 = bits;
      let score: i32 = 0;
      for (let i: i32 = 0; i < 5; i++) {
        let high: i32 = highBit(remaining);
        score = score * 13 + high;
        remaining &= ~(1 << high);
      }
      unchecked(UNIQUE5_TABLE[bits] = (HIGH_CARD << 20) | score);
    }
  }
  
  initialized = true;
}

// Evaluate 5 cards - each card is encoded as rank*4+suit (0-51)
export function eval5(c0: i32, c1: i32, c2: i32, c3: i32, c4: i32): i32 {
  const r0: i32 = c0 >> 2;
  const r1: i32 = c1 >> 2;
  const r2: i32 = c2 >> 2;
  const r3: i32 = c3 >> 2;
  const r4: i32 = c4 >> 2;
  
  const s0: i32 = c0 & 3;
  const s1: i32 = c1 & 3;
  const s2: i32 = c2 & 3;
  const s3: i32 = c3 & 3;
  const s4: i32 = c4 & 3;
  
  const bits: i32 = (1 << r0) | (1 << r1) | (1 << r2) | (1 << r3) | (1 << r4);
  const isFlush: bool = s0 === s1 && s1 === s2 && s2 === s3 && s3 === s4;
  
  // 5 unique ranks
  if (popcount(bits) === 5) {
    if (isFlush) {
      return unchecked(FLUSH_TABLE[bits]);
    }
    return unchecked(UNIQUE5_TABLE[bits]);
  }
  
  // Has pairs/trips/quads - count each rank
  let cnt0: i32 = 0, cnt1: i32 = 0, cnt2: i32 = 0, cnt3: i32 = 0, cnt4: i32 = 0;
  let cnt5: i32 = 0, cnt6: i32 = 0, cnt7: i32 = 0, cnt8: i32 = 0, cnt9: i32 = 0;
  let cnt10: i32 = 0, cnt11: i32 = 0, cnt12: i32 = 0;
  
  if (r0 === 0) cnt0++; else if (r0 === 1) cnt1++; else if (r0 === 2) cnt2++;
  else if (r0 === 3) cnt3++; else if (r0 === 4) cnt4++; else if (r0 === 5) cnt5++;
  else if (r0 === 6) cnt6++; else if (r0 === 7) cnt7++; else if (r0 === 8) cnt8++;
  else if (r0 === 9) cnt9++; else if (r0 === 10) cnt10++; else if (r0 === 11) cnt11++;
  else cnt12++;
  
  if (r1 === 0) cnt0++; else if (r1 === 1) cnt1++; else if (r1 === 2) cnt2++;
  else if (r1 === 3) cnt3++; else if (r1 === 4) cnt4++; else if (r1 === 5) cnt5++;
  else if (r1 === 6) cnt6++; else if (r1 === 7) cnt7++; else if (r1 === 8) cnt8++;
  else if (r1 === 9) cnt9++; else if (r1 === 10) cnt10++; else if (r1 === 11) cnt11++;
  else cnt12++;
  
  if (r2 === 0) cnt0++; else if (r2 === 1) cnt1++; else if (r2 === 2) cnt2++;
  else if (r2 === 3) cnt3++; else if (r2 === 4) cnt4++; else if (r2 === 5) cnt5++;
  else if (r2 === 6) cnt6++; else if (r2 === 7) cnt7++; else if (r2 === 8) cnt8++;
  else if (r2 === 9) cnt9++; else if (r2 === 10) cnt10++; else if (r2 === 11) cnt11++;
  else cnt12++;
  
  if (r3 === 0) cnt0++; else if (r3 === 1) cnt1++; else if (r3 === 2) cnt3++;
  else if (r3 === 3) cnt3++; else if (r3 === 4) cnt4++; else if (r3 === 5) cnt5++;
  else if (r3 === 6) cnt6++; else if (r3 === 7) cnt7++; else if (r3 === 8) cnt8++;
  else if (r3 === 9) cnt9++; else if (r3 === 10) cnt10++; else if (r3 === 11) cnt11++;
  else cnt12++;
  
  if (r4 === 0) cnt0++; else if (r4 === 1) cnt1++; else if (r4 === 2) cnt2++;
  else if (r4 === 3) cnt3++; else if (r4 === 4) cnt4++; else if (r4 === 5) cnt5++;
  else if (r4 === 6) cnt6++; else if (r4 === 7) cnt7++; else if (r4 === 8) cnt8++;
  else if (r4 === 9) cnt9++; else if (r4 === 10) cnt10++; else if (r4 === 11) cnt11++;
  else cnt12++;
  
  // Find quads, trips, pairs, kickers
  let quad: i32 = -1, trip: i32 = -1, pair1: i32 = -1, pair2: i32 = -1;
  let kick1: i32 = -1, kick2: i32 = -1, kick3: i32 = -1;
  
  // Check each rank from high to low
  if (cnt12 === 4) quad = 12;
  else if (cnt12 === 3) trip = 12;
  else if (cnt12 === 2) pair1 = 12;
  else if (cnt12 === 1) kick1 = 12;
  
  if (cnt11 === 4) quad = 11;
  else if (cnt11 === 3) trip = 11;
  else if (cnt11 === 2) { if (pair1 < 0) pair1 = 11; else pair2 = 11; }
  else if (cnt11 === 1) { if (kick1 < 0) kick1 = 11; else if (kick2 < 0) kick2 = 11; else kick3 = 11; }
  
  if (cnt10 === 4) quad = 10;
  else if (cnt10 === 3) trip = 10;
  else if (cnt10 === 2) { if (pair1 < 0) pair1 = 10; else pair2 = 10; }
  else if (cnt10 === 1) { if (kick1 < 0) kick1 = 10; else if (kick2 < 0) kick2 = 10; else kick3 = 10; }
  
  if (cnt9 === 4) quad = 9;
  else if (cnt9 === 3) trip = 9;
  else if (cnt9 === 2) { if (pair1 < 0) pair1 = 9; else pair2 = 9; }
  else if (cnt9 === 1) { if (kick1 < 0) kick1 = 9; else if (kick2 < 0) kick2 = 9; else kick3 = 9; }
  
  if (cnt8 === 4) quad = 8;
  else if (cnt8 === 3) trip = 8;
  else if (cnt8 === 2) { if (pair1 < 0) pair1 = 8; else pair2 = 8; }
  else if (cnt8 === 1) { if (kick1 < 0) kick1 = 8; else if (kick2 < 0) kick2 = 8; else kick3 = 8; }
  
  if (cnt7 === 4) quad = 7;
  else if (cnt7 === 3) trip = 7;
  else if (cnt7 === 2) { if (pair1 < 0) pair1 = 7; else pair2 = 7; }
  else if (cnt7 === 1) { if (kick1 < 0) kick1 = 7; else if (kick2 < 0) kick2 = 7; else kick3 = 7; }
  
  if (cnt6 === 4) quad = 6;
  else if (cnt6 === 3) trip = 6;
  else if (cnt6 === 2) { if (pair1 < 0) pair1 = 6; else pair2 = 6; }
  else if (cnt6 === 1) { if (kick1 < 0) kick1 = 6; else if (kick2 < 0) kick2 = 6; else kick3 = 6; }
  
  if (cnt5 === 4) quad = 5;
  else if (cnt5 === 3) trip = 5;
  else if (cnt5 === 2) { if (pair1 < 0) pair1 = 5; else pair2 = 5; }
  else if (cnt5 === 1) { if (kick1 < 0) kick1 = 5; else if (kick2 < 0) kick2 = 5; else kick3 = 5; }
  
  if (cnt4 === 4) quad = 4;
  else if (cnt4 === 3) trip = 4;
  else if (cnt4 === 2) { if (pair1 < 0) pair1 = 4; else pair2 = 4; }
  else if (cnt4 === 1) { if (kick1 < 0) kick1 = 4; else if (kick2 < 0) kick2 = 4; else kick3 = 4; }
  
  if (cnt3 === 4) quad = 3;
  else if (cnt3 === 3) trip = 3;
  else if (cnt3 === 2) { if (pair1 < 0) pair1 = 3; else pair2 = 3; }
  else if (cnt3 === 1) { if (kick1 < 0) kick1 = 3; else if (kick2 < 0) kick2 = 3; else kick3 = 3; }
  
  if (cnt2 === 4) quad = 2;
  else if (cnt2 === 3) trip = 2;
  else if (cnt2 === 2) { if (pair1 < 0) pair1 = 2; else pair2 = 2; }
  else if (cnt2 === 1) { if (kick1 < 0) kick1 = 2; else if (kick2 < 0) kick2 = 2; else kick3 = 2; }
  
  if (cnt1 === 4) quad = 1;
  else if (cnt1 === 3) trip = 1;
  else if (cnt1 === 2) { if (pair1 < 0) pair1 = 1; else pair2 = 1; }
  else if (cnt1 === 1) { if (kick1 < 0) kick1 = 1; else if (kick2 < 0) kick2 = 1; else kick3 = 1; }
  
  if (cnt0 === 4) quad = 0;
  else if (cnt0 === 3) trip = 0;
  else if (cnt0 === 2) { if (pair1 < 0) pair1 = 0; else pair2 = 0; }
  else if (cnt0 === 1) { if (kick1 < 0) kick1 = 0; else if (kick2 < 0) kick2 = 0; else kick3 = 0; }
  
  // Determine hand type
  if (quad >= 0) {
    const kicker: i32 = kick1 >= 0 ? kick1 : (pair1 >= 0 ? pair1 : trip);
    return (FOUR_OF_A_KIND << 20) | (quad << 4) | kicker;
  }
  
  if (trip >= 0 && pair1 >= 0) {
    return (FULL_HOUSE << 20) | (trip << 4) | pair1;
  }
  
  if (trip >= 0) {
    return (THREE_OF_A_KIND << 20) | (trip << 8) | (kick1 << 4) | kick2;
  }
  
  if (pair1 >= 0 && pair2 >= 0) {
    return (TWO_PAIR << 20) | (pair1 << 8) | (pair2 << 4) | kick1;
  }
  
  if (pair1 >= 0) {
    return (ONE_PAIR << 20) | (pair1 << 12) | (kick1 << 8) | (kick2 << 4) | kick3;
  }
  
  // Should not reach here for non-unique hands
  return 0;
}

// Initialize tables
export function init(): void {
  initTables();
}

// Memory for storing hands and results
const playerHands = new StaticArray<i32>(35); // 7 players * 5 cards
const playerLens = new StaticArray<i32>(7);
const board = new StaticArray<i32>(5);
const deck = new StaticArray<i32>(52);
const wins = new StaticArray<i32>(7);
const ties = new StaticArray<i32>(7);
const scores = new StaticArray<i32>(7);

let numPlayers: i32 = 0;
let boardLen: i32 = 0;
let deckLen: i32 = 0;

// Set player hand
export function setPlayerHand(playerIdx: i32, idx: i32, card: i32): void {
  unchecked(playerHands[playerIdx * 5 + idx] = card);
}

export function setPlayerLen(playerIdx: i32, len: i32): void {
  unchecked(playerLens[playerIdx] = len);
}

export function setNumPlayers(n: i32): void {
  numPlayers = n;
}

// Set board
export function setBoardCard(idx: i32, card: i32): void {
  unchecked(board[idx] = card);
}

export function setBoardLen(len: i32): void {
  boardLen = len;
}

// Build deck (excluding used cards, passed as two i32 for JS compatibility)
export function buildDeck(usedLow: i32, usedHigh: i32): void {
  deckLen = 0;
  for (let i: i32 = 0; i < 32; i++) {
    if ((usedLow & (1 << i)) === 0) {
      unchecked(deck[deckLen] = i);
      deckLen++;
    }
  }
  for (let i: i32 = 0; i < 20; i++) {
    if ((usedHigh & (1 << i)) === 0) {
      unchecked(deck[deckLen] = 32 + i);
      deckLen++;
    }
  }
}

// Simple LCG random
let seed: u32 = 12345;
function random(): u32 {
  seed = seed * 1103515245 + 12345;
  return seed;
}

export function setSeed(s: u32): void {
  seed = s;
}

// Evaluate best Omaha hand for a player
function evalPlayerBest(pIdx: i32, fullBoard: StaticArray<i32>): i32 {
  const hLen: i32 = unchecked(playerLens[pIdx]);
  const hBase: i32 = pIdx * 5;
  let best: i32 = 0;
  
  for (let hi: i32 = 0; hi < 10; hi++) {
    const h0: i32 = unchecked(H2_0[hi]);
    const h1: i32 = unchecked(H2_1[hi]);
    if (h0 >= hLen || h1 >= hLen) continue;
    
    for (let bi: i32 = 0; bi < 10; bi++) {
      const sc: i32 = eval5(
        unchecked(playerHands[hBase + h0]),
        unchecked(playerHands[hBase + h1]),
        unchecked(fullBoard[B3_0[bi]]),
        unchecked(fullBoard[B3_1[bi]]),
        unchecked(fullBoard[B3_2[bi]])
      );
      if (sc > best) best = sc;
    }
  }
  
  return best;
}

// Main Monte Carlo calculation
export function calculate(numTrials: i32): void {
  const cardsNeeded: i32 = 5 - boardLen;
  const fullBoard = new StaticArray<i32>(5);
  
  // Copy existing board
  for (let i: i32 = 0; i < boardLen; i++) {
    unchecked(fullBoard[i] = board[i]);
  }
  
  // Reset stats
  for (let p: i32 = 0; p < numPlayers; p++) {
    unchecked(wins[p] = 0);
    unchecked(ties[p] = 0);
  }
  
  // Monte Carlo loop
  for (let trial: i32 = 0; trial < numTrials; trial++) {
    // Partial Fisher-Yates shuffle
    for (let i: i32 = 0; i < cardsNeeded; i++) {
      const j: i32 = i + <i32>(random() % <u32>(deckLen - i));
      const tmp: i32 = unchecked(deck[i]);
      unchecked(deck[i] = deck[j]);
      unchecked(deck[j] = tmp);
      unchecked(fullBoard[boardLen + i] = deck[i]);
    }
    
    // Evaluate each player
    let maxScore: i32 = 0;
    for (let p: i32 = 0; p < numPlayers; p++) {
      const sc: i32 = evalPlayerBest(p, fullBoard);
      unchecked(scores[p] = sc);
      if (sc > maxScore) maxScore = sc;
    }
    
    // Count winners
    let winCount: i32 = 0;
    for (let p: i32 = 0; p < numPlayers; p++) {
      if (unchecked(scores[p]) === maxScore) winCount++;
    }
    
    // Update stats
    for (let p: i32 = 0; p < numPlayers; p++) {
      if (unchecked(scores[p]) === maxScore) {
        if (winCount === 1) {
          unchecked(wins[p] = wins[p] + 1);
        } else {
          unchecked(ties[p] = ties[p] + 1);
        }
      }
    }
  }
}

// Get results
export function getWins(playerIdx: i32): i32 {
  return unchecked(wins[playerIdx]);
}

export function getTies(playerIdx: i32): i32 {
  return unchecked(ties[playerIdx]);
}
