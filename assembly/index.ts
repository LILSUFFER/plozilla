// Optimized Two Plus Two evaluator with O(1) lookup

const TABLE_SIZE: i32 = 2598960;
const HAND_RANKS = new StaticArray<i32>(TABLE_SIZE);

// Flat binomial array: BINOMIAL[n*6+k] = C(n,k)
const BINOMIAL = new StaticArray<i32>(312);

// Hole card pair indices (10 combinations from 5 cards)
const H2_0: StaticArray<i32> = [0,0,0,0,1,1,1,2,2,3];
const H2_1: StaticArray<i32> = [1,2,3,4,2,3,4,3,4,4];

// Board triple indices (10 combinations from 5 cards)
const B3_0: StaticArray<i32> = [0,0,0,0,0,0,1,1,1,2];
const B3_1: StaticArray<i32> = [1,1,1,2,2,3,2,2,3,3];
const B3_2: StaticArray<i32> = [2,3,4,3,4,4,3,4,4,4];

let tableLoaded: bool = false;

function initBinomial(): void {
  for (let n: i32 = 0; n < 52; n++) unchecked(BINOMIAL[n * 6] = 1);
  for (let n: i32 = 1; n < 52; n++) {
    for (let k: i32 = 1; k <= min(n, 5); k++) {
      unchecked(BINOMIAL[n * 6 + k] = BINOMIAL[(n-1) * 6 + (k-1)] + BINOMIAL[(n-1) * 6 + k]);
    }
  }
}

export function setHandRank(index: i32, rank: i32): void {
  unchecked(HAND_RANKS[index] = rank);
}

export function markTableLoaded(): void { tableLoaded = true; }
export function isTableLoaded(): bool { return tableLoaded; }

@inline function getIdx(c0: i32, c1: i32, c2: i32, c3: i32, c4: i32): i32 {
  let a: i32 = c0, b: i32 = c1, c: i32 = c2, d: i32 = c3, e: i32 = c4, t: i32;
  // Correct Bose-Nelson sorting network for 5 elements (9 comparisons)
  if (a > b) { t = a; a = b; b = t; }  // (0,1)
  if (d > e) { t = d; d = e; e = t; }  // (3,4)
  if (c > e) { t = c; c = e; e = t; }  // (2,4)
  if (c > d) { t = c; c = d; d = t; }  // (2,3)
  if (a > d) { t = a; a = d; d = t; }  // (0,3)
  if (a > c) { t = a; a = c; c = t; }  // (0,2)
  if (b > e) { t = b; b = e; e = t; }  // (1,4)
  if (b > d) { t = b; b = d; d = t; }  // (1,3)
  if (b > c) { t = b; b = c; c = t; }  // (1,2)
  return unchecked(BINOMIAL[a*6+1]) + unchecked(BINOMIAL[b*6+2]) + unchecked(BINOMIAL[c*6+3]) + unchecked(BINOMIAL[d*6+4]) + unchecked(BINOMIAL[e*6+5]);
}

@inline function lookup(c0: i32, c1: i32, c2: i32, c3: i32, c4: i32): i32 {
  return unchecked(HAND_RANKS[getIdx(c0, c1, c2, c3, c4)]);
}

export function eval5(c0: i32, c1: i32, c2: i32, c3: i32, c4: i32): i32 {
  return lookup(c0, c1, c2, c3, c4);
}

export function init(): void { initBinomial(); }

const playerHands = new StaticArray<i32>(40);
const playerLens = new StaticArray<i32>(8);
let numPlayers: i32 = 0;
const board = new StaticArray<i32>(5);
let boardLen: i32 = 0;
const deck = new StaticArray<i32>(52);
let deckLen: i32 = 0;
const wins = new StaticArray<i32>(8);
const ties = new StaticArray<i32>(8);
const scores = new StaticArray<i32>(8);

