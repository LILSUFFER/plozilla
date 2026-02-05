// Optimized Two Plus Two style evaluator in AssemblyScript
// Uses precomputed lookup tables for O(1) hand evaluation

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

// Lookup tables - larger for speed
const FLUSH_TABLE = new StaticArray<i32>(8192);      // 2^13 for rank bitmask
const UNIQUE5_TABLE = new StaticArray<i32>(8192);    // Non-flush unique ranks


// Precomputed straight bitmasks (A-5 through T-A)
const STRAIGHTS: StaticArray<i32> = [
  0x100F, 0x001F, 0x003E, 0x007C, 0x00F8,
  0x01F0, 0x03E0, 0x07C0, 0x0F80, 0x1F00
];

// 2-from-5 combinations (10 total)
const H2_0: StaticArray<i32> = [0,0,0,0,1,1,1,2,2,3];
const H2_1: StaticArray<i32> = [1,2,3,4,2,3,4,3,4,4];

// 3-from-5 combinations (10 total)
const B3_0: StaticArray<i32> = [0,0,0,0,0,0,1,1,1,2];
const B3_1: StaticArray<i32> = [1,1,1,2,2,3,2,2,3,3];
const B3_2: StaticArray<i32> = [2,3,4,3,4,4,3,4,4,4];

let initialized: bool = false;

