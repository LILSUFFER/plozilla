#!/usr/bin/env npx tsx
/**
 * Check equity of a specific PLO5 hand vs 100% random opponent.
 *
 * Two modes:
 *   (A) Unbiased MC — board sampled from remaining 47, villain from remaining 42.
 *   (B) Biased histogram (current quasi-exact) — villain histogram from full 47-card pool.
 *
 * Usage:
 *   npx tsx scripts/check_equity_vs_random.ts "Js Th 5d Tc 4c"
 *   npx tsx scripts/check_equity_vs_random.ts "As Ah Ks Kh Qs" --trials 2000000
 */

import * as fs from 'fs';
import * as path from 'path';

const RANKS_STR = '23456789TJQKA';
const SUITS_STR = 'shdc';

function parseCard(s: string): number {
  s = s.trim();
  if (s.length < 2) throw new Error(`Invalid card: "${s}"`);
  let rankStr: string, suitStr: string;
  if (s.startsWith('10')) {
    rankStr = 'T';
    suitStr = s.slice(2);
  } else {
    rankStr = s[0].toUpperCase();
    suitStr = s.slice(1).toLowerCase();
  }
  const ri = RANKS_STR.indexOf(rankStr);
  const si = SUITS_STR.indexOf(suitStr);
  if (ri < 0 || si < 0) throw new Error(`Invalid card: "${s}" (rank=${rankStr}, suit=${suitStr})`);
  return ri * 4 + si;
}

function cardName(c: number): string {
  return RANKS_STR[c >> 2] + SUITS_STR[c & 3];
}

const BINOMIAL = new Int32Array(52 * 6);
function initBinomial(): void {
  for (let n = 0; n < 52; n++) BINOMIAL[n * 6] = 1;
  for (let n = 1; n < 52; n++)
    for (let k = 1; k <= Math.min(n, 5); k++)
      BINOMIAL[n * 6 + k] = BINOMIAL[(n - 1) * 6 + (k - 1)] + BINOMIAL[(n - 1) * 6 + k];
}

let HR: Int32Array;

function getIdx(c0: number, c1: number, c2: number, c3: number, c4: number): number {
  let a = c0, b = c1, c = c2, d = c3, e = c4, t: number;
  if (a > b) { t = a; a = b; b = t; }
  if (d > e) { t = d; d = e; e = t; }
  if (c > e) { t = c; c = e; e = t; }
  if (c > d) { t = c; c = d; d = t; }
  if (a > d) { t = a; a = d; d = t; }
  if (a > c) { t = a; a = c; c = t; }
  if (b > e) { t = b; b = e; e = t; }
  if (b > d) { t = b; b = d; d = t; }
  if (b > c) { t = b; b = c; c = t; }
  return BINOMIAL[a * 6 + 1] + BINOMIAL[b * 6 + 2] + BINOMIAL[c * 6 + 3] + BINOMIAL[d * 6 + 4] + BINOMIAL[e * 6 + 5];
}

function eval5(c0: number, c1: number, c2: number, c3: number, c4: number): number {
  return HR[getIdx(c0, c1, c2, c3, c4)];
}

function loadHandRanks(): void {
  const p = path.join(process.cwd(), 'client/public/hand-ranks.bin');
  const buf = fs.readFileSync(p);
  HR = new Int32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  if (HR.length !== 2598960) throw new Error(`hand-ranks.bin: expected 2598960, got ${HR.length}`);
}

const B3_I = [0, 0, 0, 0, 0, 0, 1, 1, 1, 2];
const B3_J = [1, 1, 1, 2, 2, 3, 2, 2, 3, 3];
const B3_K = [2, 3, 4, 3, 4, 4, 3, 4, 4, 4];
const H2I = [0, 0, 0, 0, 1, 1, 1, 2, 2, 3];
const H2J = [1, 2, 3, 4, 2, 3, 4, 3, 4, 4];

