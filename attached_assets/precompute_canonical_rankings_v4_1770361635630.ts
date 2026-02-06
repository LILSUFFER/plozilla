/**
 * Offline precompute script for PLO5 canonical hand rankings (vs random hand).
 *
 * IMPORTANT:
 * - This script is OFFLINE ONLY. Do NOT import it from runtime server/client code.
 * - It produces a deployable static file: public/plo5_rankings_v4.json.gz
 *
 * How to run (from repo root):
 *   npm run precompute:rankings
 *
 * Output:
 *   public/plo5_rankings_v4.json.gz
 *
 * Notes:
 * - Uses the existing WASM evaluator (client/public/evaluator.wasm)
 *   and the existing 5-card hand rank lookup table (client/public/hand-ranks.bin)
 * - Computes equity via wasm.calculateVsRandom(TRIALS_PER_HAND) for each canonical hand class.
 */

import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";

const RANKINGS_VERSION = 4;
const EXPECTED_CANONICAL = 134459; // sanity check for PLO5 canonical classes
const TRIALS_PER_HAND = parseInt(process.env.TRIALS_PER_HAND || "10000", 10);
const OUT_PATH = process.env.OUT_PATH || "public/plo5_rankings_v4.json.gz";

interface WasmExports {
  init(): void;
  setPlayerHand(playerIdx: number, idx: number, card: number): void;
  setPlayerLen(playerIdx: number, len: number): void;
  setNumPlayers(n: number): void;
  buildDeck(usedMaskLow: number, usedMaskHigh: number): void;
  setSeed(s: number): void;
  setHandRank(index: number, rank: number): void;
  markTableLoaded(): void;
  isTableLoaded(): boolean;
  calculateVsRandom(numTrials: number): number;
  getWins(playerIdx: number): number;
  getTies(playerIdx: number): number;
  memory: WebAssembly.Memory;
}

const TABLE_SIZE = 2598960;

// Precompute suit permutations (24)
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

/**
 * Canonical key via suit relabeling (same logic as server/rankings-cache.ts)
 * Cards are encoded 0..51 where:
 *   rank = card >> 2 (0..12), suit = card & 3 (0..3)
 */
function canonicalKey(c0: number, c1: number, c2: number, c3: number, c4: number): string {
  let best0 = 99, best1 = 99, best2 = 99, best3 = 99, best4 = 99;

  for (let p = 0; p < 24; p++) {
    const perm = SUIT_PERMS[p];
    let t0 = (c0 >> 2) * 4 + perm[c0 & 3];
    let t1 = (c1 >> 2) * 4 + perm[c1 & 3];
    let t2 = (c2 >> 2) * 4 + perm[c2 & 3];
    let t3 = (c3 >> 2) * 4 + perm[c3 & 3];
    let t4 = (c4 >> 2) * 4 + perm[c4 & 3];

    // sort 5 ints (sorting network)
    if (t0 > t1) { const tmp = t0; t0 = t1; t1 = tmp; }
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    if (t2 > t3) { const tmp = t2; t2 = t3; t3 = tmp; }
    if (t3 > t4) { const tmp = t3; t3 = t4; t4 = tmp; }
    if (t0 > t1) { const tmp = t0; t0 = t1; t1 = tmp; }
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    if (t2 > t3) { const tmp = t2; t2 = t3; t3 = tmp; }
    if (t0 > t1) { const tmp = t0; t0 = t1; t1 = tmp; }
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    if (t0 > t1) { const tmp = t0; t0 = t1; t1 = tmp; }

    if (
      t0 < best0 ||
      (t0 === best0 &&
        (t1 < best1 ||
          (t1 === best1 &&
            (t2 < best2 || (t2 === best2 && (t3 < best3 || (t3 === best3 && t4 < best4)))))))
    ) {
      best0 = t0; best1 = t1; best2 = t2; best3 = t3; best4 = t4;
    }
  }

  return `${best0},${best1},${best2},${best3},${best4}`;
}

function enumerateCanonicalHands(): Map<string, { cards: number[]; comboCount: number }> {
  const canonMap = new Map<string, { cards: number[]; comboCount: number }>();

  for (let c0 = 0; c0 < 48; c0++) {
    for (let c1 = c0 + 1; c1 < 49; c1++) {
      for (let c2 = c1 + 1; c2 < 50; c2++) {
        for (let c3 = c2 + 1; c3 < 51; c3++) {
          for (let c4 = c3 + 1; c4 < 52; c4++) {
            const key = canonicalKey(c0, c1, c2, c3, c4);
            const entry = canonMap.get(key);
            if (entry) {
              entry.comboCount++;
            } else {
              const parts = key.split(",").map(Number);
              canonMap.set(key, { cards: parts, comboCount: 1 });
            }
          }
        }
      }
    }
  }

  return canonMap;
}

async function loadWasmServer(): Promise<WasmExports> {
  const wasmPath = path.join(process.cwd(), "client/public/evaluator.wasm");
  const wasmBytes = fs.readFileSync(wasmPath);

  const module = await WebAssembly.instantiate(wasmBytes, {
    env: {
      abort: () => console.error("WASM abort"),
      seed: () => Date.now(),
    },
  });

  const wasm = module.instance.exports as unknown as WasmExports;
  wasm.init();

  const tablePath = path.join(process.cwd(), "client/public/hand-ranks.bin");
  const tableBuffer = fs.readFileSync(tablePath);
  const tableData = new Uint32Array(tableBuffer.buffer, tableBuffer.byteOffset, tableBuffer.length / 4);

  if (tableData.length !== TABLE_SIZE) {
    throw new Error(`Lookup table size mismatch: expected ${TABLE_SIZE}, got ${tableData.length}`);
  }

  for (let i = 0; i < TABLE_SIZE; i++) {
    wasm.setHandRank(i, tableData[i]);
  }
  wasm.markTableLoaded();

  console.log("WASM evaluator loaded with lookup table.");
  return wasm;
}