export function setPlayerHand(playerIdx: i32, idx: i32, card: i32): void { unchecked(playerHands[playerIdx * 5 + idx] = card); }
export function setPlayerLen(playerIdx: i32, len: i32): void { unchecked(playerLens[playerIdx] = len); }
export function setNumPlayers(n: i32): void { numPlayers = n; }
export function setBoardCard(idx: i32, card: i32): void { unchecked(board[idx] = card); }
export function setBoardLen(len: i32): void { boardLen = len; }

export function buildDeck(usedLow: i32, usedHigh: i32): void {
  deckLen = 0;
  for (let i: i32 = 0; i < 32; i++) if ((usedLow & (1 << i)) === 0) { unchecked(deck[deckLen] = i); deckLen++; }
  for (let i: i32 = 0; i < 20; i++) if ((usedHigh & (1 << i)) === 0) { unchecked(deck[deckLen] = 32 + i); deckLen++; }
}

let seed: u32 = 12345;
@inline function random(): u32 { seed = seed * 1103515245 + 12345; return seed; }
export function setSeed(s: u32): void { seed = s; }

const hCards = new StaticArray<i32>(5);
const bCards = new StaticArray<i32>(5);

@inline function evalPlayer(pIdx: i32, b0: i32, b1: i32, b2: i32, b3: i32, b4: i32): i32 {
  const base: i32 = pIdx * 5;
  unchecked(hCards[0] = playerHands[base]);
  unchecked(hCards[1] = playerHands[base+1]);
  unchecked(hCards[2] = playerHands[base+2]);
  unchecked(hCards[3] = playerHands[base+3]);
  unchecked(hCards[4] = playerHands[base+4]);
  unchecked(bCards[0] = b0);
  unchecked(bCards[1] = b1);
  unchecked(bCards[2] = b2);
  unchecked(bCards[3] = b3);
  unchecked(bCards[4] = b4);
  
  let best: i32 = 0;
  for (let hi: i32 = 0; hi < 10; hi++) {
    const h0: i32 = unchecked(hCards[unchecked(H2_0[hi])]);
    const h1: i32 = unchecked(hCards[unchecked(H2_1[hi])]);
    for (let bi: i32 = 0; bi < 10; bi++) {
      const sc: i32 = lookup(h0, h1, unchecked(bCards[unchecked(B3_0[bi])]), unchecked(bCards[unchecked(B3_1[bi])]), unchecked(bCards[unchecked(B3_2[bi])]));
      if (sc > best) best = sc;
    }
  }
  return best;
}

export function calculate(numTrials: i32): void {
  const cn: i32 = 5 - boardLen;
  let b0: i32 = boardLen > 0 ? unchecked(board[0]) : 0;
  let b1: i32 = boardLen > 1 ? unchecked(board[1]) : 0;
  let b2: i32 = boardLen > 2 ? unchecked(board[2]) : 0;
  let b3: i32 = boardLen > 3 ? unchecked(board[3]) : 0;
  let b4: i32 = boardLen > 4 ? unchecked(board[4]) : 0;
  
  for (let p: i32 = 0; p < numPlayers; p++) { unchecked(wins[p] = 0); unchecked(ties[p] = 0); }
  
  for (let t: i32 = 0; t < numTrials; t++) {
    for (let i: i32 = 0; i < cn; i++) {
      const j: i32 = i + <i32>(random() % <u32>(deckLen - i));
      const tmp: i32 = unchecked(deck[i]); unchecked(deck[i] = deck[j]); unchecked(deck[j] = tmp);
    }
    if (boardLen === 0) { b0 = unchecked(deck[0]); b1 = unchecked(deck[1]); b2 = unchecked(deck[2]); b3 = unchecked(deck[3]); b4 = unchecked(deck[4]); }
    else if (boardLen === 1) { b1 = unchecked(deck[0]); b2 = unchecked(deck[1]); b3 = unchecked(deck[2]); b4 = unchecked(deck[3]); }
    else if (boardLen === 2) { b2 = unchecked(deck[0]); b3 = unchecked(deck[1]); b4 = unchecked(deck[2]); }
    else if (boardLen === 3) { b3 = unchecked(deck[0]); b4 = unchecked(deck[1]); }
    else if (boardLen === 4) { b4 = unchecked(deck[0]); }
    
    let mx: i32 = 0;
    for (let p: i32 = 0; p < numPlayers; p++) { const sc: i32 = evalPlayer(p, b0, b1, b2, b3, b4); unchecked(scores[p] = sc); if (sc > mx) mx = sc; }
    let wc: i32 = 0;
    for (let p: i32 = 0; p < numPlayers; p++) if (unchecked(scores[p]) === mx) wc++;
    for (let p: i32 = 0; p < numPlayers; p++) if (unchecked(scores[p]) === mx) { if (wc === 1) unchecked(wins[p] = wins[p] + 1); else unchecked(ties[p] = ties[p] + 1); }
  }
}

