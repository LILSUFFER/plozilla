import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import pg from 'pg';

const RANKINGS_VERSION = 4;
const TRIALS_PER_HAND = 10000;
const TABLE_SIZE = 2598960;
const BATCH_SIZE = 100;

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
  let best0 = 99, best1 = 99, best2 = 99, best3 = 99, best4 = 99;
  for (let p = 0; p < 24; p++) {
    const perm = SUIT_PERMS[p];
    let t0 = (c0 >> 2) * 4 + perm[c0 & 3];
    let t1 = (c1 >> 2) * 4 + perm[c1 & 3];
    let t2 = (c2 >> 2) * 4 + perm[c2 & 3];
    let t3 = (c3 >> 2) * 4 + perm[c3 & 3];
    let t4 = (c4 >> 2) * 4 + perm[c4 & 3];
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
    if (t0 < best0 || (t0 === best0 && (t1 < best1 || (t1 === best1 && (t2 < best2 || (t2 === best2 && (t3 < best3 || (t3 === best3 && t4 < best4)))))))) {
      best0 = t0; best1 = t1; best2 = t2; best3 = t3; best4 = t4;
    }
  }
  return `${best0},${best1},${best2},${best3},${best4}`;
}

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

function enumerateCanonicalHands(): Map<string, { cards: number[]; count: number }> {
  const canonMap = new Map<string, { cards: number[]; count: number }>();
  for (let c0 = 0; c0 < 48; c0++) {
    for (let c1 = c0 + 1; c1 < 49; c1++) {
      for (let c2 = c1 + 1; c2 < 50; c2++) {
        for (let c3 = c2 + 1; c3 < 51; c3++) {
          for (let c4 = c3 + 1; c4 < 52; c4++) {
            const key = canonicalKey(c0, c1, c2, c3, c4);
            const entry = canonMap.get(key);
            if (entry) {
              entry.count++;
            } else {
              const parts = key.split(',').map(Number);
              canonMap.set(key, { cards: parts, count: 1 });
            }
          }
        }
      }
    }
  }
  return canonMap;
}

async function loadWasm(): Promise<WasmExports> {
  const wasmPath = path.join(process.cwd(), 'client/public/evaluator.wasm');
  const wasmBytes = fs.readFileSync(wasmPath);
  const module = await WebAssembly.instantiate(wasmBytes, {
    env: {
      abort: () => console.error('WASM abort'),
      seed: () => Date.now(),
    },
  });
  const wasm = module.instance.exports as unknown as WasmExports;
  wasm.init();

  const tablePath = path.join(process.cwd(), 'client/public/hand-ranks.bin');
  const tableBuffer = fs.readFileSync(tablePath);
  const tableData = new Uint32Array(
    tableBuffer.buffer, tableBuffer.byteOffset, tableBuffer.length / 4
  );
  if (tableData.length !== TABLE_SIZE) {
    throw new Error(`Lookup table size mismatch: expected ${TABLE_SIZE}, got ${tableData.length}`);
  }
  for (let i = 0; i < TABLE_SIZE; i++) wasm.setHandRank(i, tableData[i]);
  wasm.markTableLoaded();
  return wasm;
}

