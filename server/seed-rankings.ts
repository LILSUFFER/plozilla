import * as fs from 'fs';
import * as path from 'path';
import pg from 'pg';

const TOTAL_HANDS = 2598960;
const TRIALS_PER_HAND = 25;
const RANKINGS_VERSION = 3;
const BATCH_SIZE = 5000;

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

async function loadWasmServer(): Promise<WasmExports> {
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
    tableBuffer.buffer,
    tableBuffer.byteOffset,
    tableBuffer.length / 4
  );

  if (tableData.length !== TABLE_SIZE) {
    throw new Error(`Lookup table size mismatch: expected ${TABLE_SIZE}, got ${tableData.length}`);
  }

  for (let i = 0; i < TABLE_SIZE; i++) {
    wasm.setHandRank(i, tableData[i]);
  }
  wasm.markTableLoaded();

  console.log('WASM evaluator loaded with lookup table');
  return wasm;
}

async function seedRankings() {
  console.log(`Starting rankings seed: ${TOTAL_HANDS.toLocaleString()} hands, ${TRIALS_PER_HAND} trials each`);
  const startTime = Date.now();

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS hand_rankings_data (
      key VARCHAR(64) PRIMARY KEY,
      data BYTEA NOT NULL,
      version INTEGER NOT NULL
    )
  `);

  const existing = await pool.query(
    'SELECT key FROM hand_rankings_data WHERE version = $1 LIMIT 1',
    [RANKINGS_VERSION]
  );

  if (existing.rows.length > 0) {
    console.log(`Rankings v${RANKINGS_VERSION} already exist in database. Skipping.`);
    await pool.end();
    return;
  }

  const wasm = await loadWasmServer();

  wasm.setNumPlayers(1);
  wasm.setPlayerLen(0, 5);
  wasm.setSeed(Date.now() & 0xffffffff);

  const equities = new Float32Array(TOTAL_HANDS);
  const cards = new Uint8Array(TOTAL_HANDS * 5);

  let handIdx = 0;
  let lastLog = Date.now();

  for (let c0 = 0; c0 < 48; c0++) {
    for (let c1 = c0 + 1; c1 < 49; c1++) {
      for (let c2 = c1 + 1; c2 < 50; c2++) {
        for (let c3 = c2 + 1; c3 < 51; c3++) {
          for (let c4 = c3 + 1; c4 < 52; c4++) {
            const base = handIdx * 5;
            cards[base] = c0;
            cards[base + 1] = c1;
            cards[base + 2] = c2;
            cards[base + 3] = c3;
            cards[base + 4] = c4;

            wasm.setPlayerHand(0, 0, c0);
            wasm.setPlayerHand(0, 1, c1);
            wasm.setPlayerHand(0, 2, c2);
            wasm.setPlayerHand(0, 3, c3);
            wasm.setPlayerHand(0, 4, c4);

            let usedLow = 0;
            let usedHigh = 0;
            if (c0 < 32) usedLow |= 1 << c0; else usedHigh |= 1 << (c0 - 32);
            if (c1 < 32) usedLow |= 1 << c1; else usedHigh |= 1 << (c1 - 32);
            if (c2 < 32) usedLow |= 1 << c2; else usedHigh |= 1 << (c2 - 32);
            if (c3 < 32) usedLow |= 1 << c3; else usedHigh |= 1 << (c3 - 32);
            if (c4 < 32) usedLow |= 1 << c4; else usedHigh |= 1 << (c4 - 32);

            wasm.buildDeck(usedLow, usedHigh);
            wasm.calculateVsRandom(TRIALS_PER_HAND);

            const w = wasm.getWins(0);
            const t = wasm.getTies(0);
            equities[handIdx] = (w + t / 2) / TRIALS_PER_HAND * 100;

            handIdx++;
          }
        }
      }

      const now = Date.now();
      if (now - lastLog > 5000) {
        const pct = ((handIdx / TOTAL_HANDS) * 100).toFixed(1);
        const elapsed = ((now - startTime) / 1000).toFixed(0);
        console.log(`Progress: ${handIdx.toLocaleString()} / ${TOTAL_HANDS.toLocaleString()} (${pct}%) - ${elapsed}s elapsed`);
        lastLog = now;
      }
    }
  }

  console.log(`Computation complete. ${handIdx.toLocaleString()} hands computed in ${((Date.now() - startTime) / 1000).toFixed(0)}s`);

  console.log('Sorting by equity descending...');
  const sortOrder = new Uint32Array(TOTAL_HANDS);
  for (let i = 0; i < TOTAL_HANDS; i++) sortOrder[i] = i;
  sortOrder.sort((a, b) => equities[b] - equities[a]);
  console.log('Sort complete.');

  console.log('Storing in database...');

  await pool.query('DELETE FROM hand_rankings_data');

  const cardsBuf = Buffer.from(cards.buffer, cards.byteOffset, cards.byteLength);
  const equitiesBuf = Buffer.from(equities.buffer, equities.byteOffset, equities.byteLength);
  const sortBuf = Buffer.from(sortOrder.buffer, sortOrder.byteOffset, sortOrder.byteLength);

  await pool.query(
    'INSERT INTO hand_rankings_data (key, data, version) VALUES ($1, $2, $3)',
    ['cards', cardsBuf, RANKINGS_VERSION]
  );
  console.log('Stored cards blob');

  await pool.query(
    'INSERT INTO hand_rankings_data (key, data, version) VALUES ($1, $2, $3)',
    ['equities', equitiesBuf, RANKINGS_VERSION]
  );
  console.log('Stored equities blob');

  await pool.query(
    'INSERT INTO hand_rankings_data (key, data, version) VALUES ($1, $2, $3)',
    ['sort_order', sortBuf, RANKINGS_VERSION]
  );
  console.log('Stored sort_order blob');

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`Seed complete! Total time: ${totalElapsed}s`);

  await pool.end();
}

seedRankings().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
