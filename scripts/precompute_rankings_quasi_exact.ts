/**
 * PLO5 Quasi-Exact Rankings — Offline Precompute Script (v2: Unbiased)
 *
 * ALGORITHM (Board-Centric Enumeration with MC Villain Sampling):
 *   1. Load Two Plus Two hand-ranks.bin (2,598,960-entry lookup table).
 *   2. Enumerate all 134,459 canonical (suit-isomorphic) PLO5 hands.
 *   3. For EVERY board (all C(52,5) = 2,598,960, or sampled subset):
 *      a. Compute best2[c0*52+c1] for each 2-card combo from remaining 47 cards.
 *         best2 = max over 10 board-3-card-subsets of eval5(2cards + 3boardCards).
 *      b. For each canonical hero (not overlapping board):
 *         - hero_value = max of 10 best2 lookups.
 *         - Build 42-card villain deck (47 non-board cards minus hero's 5 cards).
 *         - Sample K villain hands from the 42-card pool (Fisher-Yates).
 *         - Evaluate each villain (max of 10 best2 lookups), compare vs hero.
 *         - Accumulate win (1.0) / tie (0.5) / loss (0.0).
 *   4. Final equity = total_wins / total_samples. Sort → rank, percentile.
 *
 * VILLAIN HANDLING (Unbiased — No hero overlap):
 *   For each hero, villain is sampled from the CORRECT 42-card pool:
 *     52 total - 5 board cards - 5 hero cards = 42 remaining cards.
 *   This eliminates the systematic bias (~0.3-1.0%) from the old approach
 *   which used the full 47-card pool including hero's cards.
 *
 * ACCURACY:
 *   With full board enumeration (BOARD_SAMPLE_RATE=1.0) and VILLAIN_SAMPLES=1:
 *     Each hero gets ~1.53M independent villain samples (one per valid board).
 *     Standard deviation: ~0.04% — well within 0.15% target.
 *   With board sampling: VILLAIN_SAMPLES scales inversely to maintain accuracy.
 *
 * ADAPTIVE REFINEMENT:
 *   When BOARD_SAMPLE_RATE < 1.0:
 *     Pass 1: process boards at the given sample rate.
 *     Pass 2: identify hands with unstable ranks (close equity to neighbors),
 *             re-process with 10x more boards for those hands only.
 *   When BOARD_SAMPLE_RATE = 1.0: single pass, no noise to refine.
 *
 * COMPLEXITY:
 *   Per board: ~134K heroes × (47 deck-filter + 5×K shuffle + 10×K eval) ops.
 *   With K=1: ~10M ops/board vs ~17M for old histogram approach = ~1.7x faster.
 *   Estimated: ~15h single-threaded, ~4h with 4 workers (full enumeration, K=1).
 *
 * USAGE:
 *   npx tsx scripts/precompute_rankings_quasi_exact.ts
 *   BOARD_SAMPLE_RATE=0.01 npx tsx scripts/precompute_rankings_quasi_exact.ts
 *   NUM_WORKERS=4 VILLAIN_SAMPLES=1 npx tsx scripts/precompute_rankings_quasi_exact.ts
 */

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import * as os from 'os';
import { fileURLToPath } from 'url';

const __script_filename = typeof __filename !== 'undefined' ? __filename : fileURLToPath(import.meta.url);

const OUT_PATH = process.env.OUT_PATH || 'public/plo5_rankings_quasi_v1.json.gz';
const NUM_WORKERS = Math.max(1, parseInt(process.env.NUM_WORKERS || String(Math.min(4, os.cpus().length)), 10));
const BOARD_SAMPLE_RATE = Math.max(0.001, Math.min(1.0, parseFloat(process.env.BOARD_SAMPLE_RATE || '1.0')));
const VILLAIN_SAMPLES = Math.max(1, parseInt(process.env.VILLAIN_SAMPLES || String(Math.max(1, Math.ceil(0.1 / BOARD_SAMPLE_RATE))), 10));
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

const V2I = [0, 0, 0, 0, 1, 1, 1, 2, 2, 3];
const V2J = [1, 2, 3, 4, 2, 3, 4, 3, 4, 4];

interface ProcessResult {
  equitySums: Float64Array;
  sampleCounts: Int32Array;
  boardsProcessed: number;
}