// Bit manipulation helpers - inlined for speed
@inline function popcount(x: i32): i32 {
  x = x - ((x >> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
  x = (x + (x >> 4)) & 0x0F0F0F0F;
  x = x + (x >> 8);
  x = x + (x >> 16);
  return x & 0x3F;
}

@inline function highBit(x: i32): i32 {
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
      unchecked(FLUSH_TABLE[bits] = (STRAIGHT_FLUSH << 20) | straightHi);
    } else {
      // Regular flush - encode all 5 ranks
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

// Optimized eval5 - no loops, minimal branching
@inline function eval5Fast(r0: i32, r1: i32, r2: i32, r3: i32, r4: i32, isFlush: bool): i32 {
  const bits: i32 = (1 << r0) | (1 << r1) | (1 << r2) | (1 << r3) | (1 << r4);
  const numUnique: i32 = popcount(bits);
  
  // 5 unique ranks - use lookup table
  if (numUnique === 5) {
    if (isFlush) {
      return unchecked(FLUSH_TABLE[bits]);
    }
    return unchecked(UNIQUE5_TABLE[bits]);
  }
  
  // Sort ranks descending for easier processing (5 elements, simple bubble)
  let s0: i32 = r0, s1: i32 = r1, s2: i32 = r2, s3: i32 = r3, s4: i32 = r4;
  let t: i32;
  if (s0 < s1) { t = s0; s0 = s1; s1 = t; }
  if (s1 < s2) { t = s1; s1 = s2; s2 = t; }
  if (s2 < s3) { t = s2; s2 = s3; s3 = t; }
  if (s3 < s4) { t = s3; s3 = s4; s4 = t; }
  if (s0 < s1) { t = s0; s0 = s1; s1 = t; }
  if (s1 < s2) { t = s1; s1 = s2; s2 = t; }
  if (s2 < s3) { t = s2; s2 = s3; s3 = t; }
  if (s0 < s1) { t = s0; s0 = s1; s1 = t; }
  if (s1 < s2) { t = s1; s1 = s2; s2 = t; }
  if (s0 < s1) { t = s0; s0 = s1; s1 = t; }
  
  // numUnique tells us hand pattern:
  // 4 unique = one pair (AABC pattern sorted)
  // 3 unique = two pair (AABB) or trips (AAAB)
  // 2 unique = full house (AAABB) or quads (AAAAB)
  
  if (numUnique === 4) {
    // One pair - find pair rank
    let pairRank: i32, k1: i32, k2: i32, k3: i32;
    if (s0 === s1) { pairRank = s0; k1 = s2; k2 = s3; k3 = s4; }
    else if (s1 === s2) { pairRank = s1; k1 = s0; k2 = s3; k3 = s4; }
    else if (s2 === s3) { pairRank = s2; k1 = s0; k2 = s1; k3 = s4; }
    else { pairRank = s3; k1 = s0; k2 = s1; k3 = s2; }
    return (ONE_PAIR << 20) | (pairRank << 12) | (k1 << 8) | (k2 << 4) | k3;
  }
  
  if (numUnique === 3) {
    // Two pair or trips
    // Sorted: AABBC or AAABC
    if (s0 === s1 && s2 === s3) {
      // AABBC - two pair
      return (TWO_PAIR << 20) | (s0 << 8) | (s2 << 4) | s4;
    }
    if (s1 === s2 && s3 === s4) {
      // ABBCC - two pair
      return (TWO_PAIR << 20) | (s1 << 8) | (s3 << 4) | s0;
    }
    if (s0 === s1 && s3 === s4) {
      // AABCC - two pair
      return (TWO_PAIR << 20) | (s0 << 8) | (s3 << 4) | s2;
    }
    // Trips - AAABC, ABBBC, ABCCC
    if (s0 === s1 && s1 === s2) {
      return (THREE_OF_A_KIND << 20) | (s0 << 8) | (s3 << 4) | s4;
    }
    if (s1 === s2 && s2 === s3) {
      return (THREE_OF_A_KIND << 20) | (s1 << 8) | (s0 << 4) | s4;
    }
    // s2 === s3 === s4
    return (THREE_OF_A_KIND << 20) | (s2 << 8) | (s0 << 4) | s1;
  }
  
  // numUnique === 2: Full house or quads
  // Sorted: AAAAB, AAABB, AABBB, ABBBB
  if (s0 === s1 && s1 === s2 && s2 === s3) {
    // AAAAB - quads
    return (FOUR_OF_A_KIND << 20) | (s0 << 4) | s4;
  }
  if (s1 === s2 && s2 === s3 && s3 === s4) {
    // ABBBB - quads
    return (FOUR_OF_A_KIND << 20) | (s1 << 4) | s0;
  }
  // Full house: AAABB or AABBB
  if (s0 === s1 && s1 === s2) {
    return (FULL_HOUSE << 20) | (s0 << 4) | s3;
  }
  return (FULL_HOUSE << 20) | (s2 << 4) | s0;
}

// Public eval5 for backward compatibility
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
  
  const isFlush: bool = s0 === s1 && s1 === s2 && s2 === s3 && s3 === s4;
  
  return eval5Fast(r0, r1, r2, r3, r4, isFlush);
}

export function init(): void {
  initTables();
}

// Player hands storage
const playerHands = new StaticArray<i32>(40); // 8 players * 5 cards
const playerLens = new StaticArray<i32>(8);
let numPlayers: i32 = 0;

// Board storage
const board = new StaticArray<i32>(5);
let boardLen: i32 = 0;

// Deck for Monte Carlo
const deck = new StaticArray<i32>(52);
let deckLen: i32 = 0;

// Results
const wins = new StaticArray<i32>(8);
const ties = new StaticArray<i32>(8);
const scores = new StaticArray<i32>(8);

export function setPlayerHand(playerIdx: i32, idx: i32, card: i32): void {
  unchecked(playerHands[playerIdx * 5 + idx] = card);
}

export function setPlayerLen(playerIdx: i32, len: i32): void {
  unchecked(playerLens[playerIdx] = len);
}

export function setNumPlayers(n: i32): void {
  numPlayers = n;
}

export function setBoardCard(idx: i32, card: i32): void {
  unchecked(board[idx] = card);
}

export function setBoardLen(len: i32): void {
  boardLen = len;
}

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
@inline function random(): u32 {
  seed = seed * 1103515245 + 12345;
  return seed;
}

export function setSeed(s: u32): void {
  seed = s;
}

// Global arrays for hand/board data (avoid allocations in hot loop)
const tempHR = new StaticArray<i32>(5);
const tempHS = new StaticArray<i32>(5);
const tempBR = new StaticArray<i32>(5);
const tempBS = new StaticArray<i32>(5);

// Inlined evalPlayerBest for maximum speed
@inline function evalPlayerBestInline(pIdx: i32, b0: i32, b1: i32, b2: i32, b3: i32, b4: i32): i32 {
  const hLen: i32 = unchecked(playerLens[pIdx]);
  const hBase: i32 = pIdx * 5;
  let best: i32 = 0;
  
  // Extract hand ranks and suits into global arrays
  const h0c: i32 = unchecked(playerHands[hBase]);
  const h1c: i32 = unchecked(playerHands[hBase + 1]);
  const h2c: i32 = unchecked(playerHands[hBase + 2]);
  const h3c: i32 = unchecked(playerHands[hBase + 3]);
  const h4c: i32 = unchecked(playerHands[hBase + 4]);
  
  unchecked(tempHR[0] = h0c >> 2); unchecked(tempHS[0] = h0c & 3);
  unchecked(tempHR[1] = h1c >> 2); unchecked(tempHS[1] = h1c & 3);
  unchecked(tempHR[2] = h2c >> 2); unchecked(tempHS[2] = h2c & 3);
  unchecked(tempHR[3] = h3c >> 2); unchecked(tempHS[3] = h3c & 3);
  unchecked(tempHR[4] = h4c >> 2); unchecked(tempHS[4] = h4c & 3);
  
  // Extract board ranks and suits
  unchecked(tempBR[0] = b0 >> 2); unchecked(tempBS[0] = b0 & 3);
  unchecked(tempBR[1] = b1 >> 2); unchecked(tempBS[1] = b1 & 3);
  unchecked(tempBR[2] = b2 >> 2); unchecked(tempBS[2] = b2 & 3);
  unchecked(tempBR[3] = b3 >> 2); unchecked(tempBS[3] = b3 & 3);
  unchecked(tempBR[4] = b4 >> 2); unchecked(tempBS[4] = b4 & 3);
  
  // 10 combinations of 2 from hand x 10 combinations of 3 from board = 100 combos
  for (let hi: i32 = 0; hi < 10; hi++) {
    const hi0: i32 = unchecked(H2_0[hi]);
    const hi1: i32 = unchecked(H2_1[hi]);
    if (hi0 >= hLen || hi1 >= hLen) continue;
    
    const hr0: i32 = unchecked(tempHR[hi0]);
    const hr1: i32 = unchecked(tempHR[hi1]);
    const hs0: i32 = unchecked(tempHS[hi0]);
    const hs1: i32 = unchecked(tempHS[hi1]);
    
    for (let bi: i32 = 0; bi < 10; bi++) {
      const bi0: i32 = unchecked(B3_0[bi]);
      const bi1: i32 = unchecked(B3_1[bi]);
      const bi2: i32 = unchecked(B3_2[bi]);
      
      const br0: i32 = unchecked(tempBR[bi0]);
      const br1: i32 = unchecked(tempBR[bi1]);
      const br2: i32 = unchecked(tempBR[bi2]);
      const bs0: i32 = unchecked(tempBS[bi0]);
      const bs1: i32 = unchecked(tempBS[bi1]);
      const bs2: i32 = unchecked(tempBS[bi2]);
      
      const isFlush: bool = hs0 === hs1 && hs1 === bs0 && bs0 === bs1 && bs1 === bs2;
      const sc: i32 = eval5Fast(hr0, hr1, br0, br1, br2, isFlush);
      if (sc > best) best = sc;
    }
  }
  
  return best;
}

// Main Monte Carlo calculation
export function calculate(numTrials: i32): void {
  const cardsNeeded: i32 = 5 - boardLen;
  
  // Copy existing board
  let b0: i32 = boardLen > 0 ? unchecked(board[0]) : 0;
  let b1: i32 = boardLen > 1 ? unchecked(board[1]) : 0;
  let b2: i32 = boardLen > 2 ? unchecked(board[2]) : 0;
  let b3: i32 = boardLen > 3 ? unchecked(board[3]) : 0;
  let b4: i32 = boardLen > 4 ? unchecked(board[4]) : 0;
  
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
    }
    
    // Build full board
    if (cardsNeeded >= 1) b0 = boardLen === 0 ? unchecked(deck[0]) : b0;
    if (cardsNeeded >= 1 && boardLen >= 1) { } // keep b0
    if (cardsNeeded >= 2 && boardLen === 0) b1 = unchecked(deck[1]);
    if (cardsNeeded >= 1 && boardLen === 1) b1 = unchecked(deck[0]);
    if (cardsNeeded >= 3 && boardLen === 0) b2 = unchecked(deck[2]);
    if (cardsNeeded >= 2 && boardLen === 1) b2 = unchecked(deck[1]);
    if (cardsNeeded >= 1 && boardLen === 2) b2 = unchecked(deck[0]);
    if (cardsNeeded >= 4 && boardLen === 0) b3 = unchecked(deck[3]);
    if (cardsNeeded >= 3 && boardLen === 1) b3 = unchecked(deck[2]);
    if (cardsNeeded >= 2 && boardLen === 2) b3 = unchecked(deck[1]);
    if (cardsNeeded >= 1 && boardLen === 3) b3 = unchecked(deck[0]);
    if (cardsNeeded >= 5 && boardLen === 0) b4 = unchecked(deck[4]);
    if (cardsNeeded >= 4 && boardLen === 1) b4 = unchecked(deck[3]);
    if (cardsNeeded >= 3 && boardLen === 2) b4 = unchecked(deck[2]);
    if (cardsNeeded >= 2 && boardLen === 3) b4 = unchecked(deck[1]);
    if (cardsNeeded >= 1 && boardLen === 4) b4 = unchecked(deck[0]);
    
    // Evaluate each player
    let maxScore: i32 = 0;
    for (let p: i32 = 0; p < numPlayers; p++) {
      const sc: i32 = evalPlayerBestInline(p, b0, b1, b2, b3, b4);
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

// Exhaustive calculation - enumerate all runouts
export function calculateExhaustive(): i32 {
  const cardsNeeded: i32 = 5 - boardLen;
  
  // Pre-extract board cards
  const ob0: i32 = boardLen > 0 ? unchecked(board[0]) : 0;
  const ob1: i32 = boardLen > 1 ? unchecked(board[1]) : 0;
  const ob2: i32 = boardLen > 2 ? unchecked(board[2]) : 0;
  const ob3: i32 = boardLen > 3 ? unchecked(board[3]) : 0;
  const ob4: i32 = boardLen > 4 ? unchecked(board[4]) : 0;
  
  // Reset stats
  for (let p: i32 = 0; p < numPlayers; p++) {
    unchecked(wins[p] = 0);
    unchecked(ties[p] = 0);
  }
  
  let totalRunouts: i32 = 0;
  
  if (cardsNeeded === 0) {
    totalRunouts = 1;
    let maxScore: i32 = 0;
    for (let p: i32 = 0; p < numPlayers; p++) {
      const sc: i32 = evalPlayerBestInline(p, ob0, ob1, ob2, ob3, ob4);
      unchecked(scores[p] = sc);
      if (sc > maxScore) maxScore = sc;
    }
    let winCount: i32 = 0;
    for (let p: i32 = 0; p < numPlayers; p++) {
      if (unchecked(scores[p]) === maxScore) winCount++;
    }
    for (let p: i32 = 0; p < numPlayers; p++) {
      if (unchecked(scores[p]) === maxScore) {
        if (winCount === 1) unchecked(wins[p] = 1);
        else unchecked(ties[p] = 1);
      }
    }
  } else if (cardsNeeded === 1) {
    for (let c0: i32 = 0; c0 < deckLen; c0++) {
      const d0: i32 = unchecked(deck[c0]);
      const b0: i32 = boardLen === 0 ? d0 : ob0;
      const b1: i32 = boardLen === 1 ? d0 : ob1;
      const b2: i32 = boardLen === 2 ? d0 : ob2;
      const b3: i32 = boardLen === 3 ? d0 : ob3;
      const b4: i32 = boardLen === 4 ? d0 : ob4;
      
      totalRunouts++;
      let maxScore: i32 = 0;
      for (let p: i32 = 0; p < numPlayers; p++) {
        const sc: i32 = evalPlayerBestInline(p, b0, b1, b2, b3, b4);
        unchecked(scores[p] = sc);
        if (sc > maxScore) maxScore = sc;
      }
      let winCount: i32 = 0;
      for (let p: i32 = 0; p < numPlayers; p++) {
        if (unchecked(scores[p]) === maxScore) winCount++;
      }
      for (let p: i32 = 0; p < numPlayers; p++) {
        if (unchecked(scores[p]) === maxScore) {
          if (winCount === 1) unchecked(wins[p] = wins[p] + 1);
          else unchecked(ties[p] = ties[p] + 1);
        }
      }
    }
  } else if (cardsNeeded === 2) {
    for (let c0: i32 = 0; c0 < deckLen - 1; c0++) {
      const d0: i32 = unchecked(deck[c0]);
      for (let c1: i32 = c0 + 1; c1 < deckLen; c1++) {
        const d1: i32 = unchecked(deck[c1]);
        
        let b0: i32, b1: i32, b2: i32, b3: i32, b4: i32;
        if (boardLen === 0) { b0 = d0; b1 = d1; b2 = ob2; b3 = ob3; b4 = ob4; }
        else if (boardLen === 1) { b0 = ob0; b1 = d0; b2 = d1; b3 = ob3; b4 = ob4; }
        else if (boardLen === 2) { b0 = ob0; b1 = ob1; b2 = d0; b3 = d1; b4 = ob4; }
        else { b0 = ob0; b1 = ob1; b2 = ob2; b3 = d0; b4 = d1; }
        
        totalRunouts++;
        let maxScore: i32 = 0;
        for (let p: i32 = 0; p < numPlayers; p++) {
          const sc: i32 = evalPlayerBestInline(p, b0, b1, b2, b3, b4);
          unchecked(scores[p] = sc);
          if (sc > maxScore) maxScore = sc;
        }
        let winCount: i32 = 0;
        for (let p: i32 = 0; p < numPlayers; p++) {
          if (unchecked(scores[p]) === maxScore) winCount++;
        }
        for (let p: i32 = 0; p < numPlayers; p++) {
          if (unchecked(scores[p]) === maxScore) {
            if (winCount === 1) unchecked(wins[p] = wins[p] + 1);
            else unchecked(ties[p] = ties[p] + 1);
          }
        }
      }
    }
  } else if (cardsNeeded === 3) {
    for (let c0: i32 = 0; c0 < deckLen - 2; c0++) {
      const d0: i32 = unchecked(deck[c0]);
      for (let c1: i32 = c0 + 1; c1 < deckLen - 1; c1++) {
        const d1: i32 = unchecked(deck[c1]);
        for (let c2: i32 = c1 + 1; c2 < deckLen; c2++) {
          const d2: i32 = unchecked(deck[c2]);
          
          let b0: i32, b1: i32, b2: i32, b3: i32, b4: i32;
          if (boardLen === 0) { b0 = d0; b1 = d1; b2 = d2; b3 = ob3; b4 = ob4; }
          else if (boardLen === 1) { b0 = ob0; b1 = d0; b2 = d1; b3 = d2; b4 = ob4; }
          else { b0 = ob0; b1 = ob1; b2 = d0; b3 = d1; b4 = d2; }
          
          totalRunouts++;
          let maxScore: i32 = 0;
          for (let p: i32 = 0; p < numPlayers; p++) {
            const sc: i32 = evalPlayerBestInline(p, b0, b1, b2, b3, b4);
            unchecked(scores[p] = sc);
            if (sc > maxScore) maxScore = sc;
          }
          let winCount: i32 = 0;
          for (let p: i32 = 0; p < numPlayers; p++) {
            if (unchecked(scores[p]) === maxScore) winCount++;
          }
          for (let p: i32 = 0; p < numPlayers; p++) {
            if (unchecked(scores[p]) === maxScore) {
              if (winCount === 1) unchecked(wins[p] = wins[p] + 1);
              else unchecked(ties[p] = ties[p] + 1);
            }
          }
        }
      }
    }
  } else if (cardsNeeded === 4) {
    for (let c0: i32 = 0; c0 < deckLen - 3; c0++) {
      const d0: i32 = unchecked(deck[c0]);
      for (let c1: i32 = c0 + 1; c1 < deckLen - 2; c1++) {
        const d1: i32 = unchecked(deck[c1]);
        for (let c2: i32 = c1 + 1; c2 < deckLen - 1; c2++) {
          const d2: i32 = unchecked(deck[c2]);
          for (let c3: i32 = c2 + 1; c3 < deckLen; c3++) {
            const d3: i32 = unchecked(deck[c3]);
            
            let b0: i32, b1: i32, b2: i32, b3: i32, b4: i32;
            if (boardLen === 0) { b0 = d0; b1 = d1; b2 = d2; b3 = d3; b4 = ob4; }
            else { b0 = ob0; b1 = d0; b2 = d1; b3 = d2; b4 = d3; }
            
            totalRunouts++;
            let maxScore: i32 = 0;
            for (let p: i32 = 0; p < numPlayers; p++) {
              const sc: i32 = evalPlayerBestInline(p, b0, b1, b2, b3, b4);
              unchecked(scores[p] = sc);
              if (sc > maxScore) maxScore = sc;
            }
            let winCount: i32 = 0;
            for (let p: i32 = 0; p < numPlayers; p++) {
              if (unchecked(scores[p]) === maxScore) winCount++;
            }
            for (let p: i32 = 0; p < numPlayers; p++) {
              if (unchecked(scores[p]) === maxScore) {
                if (winCount === 1) unchecked(wins[p] = wins[p] + 1);
                else unchecked(ties[p] = ties[p] + 1);
              }
            }
          }
        }
      }
    }
  } else if (cardsNeeded === 5) {
    for (let c0: i32 = 0; c0 < deckLen - 4; c0++) {
      const d0: i32 = unchecked(deck[c0]);
      for (let c1: i32 = c0 + 1; c1 < deckLen - 3; c1++) {
        const d1: i32 = unchecked(deck[c1]);
        for (let c2: i32 = c1 + 1; c2 < deckLen - 2; c2++) {
          const d2: i32 = unchecked(deck[c2]);
          for (let c3: i32 = c2 + 1; c3 < deckLen - 1; c3++) {
            const d3: i32 = unchecked(deck[c3]);
            for (let c4: i32 = c3 + 1; c4 < deckLen; c4++) {
              const d4: i32 = unchecked(deck[c4]);
              
              totalRunouts++;
              let maxScore: i32 = 0;
              for (let p: i32 = 0; p < numPlayers; p++) {
                const sc: i32 = evalPlayerBestInline(p, d0, d1, d2, d3, d4);
                unchecked(scores[p] = sc);
                if (sc > maxScore) maxScore = sc;
              }
              let winCount: i32 = 0;
              for (let p: i32 = 0; p < numPlayers; p++) {
                if (unchecked(scores[p]) === maxScore) winCount++;
              }
              for (let p: i32 = 0; p < numPlayers; p++) {
                if (unchecked(scores[p]) === maxScore) {
                  if (winCount === 1) unchecked(wins[p] = wins[p] + 1);
                  else unchecked(ties[p] = ties[p] + 1);
                }
              }
            }
          }
        }
      }
    }
  } else {
    totalRunouts = -1;
  }
  
  return totalRunouts;
}

export function getDeckLen(): i32 {
  return deckLen;
}

export function getWins(playerIdx: i32): i32 {
  return unchecked(wins[playerIdx]);
}

export function getTies(playerIdx: i32): i32 {
  return unchecked(ties[playerIdx]);
}
