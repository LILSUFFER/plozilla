// Two Plus Two style evaluator with O(1) lookup table
// ~10MB table for all 2,598,960 unique 5-card hands

// Lookup table - loaded from external file
const TABLE_SIZE: i32 = 2598960;
const HAND_RANKS = new StaticArray<i32>(TABLE_SIZE);

// Binomial coefficients for combinatorial indexing
// C(n,k) for n=0..51, k=0..5
const BINOMIAL = new StaticArray<i32>(52 * 6);

// 2-from-5 combinations (10 total)
const H2_0: StaticArray<i32> = [0,0,0,0,1,1,1,2,2,3];
const H2_1: StaticArray<i32> = [1,2,3,4,2,3,4,3,4,4];

// 3-from-5 combinations (10 total)
const B3_0: StaticArray<i32> = [0,0,0,0,0,0,1,1,1,2];
const B3_1: StaticArray<i32> = [1,1,1,2,2,3,2,2,3,3];
const B3_2: StaticArray<i32> = [2,3,4,3,4,4,3,4,4,4];

let tableLoaded: bool = false;

// Initialize binomial coefficients
function initBinomial(): void {
  for (let n: i32 = 0; n < 52; n++) {
    unchecked(BINOMIAL[n * 6 + 0] = 1);
    for (let k: i32 = 1; k <= min(n, 5); k++) {
      if (n === 0) {
        unchecked(BINOMIAL[n * 6 + k] = 0);
      } else {
        unchecked(BINOMIAL[n * 6 + k] = BINOMIAL[(n-1) * 6 + (k-1)] + BINOMIAL[(n-1) * 6 + k]);
      }
    }
  }
}

// Export function to set table values (called from JS)
export function setHandRank(index: i32, rank: i32): void {
  if (index >= 0 && index < TABLE_SIZE) {
    unchecked(HAND_RANKS[index] = rank);
  }
}

// Export function to set multiple values at once (batch loading)
export function setHandRanksBatch(startIdx: i32, values: StaticArray<i32>): void {
  const len: i32 = values.length;
  for (let i: i32 = 0; i < len; i++) {
    unchecked(HAND_RANKS[startIdx + i] = values[i]);
  }
}

export function markTableLoaded(): void {
  tableLoaded = true;
}

export function isTableLoaded(): bool {
  return tableLoaded;
}

// Get combinatorial index for sorted cards c0 < c1 < c2 < c3 < c4
// Index = C(c0,1) + C(c1,2) + C(c2,3) + C(c3,4) + C(c4,5)
@inline function getHandIndex(c0: i32, c1: i32, c2: i32, c3: i32, c4: i32): i32 {
  // Sort cards ascending
  let s0: i32 = c0, s1: i32 = c1, s2: i32 = c2, s3: i32 = c3, s4: i32 = c4;
  let t: i32;
  if (s0 > s1) { t = s0; s0 = s1; s1 = t; }
  if (s1 > s2) { t = s1; s1 = s2; s2 = t; }
  if (s2 > s3) { t = s2; s2 = s3; s3 = t; }
  if (s3 > s4) { t = s3; s3 = s4; s4 = t; }
  if (s0 > s1) { t = s0; s0 = s1; s1 = t; }
  if (s1 > s2) { t = s1; s1 = s2; s2 = t; }
  if (s2 > s3) { t = s2; s2 = s3; s3 = t; }
  if (s0 > s1) { t = s0; s0 = s1; s1 = t; }
  if (s1 > s2) { t = s1; s1 = s2; s2 = t; }
  if (s0 > s1) { t = s0; s0 = s1; s1 = t; }
  
  return unchecked(BINOMIAL[s0 * 6 + 1]) + 
         unchecked(BINOMIAL[s1 * 6 + 2]) + 
         unchecked(BINOMIAL[s2 * 6 + 3]) + 
         unchecked(BINOMIAL[s3 * 6 + 4]) + 
         unchecked(BINOMIAL[s4 * 6 + 5]);
}

// O(1) hand evaluation using lookup table
@inline function eval5Lookup(c0: i32, c1: i32, c2: i32, c3: i32, c4: i32): i32 {
  const idx: i32 = getHandIndex(c0, c1, c2, c3, c4);
  return unchecked(HAND_RANKS[idx]);
}