function processBoards(
  b0Values: number[],
  canon: CanonData,
  sampleStep: number,
  focusedHeroes: Set<number> | null,
  villainSamples: number
): ProcessResult {
  const N = canon.count;
  const equitySums = new Float64Array(N);
  const sampleCounts = new Int32Array(N);
  let boardsProcessed = 0;
  let boardCounter = 0;

  const best2 = new Int32Array(52 * 52);
  const deck47 = new Int32Array(47);
  const deck42 = new Int32Array(42);

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

            for (let hi = 0; hi < N; hi++) {
              if (focusedHeroes && !focusedHeroes.has(hi)) continue;
              if ((canon.maskLow[hi] & bmL) !== 0 || (canon.maskHigh[hi] & bmH) !== 0) continue;

              let heroVal = 0;
              for (let si = 0; si < 10; si++) {
                const v = best2[heroSubsets[hi * 10 + si]];
                if (v > heroVal) heroVal = v;
              }

              let vLen = 0;
              for (let d = 0; d < dLen; d++) {
                const c = deck47[d];
                if (c < 32) {
                  if ((canon.maskLow[hi] & (1 << c)) !== 0) continue;
                } else {
                  if ((canon.maskHigh[hi] & (1 << (c - 32))) !== 0) continue;
                }
                deck42[vLen++] = c;
              }

              for (let k = 0; k < villainSamples; k++) {
                for (let i = 0; i < 5; i++) {
                  const j = i + Math.floor(Math.random() * (vLen - i));
                  const tmp = deck42[i]; deck42[i] = deck42[j]; deck42[j] = tmp;
                }

                let villainVal = 0;
                for (let si = 0; si < 10; si++) {
                  const ci = deck42[V2I[si]], cj = deck42[V2J[si]];
                  const key = ci < cj ? ci * 52 + cj : cj * 52 + ci;
                  const v = best2[key];
                  if (v > villainVal) villainVal = v;
                }

                if (heroVal > villainVal) equitySums[hi] += 1.0;
                else if (heroVal === villainVal) equitySums[hi] += 0.5;
                sampleCounts[hi]++;
              }
            }

            boardsProcessed++;
          }
        }
      }
    }
  }
  return { equitySums, sampleCounts, boardsProcessed };
}

// ============ WORKER ============
interface WorkerInput {
  b0Values: number[];
  canonCards: number[];
  canonMaskLow: number[];
  canonMaskHigh: number[];
  canonCount: number;
  sampleStep: number;
  villainSamples: number;
  focusedHeroes: number[] | null;
}

if (!isMainThread) {
  const wd = workerData as WorkerInput;
  initBinomial();
  loadHandRanks();

  const canon: CanonData = {
    keys: [],
    cards: new Int16Array(wd.canonCards),
    comboCounts: new Int32Array(wd.canonCount),
    maskLow: new Int32Array(wd.canonMaskLow),
    maskHigh: new Int32Array(wd.canonMaskHigh),
    count: wd.canonCount,
  };

  const focused = wd.focusedHeroes ? new Set(wd.focusedHeroes) : null;
  const result = processBoards(wd.b0Values, canon, wd.sampleStep, focused, wd.villainSamples);

  parentPort!.postMessage({
    type: 'result',
    equitySums: Array.from(result.equitySums),
    sampleCounts: Array.from(result.sampleCounts),
    boardsProcessed: result.boardsProcessed,
  });
}