function bestHandValue(hand5: number[], best2: Int32Array): number {
  let v = 0;
  for (let si = 0; si < 10; si++) {
    const ci = hand5[H2I[si]], cj = hand5[H2J[si]];
    const key = ci < cj ? ci * 52 + cj : cj * 52 + ci;
    const b = best2[key];
    if (b > v) v = b;
  }
  return v;
}

function computeBest2(board: number[], deck: number[]): Int32Array {
  const best2 = new Int32Array(52 * 52);
  for (let i = 0; i < deck.length - 1; i++) {
    const ci = deck[i];
    for (let j = i + 1; j < deck.length; j++) {
      const cj = deck[j];
      let bv = 0;
      for (let bi = 0; bi < 10; bi++) {
        const v = eval5(ci, cj, board[B3_I[bi]], board[B3_J[bi]], board[B3_K[bi]]);
        if (v > bv) bv = v;
      }
      best2[ci * 52 + cj] = bv;
      best2[cj * 52 + ci] = bv;
    }
  }
  return best2;
}

function shuffle5(arr: number[], len: number): void {
  for (let i = 0; i < 5; i++) {
    const j = i + Math.floor(Math.random() * (len - i));
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
}

function modeA_UnbiasedMC(heroCards: number[], trials: number): number {
  const heroSet = new Set(heroCards);
  const remaining47: number[] = [];
  for (let c = 0; c < 52; c++) {
    if (!heroSet.has(c)) remaining47.push(c);
  }

  const board = new Array(5);
  const best2 = new Int32Array(52 * 52);
  const boardDeck = remaining47.slice();
  let wins = 0, ties = 0;

  for (let t = 0; t < trials; t++) {
    shuffle5(boardDeck, 47);
    board[0] = boardDeck[0];
    board[1] = boardDeck[1];
    board[2] = boardDeck[2];
    board[3] = boardDeck[3];
    board[4] = boardDeck[4];

    const villain42: number[] = [];
    for (let i = 5; i < 47; i++) villain42.push(boardDeck[i]);

    shuffle5(villain42, 42);
    const villainCards = [villain42[0], villain42[1], villain42[2], villain42[3], villain42[4]];

    const allCards = [...board, ...villain42];
    for (let i = 0; i < allCards.length - 1; i++) {
      const ci = allCards[i];
      for (let j = i + 1; j < allCards.length; j++) {
        const cj = allCards[j];
        let bv = 0;
        for (let bi = 0; bi < 10; bi++) {
          const v = eval5(ci, cj, board[B3_I[bi]], board[B3_J[bi]], board[B3_K[bi]]);
          if (v > bv) bv = v;
        }
        best2[ci * 52 + cj] = bv;
        best2[cj * 52 + ci] = bv;
      }
    }

    const heroVal = bestHandValue(heroCards, best2);
    const villainVal = bestHandValue(villainCards, best2);

    if (heroVal > villainVal) wins++;
    else if (heroVal === villainVal) ties++;
  }

  return (wins + 0.5 * ties) / trials * 100;
}

function modeA_Fast(heroCards: number[], trials: number): number {
  const heroSet = new Set(heroCards);
  const remaining47: number[] = [];
  for (let c = 0; c < 52; c++) {
    if (!heroSet.has(c)) remaining47.push(c);
  }

  const best2 = new Int32Array(52 * 52);
  const boardDeck = remaining47.slice();
  let wins = 0, ties = 0;

  for (let t = 0; t < trials; t++) {
    for (let i = 0; i < 10; i++) {
      const j = i + Math.floor(Math.random() * (47 - i));
      const tmp = boardDeck[i]; boardDeck[i] = boardDeck[j]; boardDeck[j] = tmp;
    }
    const b0 = boardDeck[0], b1 = boardDeck[1], b2 = boardDeck[2], b3 = boardDeck[3], b4 = boardDeck[4];
    const v0 = boardDeck[5], v1 = boardDeck[6], v2 = boardDeck[7], v3 = boardDeck[8], v4 = boardDeck[9];

    const board5 = [b0, b1, b2, b3, b4];
    const all10 = [b0, b1, b2, b3, b4, v0, v1, v2, v3, v4];
    const heroAndBoard = [...heroCards, ...board5];
    const unique = new Set([...heroAndBoard, ...all10]);
    const deckCards = [...unique];

    for (let i = 0; i < deckCards.length - 1; i++) {
      const ci = deckCards[i];
      for (let j = i + 1; j < deckCards.length; j++) {
        const cj = deckCards[j];
        let bv = 0;
        for (let bi = 0; bi < 10; bi++) {
          const v = eval5(ci, cj, board5[B3_I[bi]], board5[B3_J[bi]], board5[B3_K[bi]]);
          if (v > bv) bv = v;
        }
        best2[ci * 52 + cj] = bv;
        best2[cj * 52 + ci] = bv;
      }
    }

    const heroVal = bestHandValue(heroCards, best2);
    const villainVal = bestHandValue([v0, v1, v2, v3, v4], best2);

    if (heroVal > villainVal) wins++;
    else if (heroVal === villainVal) ties++;
  }

  return (wins + 0.5 * ties) / trials * 100;
}

let valueToIdx: Uint16Array;
let NUM_DISTINCT = 0;

function buildRankMapping(): void {
  const seen = new Set<number>();
  for (let i = 0; i < HR.length; i++) seen.add(HR[i]);
  const sorted = [...seen].sort((a, b) => a - b);
  NUM_DISTINCT = sorted.length;
  const maxVal = sorted[sorted.length - 1];
  valueToIdx = new Uint16Array(maxVal + 1);
  for (let i = 0; i < sorted.length; i++) valueToIdx[sorted[i]] = i;
}

function modeB_BiasedHistogram(heroCards: number[], numBoards: number): number {
  const heroSet = new Set(heroCards);
  const boardPool: number[] = [];
  for (let c = 0; c < 52; c++) {
    if (!heroSet.has(c)) boardPool.push(c);
  }

  buildRankMapping();

  const best2 = new Int32Array(52 * 52);
  const histogram = new Int32Array(NUM_DISTINCT);
  const cumLess = new Float64Array(NUM_DISTINCT);
  const deck47 = new Array<number>(47);
  let eqSum = 0;
  let boardCount = 0;

  for (let t = 0; t < numBoards; t++) {
    shuffle5(boardPool, 47);
    const board5 = [boardPool[0], boardPool[1], boardPool[2], boardPool[3], boardPool[4]];
    const boardSet = new Set(board5);

    let dLen = 0;
    for (let c = 0; c < 52; c++) {
      if (!boardSet.has(c)) deck47[dLen++] = c;
    }

    for (let i = 0; i < dLen - 1; i++) {
      const ci = deck47[i];
      for (let j = i + 1; j < dLen; j++) {
        const cj = deck47[j];
        let bv = 0;
        for (let bi = 0; bi < 10; bi++) {
          const v = eval5(ci, cj, board5[B3_I[bi]], board5[B3_J[bi]], board5[B3_K[bi]]);
          if (v > bv) bv = v;
        }
        best2[ci * 52 + cj] = bv;
        best2[cj * 52 + ci] = bv;
      }
    }

    histogram.fill(0);
    let totalHands = 0;

    for (let i = 0; i < dLen - 4; i++) {
      const ci = deck47[i];
      for (let j = i + 1; j < dLen - 3; j++) {
        const cj = deck47[j];
        const b2_ij = best2[ci * 52 + cj];
        for (let k = j + 1; k < dLen - 2; k++) {
          const ck = deck47[k];
          const b2_ik = best2[ci * 52 + ck];
          const b2_jk = best2[cj * 52 + ck];
          let mx3 = b2_ij;
          if (b2_ik > mx3) mx3 = b2_ik;
          if (b2_jk > mx3) mx3 = b2_jk;
          for (let l = k + 1; l < dLen - 1; l++) {
            const cl = deck47[l];
            const b2_il = best2[ci * 52 + cl];
            const b2_jl = best2[cj * 52 + cl];
            const b2_kl = best2[ck * 52 + cl];
            let mx4 = mx3;
            if (b2_il > mx4) mx4 = b2_il;
            if (b2_jl > mx4) mx4 = b2_jl;
            if (b2_kl > mx4) mx4 = b2_kl;
            for (let m = l + 1; m < dLen; m++) {
              const cm = deck47[m];
              let val = mx4;
              const a1 = best2[ci * 52 + cm]; if (a1 > val) val = a1;
              const a2 = best2[cj * 52 + cm]; if (a2 > val) val = a2;
              const a3 = best2[ck * 52 + cm]; if (a3 > val) val = a3;
              const a4 = best2[cl * 52 + cm]; if (a4 > val) val = a4;
              histogram[valueToIdx[val]]++;
              totalHands++;
            }
          }
        }
      }
    }

    let cum = 0;
    for (let v = 0; v < NUM_DISTINCT; v++) {
      cumLess[v] = cum;
      cum += histogram[v];
    }

    const heroVal = bestHandValue(heroCards, best2);
    const compIdx = valueToIdx[heroVal];
    const below = cumLess[compIdx];
    const tiesCount = histogram[compIdx] - 1;
    const eq = (below + 0.5 * tiesCount) / (totalHands - 1);
    eqSum += eq;
    boardCount++;
  }

  return (eqSum / boardCount) * 100;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Usage: npx tsx scripts/check_equity_vs_random.ts "Js Th 5d Tc 4c" [--trials N] [--boards N]');
    process.exit(1);
  }

  let handStr = '';
  let mcTrials = 1_000_000;
  let histBoards = 5000;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--trials' && i + 1 < args.length) {
      mcTrials = parseInt(args[++i], 10);
    } else if (args[i] === '--boards' && i + 1 < args.length) {
      histBoards = parseInt(args[++i], 10);
    } else {
      handStr = args[i];
    }
  }

  const parts = handStr.replace(/,/g, ' ').trim().split(/\s+/);
  let heroCards: number[];
  if (parts.length === 5) {
    heroCards = parts.map(parseCard);
  } else if (parts.length === 1 && parts[0].length === 10) {
    heroCards = [];
    const s = parts[0];
    for (let i = 0; i < 10; i += 2) {
      heroCards.push(parseCard(s.slice(i, i + 2)));
    }
  } else {
    console.error(`Expected 5 cards, got: "${handStr}"`);
    process.exit(1);
  }

  const cardSet = new Set(heroCards);
  if (cardSet.size !== 5) {
    console.error('Duplicate cards in hero hand!');
    process.exit(1);
  }

  console.log(`Hero: ${heroCards.map(cardName).join(' ')}`);
  console.log(`Hero cards (internal): [${heroCards.join(', ')}]`);
  console.log();

  console.log('Loading hand-ranks.bin...');
  initBinomial();
  loadHandRanks();

  console.log(`\n--- Mode A: Unbiased Monte Carlo (${mcTrials.toLocaleString()} trials) ---`);
  const t0 = Date.now();
  const eqA = modeA_Fast(heroCards, mcTrials);
  const tA = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`Equity (unbiased MC): ${eqA.toFixed(4)}%  (${tA}s)`);

  console.log(`\n--- Mode B: Biased Histogram (47-card pool, ${histBoards.toLocaleString()} boards) ---`);
  const t1 = Date.now();
  const eqB = modeB_BiasedHistogram(heroCards, histBoards);
  const tB = ((Date.now() - t1) / 1000).toFixed(1);
  console.log(`Equity (biased hist): ${eqB.toFixed(4)}%  (${tB}s)`);

  console.log(`\n--- Delta ---`);
  console.log(`Unbiased MC:   ${eqA.toFixed(4)}%`);
  console.log(`Biased hist:   ${eqB.toFixed(4)}%`);
  console.log(`Delta:         ${(eqB - eqA).toFixed(4)}% (positive = biased overstates hero equity)`);
  console.log(`Absolute diff: ${Math.abs(eqB - eqA).toFixed(4)}%`);
}

main();