export function calculateExhaustive(): i32 {
  const cn: i32 = 5 - boardLen;
  const ob0: i32 = boardLen > 0 ? unchecked(board[0]) : 0;
  const ob1: i32 = boardLen > 1 ? unchecked(board[1]) : 0;
  const ob2: i32 = boardLen > 2 ? unchecked(board[2]) : 0;
  const ob3: i32 = boardLen > 3 ? unchecked(board[3]) : 0;
  const ob4: i32 = boardLen > 4 ? unchecked(board[4]) : 0;
  
  for (let p: i32 = 0; p < numPlayers; p++) { unchecked(wins[p] = 0); unchecked(ties[p] = 0); }
  let total: i32 = 0;
  
  if (cn === 0) {
    total = 1;
    let mx: i32 = 0;
    for (let p: i32 = 0; p < numPlayers; p++) { const sc: i32 = evalPlayer(p, ob0, ob1, ob2, ob3, ob4); unchecked(scores[p] = sc); if (sc > mx) mx = sc; }
    let wc: i32 = 0; for (let p: i32 = 0; p < numPlayers; p++) if (unchecked(scores[p]) === mx) wc++;
    for (let p: i32 = 0; p < numPlayers; p++) if (unchecked(scores[p]) === mx) { if (wc === 1) unchecked(wins[p] = 1); else unchecked(ties[p] = 1); }
  } else if (cn === 1) {
    for (let c0: i32 = 0; c0 < deckLen; c0++) {
      const d0: i32 = unchecked(deck[c0]);
      let b0: i32 = ob0, b1: i32 = ob1, b2: i32 = ob2, b3: i32 = ob3, b4: i32 = ob4;
      if (boardLen === 4) b4 = d0; else if (boardLen === 3) b3 = d0; else if (boardLen === 2) b2 = d0; else if (boardLen === 1) b1 = d0; else b0 = d0;
      total++;
      let mx: i32 = 0; for (let p: i32 = 0; p < numPlayers; p++) { const sc: i32 = evalPlayer(p, b0, b1, b2, b3, b4); unchecked(scores[p] = sc); if (sc > mx) mx = sc; }
      let wc: i32 = 0; for (let p: i32 = 0; p < numPlayers; p++) if (unchecked(scores[p]) === mx) wc++;
      for (let p: i32 = 0; p < numPlayers; p++) if (unchecked(scores[p]) === mx) { if (wc === 1) unchecked(wins[p]++); else unchecked(ties[p]++); }
    }
  } else if (cn === 2) {
    for (let c0: i32 = 0; c0 < deckLen - 1; c0++) {
      const d0: i32 = unchecked(deck[c0]);
      for (let c1: i32 = c0 + 1; c1 < deckLen; c1++) {
        const d1: i32 = unchecked(deck[c1]);
        let b0: i32 = ob0, b1: i32 = ob1, b2: i32 = ob2, b3: i32 = ob3, b4: i32 = ob4;
        if (boardLen === 3) { b3 = d0; b4 = d1; } else if (boardLen === 2) { b2 = d0; b3 = d1; } else if (boardLen === 1) { b1 = d0; b2 = d1; } else { b0 = d0; b1 = d1; }
        total++;
        let mx: i32 = 0; for (let p: i32 = 0; p < numPlayers; p++) { const sc: i32 = evalPlayer(p, b0, b1, b2, b3, b4); unchecked(scores[p] = sc); if (sc > mx) mx = sc; }
        let wc: i32 = 0; for (let p: i32 = 0; p < numPlayers; p++) if (unchecked(scores[p]) === mx) wc++;
        for (let p: i32 = 0; p < numPlayers; p++) if (unchecked(scores[p]) === mx) { if (wc === 1) unchecked(wins[p]++); else unchecked(ties[p]++); }
      }
    }
  } else if (cn === 3) {
    for (let c0: i32 = 0; c0 < deckLen - 2; c0++) {
      const d0: i32 = unchecked(deck[c0]);
      for (let c1: i32 = c0 + 1; c1 < deckLen - 1; c1++) {
        const d1: i32 = unchecked(deck[c1]);
        for (let c2: i32 = c1 + 1; c2 < deckLen; c2++) {
          const d2: i32 = unchecked(deck[c2]);
          let b0: i32 = ob0, b1: i32 = ob1, b2: i32 = ob2, b3: i32 = ob3, b4: i32 = ob4;
          if (boardLen === 2) { b2 = d0; b3 = d1; b4 = d2; } else if (boardLen === 1) { b1 = d0; b2 = d1; b3 = d2; } else { b0 = d0; b1 = d1; b2 = d2; }
          total++;
          let mx: i32 = 0; for (let p: i32 = 0; p < numPlayers; p++) { const sc: i32 = evalPlayer(p, b0, b1, b2, b3, b4); unchecked(scores[p] = sc); if (sc > mx) mx = sc; }
          let wc: i32 = 0; for (let p: i32 = 0; p < numPlayers; p++) if (unchecked(scores[p]) === mx) wc++;
          for (let p: i32 = 0; p < numPlayers; p++) if (unchecked(scores[p]) === mx) { if (wc === 1) unchecked(wins[p]++); else unchecked(ties[p]++); }
        }
      }
    }
  } else if (cn === 4) {
    for (let c0: i32 = 0; c0 < deckLen - 3; c0++) {
      const d0: i32 = unchecked(deck[c0]);
      for (let c1: i32 = c0 + 1; c1 < deckLen - 2; c1++) {
        const d1: i32 = unchecked(deck[c1]);
        for (let c2: i32 = c1 + 1; c2 < deckLen - 1; c2++) {
          const d2: i32 = unchecked(deck[c2]);
          for (let c3: i32 = c2 + 1; c3 < deckLen; c3++) {
            const d3: i32 = unchecked(deck[c3]);
            let b0: i32 = ob0, b1: i32 = ob1, b2: i32 = ob2, b3: i32 = ob3, b4: i32 = ob4;
            if (boardLen === 1) { b1 = d0; b2 = d1; b3 = d2; b4 = d3; } else { b0 = d0; b1 = d1; b2 = d2; b3 = d3; }
            total++;
            let mx: i32 = 0; for (let p: i32 = 0; p < numPlayers; p++) { const sc: i32 = evalPlayer(p, b0, b1, b2, b3, b4); unchecked(scores[p] = sc); if (sc > mx) mx = sc; }
            let wc: i32 = 0; for (let p: i32 = 0; p < numPlayers; p++) if (unchecked(scores[p]) === mx) wc++;
            for (let p: i32 = 0; p < numPlayers; p++) if (unchecked(scores[p]) === mx) { if (wc === 1) unchecked(wins[p]++); else unchecked(ties[p]++); }
          }
        }
      }
    }
  } else if (cn === 5) {
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
              total++;
              let mx: i32 = 0; for (let p: i32 = 0; p < numPlayers; p++) { const sc: i32 = evalPlayer(p, d0, d1, d2, d3, d4); unchecked(scores[p] = sc); if (sc > mx) mx = sc; }
              let wc: i32 = 0; for (let p: i32 = 0; p < numPlayers; p++) if (unchecked(scores[p]) === mx) wc++;
              for (let p: i32 = 0; p < numPlayers; p++) if (unchecked(scores[p]) === mx) { if (wc === 1) unchecked(wins[p]++); else unchecked(ties[p]++); }
            }
          }
        }
      }
    }
  }
  return total;
}