// ============ MAIN ============
async function runWithWorkers(
  b0Values: number[],
  canon: CanonData,
  sampleStep: number,
  numWorkers: number,
  focusedHeroes: number[] | null,
  villainSamples: number
): Promise<ProcessResult> {
  const chunks: number[][] = Array.from({ length: numWorkers }, () => []);
  for (let i = 0; i < b0Values.length; i++) chunks[i % numWorkers].push(b0Values[i]);

  const canonCards = Array.from(canon.cards);
  const canonMaskLow = Array.from(canon.maskLow);
  const canonMaskHigh = Array.from(canon.maskHigh);

  const equitySums = new Float64Array(canon.count);
  const sampleCounts = new Int32Array(canon.count);
  let totalBoards = 0;

  const promises = chunks.filter(c => c.length > 0).map((chunk) => {
    return new Promise<void>((resolve, reject) => {
      const w = new Worker(__script_filename, {
        workerData: {
          b0Values: chunk,
          canonCards,
          canonMaskLow,
          canonMaskHigh,
          canonCount: canon.count,
          sampleStep,
          villainSamples,
          focusedHeroes,
        } as WorkerInput,
      });
      w.on('message', (msg: any) => {
        if (msg.type === 'result') {
          const es = msg.equitySums as number[];
          const sc = msg.sampleCounts as number[];
          for (let i = 0; i < canon.count; i++) {
            equitySums[i] += es[i];
            sampleCounts[i] += sc[i];
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
  return { equitySums, sampleCounts, boardsProcessed: totalBoards };
}

function runSingleThreaded(
  b0Values: number[],
  canon: CanonData,
  sampleStep: number,
  focusedHeroes: Set<number> | null,
  villainSamples: number
): ProcessResult {
  const startTime = Date.now();
  let lastLog = startTime;
  const totalB0 = b0Values.length;

  const equitySums = new Float64Array(canon.count);
  const sampleCounts = new Int32Array(canon.count);
  let totalBoards = 0;

  for (let bi = 0; bi < totalB0; bi++) {
    const chunk = [b0Values[bi]];
    const r = processBoards(chunk, canon, sampleStep, focusedHeroes, villainSamples);
    for (let i = 0; i < canon.count; i++) {
      equitySums[i] += r.equitySums[i];
      sampleCounts[i] += r.sampleCounts[i];
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
  return { equitySums, sampleCounts, boardsProcessed: totalBoards };
}

async function main() {
  console.log('=== PLO5 Quasi-Exact Rankings (v2: Unbiased MC Villain) ===');
  console.log(`OUT_PATH=${OUT_PATH}`);
  console.log(`BOARD_SAMPLE_RATE=${BOARD_SAMPLE_RATE}`);
  console.log(`VILLAIN_SAMPLES=${VILLAIN_SAMPLES}`);
  console.log(`NUM_WORKERS=${NUM_WORKERS}`);
  console.log(`REFINE_THRESHOLD=${REFINE_THRESHOLD}%`);
  const t0 = Date.now();

  console.log('Loading hand-ranks.bin...');
  initBinomial();
  loadHandRanks();

  console.log('Enumerating canonical hands...');
  const enumStart = Date.now();
  const canon = enumerateCanonicalHands();
  console.log(`${canon.count.toLocaleString()} canonical hands in ${((Date.now() - enumStart) / 1000).toFixed(1)}s`);
  if (canon.count !== EXPECTED_CANONICAL) console.warn(`WARNING: expected ${EXPECTED_CANONICAL}, got ${canon.count}`);

  const b0All = Array.from({ length: 48 }, (_, i) => i);
  const sampleStep = BOARD_SAMPLE_RATE < 1.0 ? Math.round(1 / BOARD_SAMPLE_RATE) : 1;

  console.log(`\n--- Pass 1: ${sampleStep > 1 ? `sampling 1/${sampleStep} boards` : 'all boards'}, ${VILLAIN_SAMPLES} villain sample(s)/board ---`);
  const pass1Start = Date.now();

  let result: ProcessResult;
  if (NUM_WORKERS > 1) {
    try {
      result = await runWithWorkers(b0All, canon, sampleStep, NUM_WORKERS, null, VILLAIN_SAMPLES);
      console.log(`Pass 1 done (${NUM_WORKERS} workers): ${result.boardsProcessed.toLocaleString()} boards in ${((Date.now() - pass1Start) / 1000).toFixed(1)}s`);
    } catch (err) {
      console.warn(`Worker threads failed (${err instanceof Error ? err.message : err}), falling back to single-threaded.`);
      result = runSingleThreaded(b0All, canon, sampleStep, null, VILLAIN_SAMPLES);
      console.log(`Pass 1 done (single-threaded): ${result.boardsProcessed.toLocaleString()} boards in ${((Date.now() - pass1Start) / 1000).toFixed(1)}s`);
    }
  } else {
    result = runSingleThreaded(b0All, canon, sampleStep, null, VILLAIN_SAMPLES);
    console.log(`Pass 1 done: ${result.boardsProcessed.toLocaleString()} boards in ${((Date.now() - pass1Start) / 1000).toFixed(1)}s`);
  }

  const equities = new Float64Array(canon.count);
  for (let i = 0; i < canon.count; i++) {
    equities[i] = result.sampleCounts[i] > 0 ? (result.equitySums[i] / result.sampleCounts[i]) * 100 : 0;
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
      const refineVillainSamples = Math.max(1, Math.ceil(0.1 / (1.0 / refineSampleStep)));
      console.log(`\n--- Pass 2 (adaptive): ${unstable.size.toLocaleString()} unstable hands, sampling 1/${refineSampleStep} boards, ${refineVillainSamples} villain sample(s) ---`);
      const pass2Start = Date.now();

      let pass2: ProcessResult;
      const focusedArr = [...unstable];
      if (NUM_WORKERS > 1) {
        try {
          pass2 = await runWithWorkers(b0All, canon, refineSampleStep, NUM_WORKERS, focusedArr, refineVillainSamples);
        } catch {
          pass2 = runSingleThreaded(b0All, canon, refineSampleStep, unstable, refineVillainSamples);
        }
      } else {
        pass2 = runSingleThreaded(b0All, canon, refineSampleStep, unstable, refineVillainSamples);
      }

      for (const hi of unstable) {
        if (pass2.sampleCounts[hi] > 0) {
          equities[hi] = (pass2.equitySums[hi] / pass2.sampleCounts[hi]) * 100;
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
    version: 2,
    method: 'quasi-exact-board-enum-mc-villain',
    boardSampleRate: BOARD_SAMPLE_RATE,
    villainSamplesPerBoard: VILLAIN_SAMPLES,
    samplesPerHand: result.sampleCounts[0],
    canonicalHands: canon.count,
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