async function main() {
  const outputPath = path.join(process.cwd(), 'data', 'plo5_rankings.json.gz');

  if (fs.existsSync(outputPath)) {
    console.log(`Output file already exists: ${outputPath}`);
    console.log('Delete it to regenerate, or use --force flag.');
    if (!process.argv.includes('--force')) {
      process.exit(0);
    }
    console.log('--force specified, regenerating...');
  }

  console.log('=== PLO5 Canonical Hand Rankings Precompute ===');
  console.log(`Trials per hand: ${TRIALS_PER_HAND.toLocaleString()}`);
  console.log();

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS canonical_hand_rankings (
      hand_key VARCHAR(32) PRIMARY KEY,
      card0 SMALLINT NOT NULL,
      card1 SMALLINT NOT NULL,
      card2 SMALLINT NOT NULL,
      card3 SMALLINT NOT NULL,
      card4 SMALLINT NOT NULL,
      equity REAL NOT NULL,
      combo_count INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 4
    )
  `);

  console.log('Enumerating canonical hands...');
  const enumStart = Date.now();
  const canonMap = enumerateCanonicalHands();
  const enumElapsed = ((Date.now() - enumStart) / 1000).toFixed(1);
  console.log(`Enumeration complete: ${canonMap.size.toLocaleString()} canonical hands in ${enumElapsed}s`);

  const existingResult = await pool.query(
    'SELECT hand_key FROM canonical_hand_rankings WHERE version = $1',
    [RANKINGS_VERSION]
  );
  const existingKeys = new Set<string>(existingResult.rows.map((r: any) => r.hand_key));
  console.log(`Already computed in DB: ${existingKeys.size.toLocaleString()} / ${canonMap.size.toLocaleString()}`);

  const toCompute: { key: string; cards: number[]; count: number }[] = [];
  for (const [key, val] of canonMap) {
    if (!existingKeys.has(key)) {
      toCompute.push({ key, cards: val.cards, count: val.count });
    }
  }

  if (toCompute.length > 0) {
    console.log(`Computing ${toCompute.length.toLocaleString()} remaining hands with ${TRIALS_PER_HAND.toLocaleString()} MC trials each...`);

    const wasm = await loadWasm();
    console.log('WASM evaluator loaded');

    wasm.setNumPlayers(1);
    wasm.setPlayerLen(0, 5);
    wasm.setSeed(Date.now() & 0xffffffff);

    let batchValues: any[] = [];
    let batchParams: string[] = [];
    let paramIdx = 1;
    let lastLog = Date.now();
    const startTime = Date.now();

    for (let i = 0; i < toCompute.length; i++) {
      const { key, cards, count } = toCompute[i];

      wasm.setPlayerHand(0, 0, cards[0]);
      wasm.setPlayerHand(0, 1, cards[1]);
      wasm.setPlayerHand(0, 2, cards[2]);
      wasm.setPlayerHand(0, 3, cards[3]);
      wasm.setPlayerHand(0, 4, cards[4]);

      let usedLow = 0;
      let usedHigh = 0;
      for (const c of cards) {
        if (c < 32) usedLow |= 1 << c; else usedHigh |= 1 << (c - 32);
      }
      wasm.buildDeck(usedLow, usedHigh);
      wasm.calculateVsRandom(TRIALS_PER_HAND);

      const w = wasm.getWins(0);
      const t = wasm.getTies(0);
      const equity = (w + t / 2) / TRIALS_PER_HAND * 100;

      batchValues.push(key, cards[0], cards[1], cards[2], cards[3], cards[4], equity, count, RANKINGS_VERSION);
      batchParams.push(`($${paramIdx}, $${paramIdx+1}, $${paramIdx+2}, $${paramIdx+3}, $${paramIdx+4}, $${paramIdx+5}, $${paramIdx+6}, $${paramIdx+7}, $${paramIdx+8})`);
      paramIdx += 9;

      if (batchParams.length >= BATCH_SIZE || i === toCompute.length - 1) {
        await pool.query(
          `INSERT INTO canonical_hand_rankings (hand_key, card0, card1, card2, card3, card4, equity, combo_count, version)
           VALUES ${batchParams.join(', ')}
           ON CONFLICT (hand_key) DO UPDATE SET equity = EXCLUDED.equity, combo_count = EXCLUDED.combo_count, version = EXCLUDED.version`,
          batchValues
        );
        batchValues = [];
        batchParams = [];
        paramIdx = 1;
      }

      const now = Date.now();
      if (now - lastLog > 15000) {
        const totalDone = existingKeys.size + i + 1;
        const pct = (totalDone / canonMap.size * 100).toFixed(1);
        const elapsed = ((now - startTime) / 1000).toFixed(0);
        const rate = (i + 1) / ((now - startTime) / 1000);
        const remaining = ((toCompute.length - i - 1) / rate).toFixed(0);
        console.log(`Progress: ${totalDone.toLocaleString()} / ${canonMap.size.toLocaleString()} (${pct}%) - ${elapsed}s elapsed, ~${remaining}s remaining`);
        lastLog = now;
      }
    }

    const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    console.log(`Computation complete! ${toCompute.length.toLocaleString()} hands in ${totalElapsed}s`);
  } else {
    console.log('All canonical hands already computed in DB!');
  }

  console.log();
  console.log('Exporting to file...');

  const allRows = await pool.query(
    `SELECT hand_key, card0, card1, card2, card3, card4, equity, combo_count 
     FROM canonical_hand_rankings 
     WHERE version = $1 
     ORDER BY equity DESC`,
    [RANKINGS_VERSION]
  );

  await pool.end();

  if (allRows.rows.length < canonMap.size) {
    console.error(`ERROR: Only ${allRows.rows.length} / ${canonMap.size} hands in DB. Run again to compute remaining.`);
    process.exit(1);
  }

  let totalCombos = 0;
  const hands = allRows.rows.map((row: any, idx: number) => {
    totalCombos += row.combo_count;
    return {
      key: row.hand_key,
      cards: [row.card0, row.card1, row.card2, row.card3, row.card4],
      equity: Math.round(row.equity * 10) / 10,
      combos: row.combo_count,
      percentile: Math.round((idx + 1) / allRows.rows.length * 10000) / 100,
    };
  });

  const output = {
    version: RANKINGS_VERSION,
    generated: new Date().toISOString(),
    trialsPerHand: TRIALS_PER_HAND,
    totalCanonical: hands.length,
    totalCombos,
    hands,
  };

  const jsonStr = JSON.stringify(output);
  const compressed = zlib.gzipSync(Buffer.from(jsonStr), { level: 9 });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, compressed);

  const sizeMB = (compressed.length / 1024 / 1024).toFixed(2);
  const rawMB = (jsonStr.length / 1024 / 1024).toFixed(2);
  console.log(`Exported: ${outputPath}`);
  console.log(`  ${hands.length.toLocaleString()} canonical hands (${totalCombos.toLocaleString()} total combos)`);
  console.log(`  Raw JSON: ${rawMB} MB, Compressed: ${sizeMB} MB`);
  console.log();
  console.log('Done! The rankings file is ready for the application.');
}

main().catch(err => {
  console.error('Precompute failed:', err);
  process.exit(1);
});