function buildUsedMasks(cards: number[]): { low: number; high: number } {
  let usedLow = 0;
  let usedHigh = 0;
  for (const c of cards) {
    if (c < 32) usedLow |= 1 << c;
    else usedHigh |= 1 << (c - 32);
  }
  return { low: usedLow, high: usedHigh };
}

async function main() {
  console.log(`Precompute canonical PLO5 rankings v${RANKINGS_VERSION}`);
  console.log(`TRIALS_PER_HAND=${TRIALS_PER_HAND.toLocaleString()}`);
  console.log(`OUT_PATH=${OUT_PATH}`);

  const startTime = Date.now();

  console.log("Enumerating canonical hands (this can take a while)...");
  const enumStart = Date.now();
  const canonMap = enumerateCanonicalHands();
  console.log(
    `Enumeration complete: ${canonMap.size.toLocaleString()} canonical hands in ${(
      (Date.now() - enumStart) / 1000
    ).toFixed(1)}s`
  );

  if (canonMap.size !== EXPECTED_CANONICAL) {
    console.warn(
      `WARNING: expected ${EXPECTED_CANONICAL} canonical hands, got ${canonMap.size}. Continue anyway.`
    );
  }

  const keys: string[] = new Array(canonMap.size);
  const cards0 = new Int16Array(canonMap.size);
  const cards1 = new Int16Array(canonMap.size);
  const cards2 = new Int16Array(canonMap.size);
  const cards3 = new Int16Array(canonMap.size);
  const cards4 = new Int16Array(canonMap.size);
  const comboCounts = new Int32Array(canonMap.size);
  const equities = new Float32Array(canonMap.size);

  let idx = 0;
  for (const [key, val] of canonMap) {
    keys[idx] = key;
    cards0[idx] = val.cards[0];
    cards1[idx] = val.cards[1];
    cards2[idx] = val.cards[2];
    cards3[idx] = val.cards[3];
    cards4[idx] = val.cards[4];
    comboCounts[idx] = val.comboCount;
    idx++;
  }

  console.log("Loading WASM evaluator...");
  const wasm = await loadWasmServer();

  wasm.setNumPlayers(1);
  wasm.setPlayerLen(0, 5);
  wasm.setSeed(Date.now() & 0xffffffff);

  console.log("Computing equities for canonical hands...");
  let lastLog = Date.now();

  for (let i = 0; i < keys.length; i++) {
    const c = [cards0[i], cards1[i], cards2[i], cards3[i], cards4[i]].map(Number);

    wasm.setPlayerHand(0, 0, c[0]);
    wasm.setPlayerHand(0, 1, c[1]);
    wasm.setPlayerHand(0, 2, c[2]);
    wasm.setPlayerHand(0, 3, c[3]);
    wasm.setPlayerHand(0, 4, c[4]);

    const { low, high } = buildUsedMasks(c);
    wasm.buildDeck(low, high);
    wasm.calculateVsRandom(TRIALS_PER_HAND);

    const w = wasm.getWins(0);
    const t = wasm.getTies(0);
    equities[i] = ((w + t / 2) / TRIALS_PER_HAND) * 100.0;

    const now = Date.now();
    if (now - lastLog > 15000) {
      const pct = (((i + 1) / keys.length) * 100).toFixed(1);
      const elapsed = ((now - startTime) / 1000).toFixed(0);
      console.log(`Progress: ${(i + 1).toLocaleString()} / ${keys.length.toLocaleString()} (${pct}%) - ${elapsed}s elapsed`);
      lastLog = now;
    }
  }

  console.log("Sorting by equity desc to assign rank/percentile...");
  const order = new Uint32Array(keys.length);
  for (let i = 0; i < order.length; i++) order[i] = i;
  order.sort((a, b) => equities[b] - equities[a]);

  const rank = new Int32Array(keys.length);
  const percentile = new Float32Array(keys.length);
  for (let pos = 0; pos < order.length; pos++) {
    const i = order[pos];
    const r = pos + 1; // 1..N best->worst
    rank[i] = r;
    percentile[i] = ((pos) / (order.length - 1)) * 100.0; // 0 best .. 100 worst
  }

  console.log("Writing gzipped JSON...");
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });

  // Write as a single JSON object (easy to load). ~134k records -> big but OK when gzipped.
  const outObj = {
    version: RANKINGS_VERSION,
    trialsPerHand: TRIALS_PER_HAND,
    canonicalHands: keys.length,
    generatedAt: new Date().toISOString(),
    hands: keys.map((k, i) => ({
      hand_key: k,
      card0: cards0[i],
      card1: cards1[i],
      card2: cards2[i],
      card3: cards3[i],
      card4: cards4[i],
      combo_count: comboCounts[i],
      equity: Number(equities[i].toFixed(6)),
      rank: rank[i],
      percentile: Number(percentile[i].toFixed(6)),
    })),
  };

  const json = JSON.stringify(outObj);
  const gz = zlib.gzipSync(json, { level: 9 });
  fs.writeFileSync(OUT_PATH, gz);

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`Done. Wrote ${OUT_PATH} (${(gz.length / 1024 / 1024).toFixed(2)} MB gz). Total time: ${totalElapsed}s`);
}

main().catch((err) => {
  console.error("Precompute failed:", err);
  process.exit(1);
});