/**
 * Validation script: compares quasi-exact rankings against high-MC for sample hands.
 * Loads hand-ranks.bin, picks a handful of canonical hands, runs 200K MC trials each,
 * then compares to the quasi-exact results from the rankings file.
 *
 * Usage: npx tsx scripts/validate_rankings.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

const BINOMIAL = new Int32Array(52 * 6);
function initBinomial(): void {
  for (let n = 0; n < 52; n++) BINOMIAL[n * 6] = 1;
  for (let n = 1; n < 52; n++)
    for (let k = 1; k <= Math.min(n, 5); k++)
      BINOMIAL[n * 6 + k] = BINOMIAL[(n - 1) * 6 + (k - 1)] + BINOMIAL[(n - 1) * 6 + k];
}

let HR: Int32Array;
function loadHandRanks(): void {
  const buf = fs.readFileSync(path.join(process.cwd(), 'client/public/hand-ranks.bin'));
  HR = new Int32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}

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

const H2I = [0, 0, 0, 0, 1, 1, 1, 2, 2, 3];
const H2J = [1, 2, 3, 4, 2, 3, 4, 3, 4, 4];
const B3I = [0, 0, 0, 0, 0, 0, 1, 1, 1, 2];
const B3J = [1, 1, 1, 2, 2, 3, 2, 2, 3, 3];
const B3K = [2, 3, 4, 3, 4, 4, 3, 4, 4, 4];

function evalPLO5(hand: number[], board: number[]): number {
  let best = 0;
  for (let hi = 0; hi < 10; hi++) {
    const h0 = hand[H2I[hi]], h1 = hand[H2J[hi]];
    for (let bi = 0; bi < 10; bi++) {
      const v = eval5(h0, h1, board[B3I[bi]], board[B3J[bi]], board[B3K[bi]]);
      if (v > best) best = v;
    }
  }
  return best;
}

function mcEquity(hand: number[], trials: number): number {
  const handSet = new Set(hand);
  const deck: number[] = [];
  for (let c = 0; c < 52; c++) if (!handSet.has(c)) deck.push(c);

  let wins = 0, ties = 0;
  let seed = 42;
  function rng() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed; }

  for (let t = 0; t < trials; t++) {
    for (let i = 0; i < 10; i++) {
      const j = i + (rng() % (deck.length - i));
      const tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
    }
    const board = [deck[0], deck[1], deck[2], deck[3], deck[4]];
    const villain = [deck[5], deck[6], deck[7], deck[8], deck[9]];
    const heroVal = evalPLO5(hand, board);
    const villainVal = evalPLO5(villain, board);
    if (heroVal > villainVal) wins++;
    else if (heroVal === villainVal) ties++;
  }
  return ((wins + 0.5 * ties) / trials) * 100;
}

const RANK_NAMES = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const SUIT_NAMES = ['s', 'h', 'd', 'c'];
function cardStr(c: number): string { return RANK_NAMES[c >> 2] + SUIT_NAMES[c & 3]; }
function handStr(cards: number[]): string { return cards.map(cardStr).join(''); }

function main() {
  console.log('Validation: Quasi-Exact vs Monte Carlo (200K trials)\n');
  initBinomial();
  loadHandRanks();

  const quasiFile = path.join(process.cwd(), 'public', 'plo5_rankings_quasi_v1.json.gz');
  let quasiData: Map<string, number> | null = null;
  if (fs.existsSync(quasiFile)) {
    const json = zlib.gunzipSync(fs.readFileSync(quasiFile)).toString('utf-8');
    const data = JSON.parse(json);
    quasiData = new Map();
    for (const h of data.hands) {
      quasiData.set(h.hand_key, h.equity);
    }
    console.log(`Loaded quasi-exact file: ${data.hands.length} hands, method=${data.method}, sampleRate=${data.boardSampleRate}\n`);
  } else {
    console.log('No quasi-exact file found. Will only show MC results.\n');
  }

  const testHands: { name: string; cards: number[] }[] = [
    { name: 'AAKKds', cards: [48, 49, 44, 45, 40] },
    { name: 'AAKK-rainbow', cards: [48, 49, 44, 46, 40] },
    { name: '23456-rainbow', cards: [0, 4, 8, 12, 17] },
    { name: 'AAQJT-ds', cards: [48, 49, 40, 36, 33] },
    { name: 'KK987-ss', cards: [44, 45, 28, 24, 20] },
    { name: '22345-rainbow', cards: [0, 1, 4, 8, 13] },
    { name: 'AKQJT-ds', cards: [48, 45, 40, 37, 32] },
    { name: 'TT998', cards: [32, 33, 28, 29, 24] },
  ];

  const SUIT_PERMS: number[][] = [];
  for (let a = 0; a < 4; a++)
    for (let b = 0; b < 4; b++) {
      if (b === a) continue;
      for (let c = 0; c < 4; c++) {
        if (c === a || c === b) continue;
        for (let d = 0; d < 4; d++) {
          if (d === a || d === b || d === c) continue;
          SUIT_PERMS.push([a, b, c, d]);
        }
      }
    }

  function canonicalKey(cards: number[]): string {
    let best = [99, 99, 99, 99, 99];
    for (const pm of SUIT_PERMS) {
      const mapped = cards.map(c => (c >> 2) * 4 + pm[c & 3]).sort((a, b) => a - b);
      for (let i = 0; i < 5; i++) {
        if (mapped[i] < best[i]) { best = mapped; break; }
        if (mapped[i] > best[i]) break;
      }
    }
    return best.join(',');
  }

  console.log('Hand'.padEnd(20) + 'MC(200K)'.padStart(10) + 'Quasi-Exact'.padStart(14) + 'Diff'.padStart(8));
  console.log('-'.repeat(52));

  for (const th of testHands) {
    const mcEq = mcEquity(th.cards, 200000);
    const key = canonicalKey(th.cards);
    const qeEq = quasiData?.get(key);

    const mcStr = mcEq.toFixed(2) + '%';
    const qeStr = qeEq !== undefined ? qeEq.toFixed(2) + '%' : 'N/A';
    const diff = qeEq !== undefined ? (qeEq - mcEq).toFixed(2) + '%' : 'N/A';

    console.log(
      `${th.name} (${handStr(th.cards)})`.padEnd(20) +
      mcStr.padStart(10) +
      qeStr.padStart(14) +
      diff.padStart(8)
    );
  }
  console.log();
}

main();