// Public eval5 for backward compatibility
export function eval5(c0: i32, c1: i32, c2: i32, c3: i32, c4: i32): i32 {
  return eval5Lookup(c0, c1, c2, c3, c4);
}

export function init(): void {
  initBinomial();
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

// Evaluate player's best hand using exactly 2 hole + 3 board
@inline function evalPlayerBestInline(pIdx: i32, b0: i32, b1: i32, b2: i32, b3: i32, b4: i32): i32 {
  const hBase: i32 = pIdx * 5;
  let best: i32 = 0;
  
  // Extract hand cards
  const h0: i32 = unchecked(playerHands[hBase]);
  const h1: i32 = unchecked(playerHands[hBase + 1]);
  const h2: i32 = unchecked(playerHands[hBase + 2]);
  const h3: i32 = unchecked(playerHands[hBase + 3]);
  const h4: i32 = unchecked(playerHands[hBase + 4]);
  
  // Store hand cards in array for indexing
  const hc0: i32 = h0, hc1: i32 = h1, hc2: i32 = h2, hc3: i32 = h3, hc4: i32 = h4;
  
  // 10 x 10 = 100 combinations
  for (let hi: i32 = 0; hi < 10; hi++) {
    const hi0: i32 = unchecked(H2_0[hi]);
    const hi1: i32 = unchecked(H2_1[hi]);
    
    let ph0: i32, ph1: i32;
    if (hi0 === 0) ph0 = hc0;
    else if (hi0 === 1) ph0 = hc1;
    else if (hi0 === 2) ph0 = hc2;
    else if (hi0 === 3) ph0 = hc3;
    else ph0 = hc4;
    
    if (hi1 === 1) ph1 = hc1;
    else if (hi1 === 2) ph1 = hc2;
    else if (hi1 === 3) ph1 = hc3;
    else ph1 = hc4;
    
    for (let bi: i32 = 0; bi < 10; bi++) {
      const bi0: i32 = unchecked(B3_0[bi]);
      const bi1: i32 = unchecked(B3_1[bi]);
      const bi2: i32 = unchecked(B3_2[bi]);
      
      let pb0: i32, pb1: i32, pb2: i32;
      if (bi0 === 0) pb0 = b0;
      else if (bi0 === 1) pb0 = b1;
      else pb0 = b2;
      
      if (bi1 === 1) pb1 = b1;
      else if (bi1 === 2) pb1 = b2;
      else pb1 = b3;
      
      if (bi2 === 2) pb2 = b2;
      else if (bi2 === 3) pb2 = b3;
      else pb2 = b4;
      
      const sc: i32 = eval5Lookup(ph0, ph1, pb0, pb1, pb2);
      if (sc > best) best = sc;
    }
  }
  
  return best;
}

// Main Monte Carlo calculation
export function calculate(numTrials: i32): void {
  const cardsNeeded: i32 = 5 - boardLen;
  
  let b0: i32 = boardLen > 0 ? unchecked(board[0]) : 0;
  let b1: i32 = boardLen > 1 ? unchecked(board[1]) : 0;
  let b2: i32 = boardLen > 2 ? unchecked(board[2]) : 0;
  let b3: i32 = boardLen > 3 ? unchecked(board[3]) : 0;
  let b4: i32 = boardLen > 4 ? unchecked(board[4]) : 0;
  
  for (let p: i32 = 0; p < numPlayers; p++) {
    unchecked(wins[p] = 0);
    unchecked(ties[p] = 0);
  }
  
  for (let trial: i32 = 0; trial < numTrials; trial++) {
    for (let i: i32 = 0; i < cardsNeeded; i++) {
      const j: i32 = i + <i32>(random() % <u32>(deckLen - i));
      const tmp: i32 = unchecked(deck[i]);
      unchecked(deck[i] = deck[j]);
      unchecked(deck[j] = tmp);
    }
    
    if (cardsNeeded >= 1) b0 = boardLen === 0 ? unchecked(deck[0]) : b0;
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
  
  const ob0: i32 = boardLen > 0 ? unchecked(board[0]) : 0;
  const ob1: i32 = boardLen > 1 ? unchecked(board[1]) : 0;
  const ob2: i32 = boardLen > 2 ? unchecked(board[2]) : 0;
  const ob3: i32 = boardLen > 3 ? unchecked(board[3]) : 0;
  const ob4: i32 = boardLen > 4 ? unchecked(board[4]) : 0;
  
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
