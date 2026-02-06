/**
 * PLO5 Quasi-Exact Rankings — Offline Precompute Script
 *
 * ALGORITHM (Board-Centric Enumeration with Histogram Aggregation):
 *   1. Load Two Plus Two hand-ranks.bin (2,598,960-entry lookup table).
 *   2. Build compact rank mapping: 7,462 distinct rank values → indices 0..7461.
 *   3. Enumerate all 134,459 canonical (suit-isomorphic) PLO5 hands.
 *   4. For EVERY board (all C(52,5) = 2,598,960, or sampled subset):
 *      a. Compute best2[c0*52+c1] for each 2-card combo from remaining 47 cards.
 *         best2 = max over 10 board-3-card-subsets of eval5(2cards + 3boardCards).
 *      b. Enumerate all C(47,5) = 1,533,939 five-card hands from remaining deck.
 *         hand_value = max over C(5,2)=10 two-card subsets of best2. (Incremental max.)
 *      c. Build compact histogram of hand values (7,462 bins).
 *      d. Build cumulative sum for O(1) equity lookup.
 *      e. For each canonical hero not overlapping with board:
 *         hero_value = max of 10 best2 lookups; equity from cumulative histogram.
 *   5. Final equity = average over all boards. Sort → rank, percentile.
 *
 * VILLAIN HANDLING (CRN — Common Random Numbers):
 *   All 1,533,939 possible hands on each board are evaluated (full 47-card pool).
 *   Every hero is compared against the SAME histogram per board = CRN.
 *   Approximation: hero's 5 cards included in the pool (~0.3% bias, systematic, not random).
 *   Far more accurate than MC with any feasible trial count.
 *
 * ADAPTIVE REFINEMENT:
 *   When BOARD_SAMPLE_RATE < 1.0:
 *     Pass 1: process boards at the given sample rate.
 *     Pass 2: identify hands with unstable ranks (close equity to neighbors),
 *             re-process with 10x more boards for those hands only.
 *   When BOARD_SAMPLE_RATE = 1.0: single pass, no noise to refine.
 *
 * COMPLEXITY:
 *   Per board: ~15.4M array lookups (hand enum) + ~134K hero lookups.
 *   Total (all boards): ~40 trillion lookups.
 *   Estimated: ~30h single-threaded, ~8h with 4 workers.
 *   With BOARD_SAMPLE_RATE=0.01: ~18 minutes single-threaded.
 *
 * EQUITY FORMULA (with tie handling):
 *   eq = (cumLess[heroIdx] + 0.5 * (histogram[heroIdx] - 1)) / (totalHands - 1)
 *   where cumLess = hands strictly worse than hero, histogram[heroIdx]-1 = tied villains
 *   (excluding hero itself from both count and total since villain pool includes hero overlap).
 *
 * USAGE:
 *   npx tsx scripts/precompute_rankings_quasi_exact.ts
 *   BOARD_SAMPLE_RATE=0.01 npx tsx scripts/precompute_rankings_quasi_exact.ts   # quick test (~18 min)
 *   NUM_WORKERS=4 npx tsx scripts/precompute_rankings_quasi_exact.ts             # parallel
 */

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import * as os from 'os';

const OUT_PATH = process.env.OUT_PATH || 'public/plo5_rankings_quasi_v1.json.gz';
const NUM_WORKERS = Math.max(1, parseInt(process.env.NUM_WORKERS || String(Math.min(4, os.cpus().length)), 10));
const BOARD_SAMPLE_RATE = Math.max(0.001, Math.min(1.0, parseFloat(process.env.BOARD_SAMPLE_RATE || '1.0')));
const REFINE_THRESHOLD = parseFloat(process.env.REFINE_THRESHOLD || '0.15');
const EXPECTED_CANONICAL = 134459;

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

let valueToIdx: Uint16Array;
let idxToValue: Int32Array;
let NUM_DISTINCT = 0;

function buildRankMapping(): void {
  const seen = new Set<number>();
  for (let i = 0; i < HR.length; i++) seen.add(HR[i]);
  const sorted = [...seen].sort((a, b) => a - b);
  NUM_DISTINCT = sorted.length;
  idxToValue = new Int32Array(sorted);
  const maxVal = sorted[sorted.length - 1];
  valueToIdx = new Uint16Array(maxVal + 1);
  for (let i = 0; i < sorted.length; i++) valueToIdx[sorted[i]] = i;
}

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