export function getDeckLen(): i32 { return deckLen; }
export function getWins(playerIdx: i32): i32 { return unchecked(wins[playerIdx]); }
export function getTies(playerIdx: i32): i32 { return unchecked(ties[playerIdx]); }

// Debug exports
export function debugGetBinomial(n: i32, k: i32): i32 { return unchecked(BINOMIAL[n * 6 + k]); }
export function debugGetHandRank(idx: i32): i32 { return unchecked(HAND_RANKS[idx]); }
export function debugEval5(c0: i32, c1: i32, c2: i32, c3: i32, c4: i32): i32 { return lookup(c0, c1, c2, c3, c4); }
export function debugGetIdx(c0: i32, c1: i32, c2: i32, c3: i32, c4: i32): i32 { return getIdx(c0, c1, c2, c3, c4); }

// Range-based enumeration for parallel processing
// startC0/endC0 define range for first loop variable
export function calculateExhaustiveRange(startC0: i32, endC0: i32): i32 {
  const cn: i32 = 5 - boardLen;
  const ob0: i32 = boardLen > 0 ? unchecked(board[0]) : 0;
  const ob1: i32 = boardLen > 1 ? unchecked(board[1]) : 0;
  const ob2: i32 = boardLen > 2 ? unchecked(board[2]) : 0;
  const ob3: i32 = boardLen > 3 ? unchecked(board[3]) : 0;
  const ob4: i32 = boardLen > 4 ? unchecked(board[4]) : 0;
  
  for (let p: i32 = 0; p < numPlayers; p++) { unchecked(wins[p] = 0); unchecked(ties[p] = 0); }
  let total: i32 = 0;
  
  if (cn === 5) {
    const maxC0: i32 = min(endC0, deckLen - 4);
    for (let c0: i32 = startC0; c0 < maxC0; c0++) {
      const d0: i32 = unchecked(deck[c0]);
      for (let c1: i32 = c0 + 1; c1 < deckLen - 3; c1++) {
        const d1: i32 = unchecked(deck[c1]);
        for (let c2: i32 = c1 + 1; c2 < deckLen - 2; c2++) {
          const d2: i32 = unchecked(deck[c2]);
          for (let c3: i32 = c2 + 1; c3 < deckLen - 1; c3++) {
            const d3: i32 = unchecked(deck[c3]);
            for (let c4: i32 = c3 + 1; c4 < deckLen; c4++) {
              const d4: i32 = unchecked(deck[c4]);
              total++;
              let mx: i32 = 0; for (let p: i32 = 0; p < numPlayers; p++) { const sc: i32 = evalPlayer(p, d0, d1, d2, d3, d4); unchecked(scores[p] = sc); if (sc > mx) mx = sc; }
              let wc: i32 = 0; for (let p: i32 = 0; p < numPlayers; p++) if (unchecked(scores[p]) === mx) wc++;
              for (let p: i32 = 0; p < numPlayers; p++) if (unchecked(scores[p]) === mx) { if (wc === 1) unchecked(wins[p]++); else unchecked(ties[p]++); }
            }
          }
        }
      }
    }
  } else {
    // For smaller cn, just use full enumeration
    return calculateExhaustive();
  }
  return total;
}

export function getMaxC0(): i32 {
  const cn: i32 = 5 - boardLen;
  if (cn === 5) return deckLen - 4;
  return 0;
}