function canonicalKey(c0: number, c1: number, c2: number, c3: number, c4: number): string {
  let best0 = 99, best1 = 99, best2x = 99, best3 = 99, best4 = 99;
  for (let p = 0; p < 24; p++) {
    const pm = SUIT_PERMS[p];
    let t0 = (c0 >> 2) * 4 + pm[c0 & 3];
    let t1 = (c1 >> 2) * 4 + pm[c1 & 3];
    let t2 = (c2 >> 2) * 4 + pm[c2 & 3];
    let t3 = (c3 >> 2) * 4 + pm[c3 & 3];
    let t4 = (c4 >> 2) * 4 + pm[c4 & 3];
    if (t0 > t1) { const x = t0; t0 = t1; t1 = x; }
    if (t1 > t2) { const x = t1; t1 = t2; t2 = x; }
    if (t2 > t3) { const x = t2; t2 = t3; t3 = x; }
    if (t3 > t4) { const x = t3; t3 = t4; t4 = x; }
    if (t0 > t1) { const x = t0; t0 = t1; t1 = x; }
    if (t1 > t2) { const x = t1; t1 = t2; t2 = x; }
    if (t2 > t3) { const x = t2; t2 = t3; t3 = x; }
    if (t0 > t1) { const x = t0; t0 = t1; t1 = x; }
    if (t1 > t2) { const x = t1; t1 = t2; t2 = x; }
    if (t0 > t1) { const x = t0; t0 = t1; t1 = x; }
    if (
      t0 < best0 ||
      (t0 === best0 && (t1 < best1 || (t1 === best1 && (t2 < best2x || (t2 === best2x && (t3 < best3 || (t3 === best3 && t4 < best4)))))))
    ) {
      best0 = t0; best1 = t1; best2x = t2; best3 = t3; best4 = t4;
    }
  }
  return `${best0},${best1},${best2x},${best3},${best4}`;
}

interface CanonData {
  keys: string[];
  cards: Int16Array;
  comboCounts: Int32Array;
  maskLow: Int32Array;
  maskHigh: Int32Array;
  count: number;
}

function enumerateCanonicalHands(): CanonData {
  const canonMap = new Map<string, { cards: number[]; comboCount: number }>();
  for (let c0 = 0; c0 < 48; c0++)
    for (let c1 = c0 + 1; c1 < 49; c1++)
      for (let c2 = c1 + 1; c2 < 50; c2++)
        for (let c3 = c2 + 1; c3 < 51; c3++)
          for (let c4 = c3 + 1; c4 < 52; c4++) {
            const key = canonicalKey(c0, c1, c2, c3, c4);
            const e = canonMap.get(key);
            if (e) e.comboCount++;
            else canonMap.set(key, { cards: key.split(',').map(Number), comboCount: 1 });
          }

  const N = canonMap.size;
  const keys: string[] = [];
  const cards = new Int16Array(N * 5);
  const comboCounts = new Int32Array(N);
  const maskLow = new Int32Array(N);
  const maskHigh = new Int32Array(N);

  let idx = 0;
  for (const [key, val] of canonMap) {
    keys.push(key);
    for (let i = 0; i < 5; i++) cards[idx * 5 + i] = val.cards[i];
    comboCounts[idx] = val.comboCount;
    let ml = 0, mh = 0;
    for (const c of val.cards) {
      if (c < 32) ml |= 1 << c; else mh |= 1 << (c - 32);
    }
    maskLow[idx] = ml;
    maskHigh[idx] = mh;
    idx++;
  }
  return { keys, cards, comboCounts, maskLow, maskHigh, count: N };
}

const B3_I = [0, 0, 0, 0, 0, 0, 1, 1, 1, 2];
const B3_J = [1, 1, 1, 2, 2, 3, 2, 2, 3, 3];
const B3_K = [2, 3, 4, 3, 4, 4, 3, 4, 4, 4];

interface ProcessResult {
  equitySums: Float64Array;
  boardCounts: Int32Array;
  boardsProcessed: number;
}

function processBoards(
  b0Values: number[],
  canon: CanonData,
  sampleStep: number,
  focusedHeroes: Set<number> | null
): ProcessResult {
  const N = canon.count;
  const equitySums = new Float64Array(N);
  const boardCounts = new Int32Array(N);
  let boardsProcessed = 0;
  let boardCounter = 0;

  const best2 = new Int32Array(52 * 52);
  const deck47 = new Int32Array(47);
  const histogram = new Int32Array(NUM_DISTINCT);
  const cumLess = new Float64Array(NUM_DISTINCT);

  const heroSubsets = new Int32Array(N * 10);
  const H2I = [0, 0, 0, 0, 1, 1, 1, 2, 2, 3];
  const H2J = [1, 2, 3, 4, 2, 3, 4, 3, 4, 4];
  for (let hi = 0; hi < N; hi++) {
    const base = hi * 5;
    for (let si = 0; si < 10; si++) {
      const ci = canon.cards[base + H2I[si]];
      const cj = canon.cards[base + H2J[si]];
      heroSubsets[hi * 10 + si] = ci < cj ? ci * 52 + cj : cj * 52 + ci;
    }
  }

  for (const b0 of b0Values) {
    for (let b1 = b0 + 1; b1 < 49; b1++) {
      for (let b2 = b1 + 1; b2 < 50; b2++) {
        for (let b3 = b2 + 1; b3 < 51; b3++) {
          for (let b4 = b3 + 1; b4 < 52; b4++) {
            if (sampleStep > 1 && boardCounter++ % sampleStep !== 0) continue;

            let bmL = 0, bmH = 0;
            if (b0 < 32) bmL |= 1 << b0; else bmH |= 1 << (b0 - 32);
            if (b1 < 32) bmL |= 1 << b1; else bmH |= 1 << (b1 - 32);
            if (b2 < 32) bmL |= 1 << b2; else bmH |= 1 << (b2 - 32);
            if (b3 < 32) bmL |= 1 << b3; else bmH |= 1 << (b3 - 32);
            if (b4 < 32) bmL |= 1 << b4; else bmH |= 1 << (b4 - 32);

            let dLen = 0;
            for (let c = 0; c < 52; c++) {
              const inB = c < 32 ? (bmL & (1 << c)) !== 0 : (bmH & (1 << (c - 32))) !== 0;
              if (!inB) deck47[dLen++] = c;
            }

            const board5 = [b0, b1, b2, b3, b4];
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
              }
            }

            histogram.fill(0);
            let totalHands = 0;

            for (let i = 0; i < dLen - 4; i++) {
              const ci = deck47[i];
              const rowI = ci * 52;
              for (let j = i + 1; j < dLen - 3; j++) {
                const cj = deck47[j];
                const rowJ = cj * 52;
                const b2_ij = best2[rowI + cj];
                for (let k = j + 1; k < dLen - 2; k++) {
                  const ck = deck47[k];
                  const rowK = ck * 52;
                  const b2_ik = best2[rowI + ck];
                  const b2_jk = best2[rowJ + ck];
                  let mx3 = b2_ij;
                  if (b2_ik > mx3) mx3 = b2_ik;
                  if (b2_jk > mx3) mx3 = b2_jk;
                  for (let l = k + 1; l < dLen - 1; l++) {
                    const cl = deck47[l];
                    const rowL = cl * 52;
                    const b2_il = best2[rowI + cl];
                    const b2_jl = best2[rowJ + cl];
                    const b2_kl = best2[rowK + cl];
                    let mx4 = mx3;
                    if (b2_il > mx4) mx4 = b2_il;
                    if (b2_jl > mx4) mx4 = b2_jl;
                    if (b2_kl > mx4) mx4 = b2_kl;
                    for (let m = l + 1; m < dLen; m++) {
                      const cm = deck47[m];
                      let val = mx4;
                      const a1 = best2[rowI + cm]; if (a1 > val) val = a1;
                      const a2 = best2[rowJ + cm]; if (a2 > val) val = a2;
                      const a3 = best2[rowK + cm]; if (a3 > val) val = a3;
                      const a4 = best2[rowL + cm]; if (a4 > val) val = a4;
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

            for (let hi = 0; hi < N; hi++) {
              if (focusedHeroes && !focusedHeroes.has(hi)) continue;
              if ((canon.maskLow[hi] & bmL) !== 0 || (canon.maskHigh[hi] & bmH) !== 0) continue;

              let heroVal = 0;
              for (let si = 0; si < 10; si++) {
                const v = best2[heroSubsets[hi * 10 + si]];
                if (v > heroVal) heroVal = v;
              }

              const compIdx = valueToIdx[heroVal];
              const below = cumLess[compIdx];
              const ties = histogram[compIdx] - 1;
              const eq = (below + 0.5 * ties) / (totalHands - 1);
              equitySums[hi] += eq;
              boardCounts[hi]++;
            }

            boardsProcessed++;
          }
        }
      }
    }
  }
  return { equitySums, boardCounts, boardsProcessed };
}

// ============ WORKER ============
interface WorkerInput {
  b0Values: number[];
  canonCards: number[];
  canonMaskLow: number[];
  canonMaskHigh: number[];
  canonCount: number;
  sampleStep: number;
  focusedHeroes: number[] | null;
}

if (!isMainThread) {
  const wd = workerData as WorkerInput;
  initBinomial();
  loadHandRanks();
  buildRankMapping();

  const canon: CanonData = {
    keys: [],
    cards: new Int16Array(wd.canonCards),
    comboCounts: new Int32Array(wd.canonCount),
    maskLow: new Int32Array(wd.canonMaskLow),
    maskHigh: new Int32Array(wd.canonMaskHigh),
    count: wd.canonCount,
  };

  const focused = wd.focusedHeroes ? new Set(wd.focusedHeroes) : null;

  let lastProgress = Date.now();
  const origProcess = processBoards;
  const result = origProcess(wd.b0Values, canon, wd.sampleStep, focused);

  parentPort!.postMessage({
    type: 'result',
    equitySums: Array.from(result.equitySums),
    boardCounts: Array.from(result.boardCounts),
    boardsProcessed: result.boardsProcessed,
  });
}

// ============ MAIN ============
async function runWithWorkers(
  b0Values: number[],
  canon: CanonData,
  sampleStep: number,
  numWorkers: number,
  focusedHeroes: number[] | null
): Promise<ProcessResult> {
  const chunks: number[][] = Array.from({ length: numWorkers }, () => []);
  for (let i = 0; i < b0Values.length; i++) chunks[i % numWorkers].push(b0Values[i]);

  const canonCards = Array.from(canon.cards);
  const canonMaskLow = Array.from(canon.maskLow);
  const canonMaskHigh = Array.from(canon.maskHigh);

  const equitySums = new Float64Array(canon.count);
  const boardCounts = new Int32Array(canon.count);
  let totalBoards = 0;

  const promises = chunks.filter(c => c.length > 0).map((chunk) => {
    return new Promise<void>((resolve, reject) => {
      const w = new Worker(__filename, {
        workerData: {
          b0Values: chunk,
          canonCards,
          canonMaskLow,
          canonMaskHigh,
          canonCount: canon.count,
          sampleStep,
          focusedHeroes,
        } as WorkerInput,
      });
      w.on('message', (msg: any) => {
        if (msg.type === 'result') {
          const es = msg.equitySums as number[];
          const bc = msg.boardCounts as number[];
          for (let i = 0; i < canon.count; i++) {
            equitySums[i] += es[i];
            boardCounts[i] += bc[i];
          }
          totalBoards += msg.boardsProcessed;
        }
      });
      w.on('error', reject);
      w.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Worker exited with code ${code}`));
      });
    });
  });

  await Promise.all(promises);
  return { equitySums, boardCounts, boardsProcessed: totalBoards };
}

function runSingleThreaded(
  b0Values: number[],
  canon: CanonData,
  sampleStep: number,
  focusedHeroes: Set<number> | null
): ProcessResult {
  const startTime = Date.now();
  let lastLog = startTime;
  const totalB0 = b0Values.length;

  const equitySums = new Float64Array(canon.count);
  const boardCounts = new Int32Array(canon.count);
  let totalBoards = 0;

  for (let bi = 0; bi < totalB0; bi++) {
    const chunk = [b0Values[bi]];
    const r = processBoards(chunk, canon, sampleStep, focusedHeroes);
    for (let i = 0; i < canon.count; i++) {
      equitySums[i] += r.equitySums[i];
      boardCounts[i] += r.boardCounts[i];
    }
    totalBoards += r.boardsProcessed;

    const now = Date.now();
    if (now - lastLog > 15000) {
      const pct = (((bi + 1) / totalB0) * 100).toFixed(1);
      const elapsed = ((now - startTime) / 1000).toFixed(0);
      const rate = totalBoards / ((now - startTime) / 1000);
      const estTotal = 2598960 * BOARD_SAMPLE_RATE;
      const eta = ((estTotal - totalBoards) / rate).toFixed(0);
      console.log(`  Pass progress: b0=${bi + 1}/${totalB0} (${pct}%), boards=${totalBoards.toLocaleString()}, ${elapsed}s elapsed, ETA ~${eta}s`);
      lastLog = now;
    }
  }
  return { equitySums, boardCounts, boardsProcessed: totalBoards };
}

async function main() {
  console.log('=== PLO5 Quasi-Exact Rankings ===');
  console.log(`OUT_PATH=${OUT_PATH}`);
  console.log(`BOARD_SAMPLE_RATE=${BOARD_SAMPLE_RATE}`);
  console.log(`NUM_WORKERS=${NUM_WORKERS}`);
  console.log(`REFINE_THRESHOLD=${REFINE_THRESHOLD}%`);
  const t0 = Date.now();

  console.log('Loading hand-ranks.bin...');
  initBinomial();
  loadHandRanks();
  buildRankMapping();
  console.log(`Rank mapping: ${NUM_DISTINCT} distinct values, max=${idxToValue[NUM_DISTINCT - 1]}`);

  console.log('Enumerating canonical hands...');
  const enumStart = Date.now();
  const canon = enumerateCanonicalHands();
  console.log(`${canon.count.toLocaleString()} canonical hands in ${((Date.now() - enumStart) / 1000).toFixed(1)}s`);
  if (canon.count !== EXPECTED_CANONICAL) console.warn(`WARNING: expected ${EXPECTED_CANONICAL}, got ${canon.count}`);

  const b0All = Array.from({ length: 48 }, (_, i) => i);
  const sampleStep = BOARD_SAMPLE_RATE < 1.0 ? Math.round(1 / BOARD_SAMPLE_RATE) : 1;

  console.log(`\n--- Pass 1: ${sampleStep > 1 ? `sampling 1/${sampleStep} boards` : 'all boards'} ---`);
  const pass1Start = Date.now();

  let result: ProcessResult;
  if (NUM_WORKERS > 1) {
    try {
      result = await runWithWorkers(b0All, canon, sampleStep, NUM_WORKERS, null);
      console.log(`Pass 1 done (${NUM_WORKERS} workers): ${result.boardsProcessed.toLocaleString()} boards in ${((Date.now() - pass1Start) / 1000).toFixed(1)}s`);
    } catch (err) {
      console.warn(`Worker threads failed (${err instanceof Error ? err.message : err}), falling back to single-threaded.`);
      result = runSingleThreaded(b0All, canon, sampleStep, null);
      console.log(`Pass 1 done (single-threaded): ${result.boardsProcessed.toLocaleString()} boards in ${((Date.now() - pass1Start) / 1000).toFixed(1)}s`);
    }
  } else {
    result = runSingleThreaded(b0All, canon, sampleStep, null);
    console.log(`Pass 1 done: ${result.boardsProcessed.toLocaleString()} boards in ${((Date.now() - pass1Start) / 1000).toFixed(1)}s`);
  }

  const equities = new Float64Array(canon.count);
  for (let i = 0; i < canon.count; i++) {
    equities[i] = result.boardCounts[i] > 0 ? (result.equitySums[i] / result.boardCounts[i]) * 100 : 0;
  }

  // --- Adaptive refinement ---
  if (sampleStep > 1 && REFINE_THRESHOLD > 0) {
    const orderP1 = Array.from({ length: canon.count }, (_, i) => i);
    orderP1.sort((a, b) => equities[b] - equities[a]);

    const unstable = new Set<number>();
    for (let pos = 0; pos < orderP1.length - 1; pos++) {
      const gap = Math.abs(equities[orderP1[pos]] - equities[orderP1[pos + 1]]);
      if (gap < REFINE_THRESHOLD) {
        unstable.add(orderP1[pos]);
        unstable.add(orderP1[pos + 1]);
      }
    }

    const maxUnstable = Math.floor(canon.count * 0.3);
    if (unstable.size > maxUnstable) {
      console.log(`\nAdaptive: ${unstable.size.toLocaleString()} unstable hands (>${(maxUnstable / canon.count * 100).toFixed(0)}% of total) — sample rate too low for meaningful refinement, skipping Pass 2.`);
    } else if (unstable.size > 0) {
      const refineSampleStep = Math.max(1, Math.round(sampleStep / 10));
      console.log(`\n--- Pass 2 (adaptive): ${unstable.size.toLocaleString()} unstable hands, sampling 1/${refineSampleStep} boards ---`);
      const pass2Start = Date.now();

      let pass2: ProcessResult;
      const focusedArr = [...unstable];
      if (NUM_WORKERS > 1) {
        try {
          pass2 = await runWithWorkers(b0All, canon, refineSampleStep, NUM_WORKERS, focusedArr);
        } catch {
          pass2 = runSingleThreaded(b0All, canon, refineSampleStep, unstable);
        }
      } else {
        pass2 = runSingleThreaded(b0All, canon, refineSampleStep, unstable);
      }

      for (const hi of unstable) {
        if (pass2.boardCounts[hi] > 0) {
          equities[hi] = (pass2.equitySums[hi] / pass2.boardCounts[hi]) * 100;
        }
      }
      console.log(`Pass 2 done: ${pass2.boardsProcessed.toLocaleString()} boards in ${((Date.now() - pass2Start) / 1000).toFixed(1)}s`);
    } else {
      console.log('No unstable hands detected — skipping Pass 2.');
    }
  }

  console.log('\nComputing final rankings...');
  const order = Array.from({ length: canon.count }, (_, i) => i);
  order.sort((a, b) => equities[b] - equities[a]);

  const ranks = new Int32Array(canon.count);
  const percentiles = new Float64Array(canon.count);
  for (let pos = 0; pos < order.length; pos++) {
    const i = order[pos];
    ranks[i] = pos + 1;
    percentiles[i] = (pos / (order.length - 1)) * 100;
  }

  console.log('Writing output...');
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });

  const outObj = {
    version: 1,
    method: 'quasi-exact-board-enum-histogram',
    boardSampleRate: BOARD_SAMPLE_RATE,
    boardsPerHand: result.boardCounts[0],
    canonicalHands: canon.count,
    distinctRanks: NUM_DISTINCT,
    generatedAt: new Date().toISOString(),
    hands: order.map((i) => ({
      hand_key: canon.keys[i],
      card0: canon.cards[i * 5],
      card1: canon.cards[i * 5 + 1],
      card2: canon.cards[i * 5 + 2],
      card3: canon.cards[i * 5 + 3],
      card4: canon.cards[i * 5 + 4],
      combo_count: canon.comboCounts[i],
      equity: Number(equities[i].toFixed(6)),
      rank: ranks[i],
      percentile: Number(percentiles[i].toFixed(6)),
    })),
  };

  const json = JSON.stringify(outObj);
  const gz = zlib.gzipSync(json, { level: 9 });
  fs.writeFileSync(OUT_PATH, gz);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(`\nDone. ${OUT_PATH} (${(gz.length / 1024 / 1024).toFixed(2)} MB). Total: ${elapsed}s`);
  console.log(`Top 5: ${order.slice(0, 5).map(i => `${canon.keys[i]} ${equities[i].toFixed(2)}%`).join(', ')}`);
  console.log(`Bottom 5: ${order.slice(-5).map(i => `${canon.keys[i]} ${equities[i].toFixed(2)}%`).join(', ')}`);
}

if (isMainThread) {
  main().catch((err) => {
    console.error('FATAL:', err);
    process.exit(1);
  });
}
