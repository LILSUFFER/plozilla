import pg from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const RANKINGS_VERSION = 3;
const TOTAL_HANDS = 2598960;
const TRIALS_PER_HAND = 25;
const RANKS_DECODE = '23456789TJQKA';
const TABLE_SIZE = 2598960;

interface RankingsData {
  cards: Uint8Array;
  equities: Float32Array;
  sortOrder: Uint32Array;
  totalHands: number;
}

export interface HandResult {
  rank: number;
  cards: number[];
  equity: number;
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

let cachedData: RankingsData | null = null;
let loading = false;
let seeding = false;
let seedProgress = 0;

const searchCache = new Map<string, number[]>();
const MAX_SEARCH_CACHE = 200;

export function isRankingsReady(): boolean {
  return cachedData !== null;
}

export function isSeeding(): boolean {
  return seeding;
}

export function getSeedProgress(): number {
  return seedProgress;
}

export function getRankingsTotal(): number {
  return cachedData?.totalHands ?? 0;
}

export async function loadRankingsFromDB(): Promise<boolean> {
  if (cachedData) return true;
  if (loading) return false;
  loading = true;

  try {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

    const tableCheck = await pool.query(
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hand_rankings_data')"
    );
    if (!tableCheck.rows[0]?.exists) {
      console.log('Rankings table does not exist. Run seed-rankings.ts first.');
      await pool.end();
      loading = false;
      return false;
    }

    const result = await pool.query(
      'SELECT key, data FROM hand_rankings_data WHERE version = $1',
      [RANKINGS_VERSION]
    );

    await pool.end();

    if (result.rows.length < 3) {
      console.log('Rankings data not found in database. Run seed-rankings.ts first.');
      loading = false;
      return false;
    }

    const blobs: Record<string, Buffer> = {};
    for (const row of result.rows) {
      blobs[row.key] = row.data;
    }

    if (!blobs.cards || !blobs.equities || !blobs.sort_order) {
      console.log('Incomplete rankings data in database.');
      loading = false;
      return false;
    }

    const cardsBuf = blobs.cards;
    const equitiesBuf = blobs.equities;
    const sortBuf = blobs.sort_order;

    cachedData = {
      cards: new Uint8Array(cardsBuf.buffer, cardsBuf.byteOffset, cardsBuf.byteLength),
      equities: new Float32Array(
        equitiesBuf.buffer.slice(equitiesBuf.byteOffset, equitiesBuf.byteOffset + equitiesBuf.byteLength)
      ),
      sortOrder: new Uint32Array(
        sortBuf.buffer.slice(sortBuf.byteOffset, sortBuf.byteOffset + sortBuf.byteLength)
      ),
      totalHands: TOTAL_HANDS,
    };

    console.log(`Rankings loaded: ${cachedData.totalHands.toLocaleString()} hands`);
    loading = false;
    return true;
  } catch (err) {
    console.error('Failed to load rankings from DB:', err);
    loading = false;
    return false;
  }
}

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
    tableBuffer.buffer, tableBuffer.byteOffset, tableBuffer.length / 4
  );
  if (tableData.length !== TABLE_SIZE) {
    throw new Error(`Lookup table size mismatch: expected ${TABLE_SIZE}, got ${tableData.length}`);
  }
  for (let i = 0; i < TABLE_SIZE; i++) wasm.setHandRank(i, tableData[i]);
  wasm.markTableLoaded();
  return wasm;
}

function yieldToEventLoop(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

export async function seedRankingsInProcess(): Promise<void> {
  if (seeding || cachedData) return;
  seeding = true;
  seedProgress = 0;

  console.log(`Starting in-process rankings seed: ${TOTAL_HANDS.toLocaleString()} hands, ${TRIALS_PER_HAND} trials each`);
  const startTime = Date.now();

  try {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

    await pool.query(`
      CREATE TABLE IF NOT EXISTS hand_rankings_data (
        key VARCHAR(64) PRIMARY KEY,
        data BYTEA NOT NULL,
        version INTEGER NOT NULL
      )
    `);

    const wasm = await loadWasmServer();
    console.log('WASM evaluator loaded for seed');

    wasm.setNumPlayers(1);
    wasm.setPlayerLen(0, 5);
    wasm.setSeed(Date.now() & 0xffffffff);

    const equities = new Float32Array(TOTAL_HANDS);
    const cards = new Uint8Array(TOTAL_HANDS * 5);

    let handIdx = 0;
    let lastLog = Date.now();
    const YIELD_INTERVAL = 2000;

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

        if (handIdx % YIELD_INTERVAL < 50) {
          seedProgress = handIdx / TOTAL_HANDS;
          await yieldToEventLoop();
        }

        const now = Date.now();
        if (now - lastLog > 10000) {
          const pct = ((handIdx / TOTAL_HANDS) * 100).toFixed(1);
          const elapsed = ((now - startTime) / 1000).toFixed(0);
          console.log(`Seed progress: ${handIdx.toLocaleString()} / ${TOTAL_HANDS.toLocaleString()} (${pct}%) - ${elapsed}s elapsed`);
          lastLog = now;
        }
      }
    }

    seedProgress = 0.95;
    console.log(`Computation complete. ${handIdx.toLocaleString()} hands in ${((Date.now() - startTime) / 1000).toFixed(0)}s`);

    console.log('Sorting by equity descending...');
    const sortOrder = new Uint32Array(TOTAL_HANDS);
    for (let i = 0; i < TOTAL_HANDS; i++) sortOrder[i] = i;
    sortOrder.sort((a, b) => equities[b] - equities[a]);

    seedProgress = 0.97;
    console.log('Storing in database...');

    await pool.query('DELETE FROM hand_rankings_data');

    const cardsBuf = Buffer.from(cards.buffer, cards.byteOffset, cards.byteLength);
    const equitiesBuf = Buffer.from(equities.buffer, equities.byteOffset, equities.byteLength);
    const sortBuf = Buffer.from(sortOrder.buffer, sortOrder.byteOffset, sortOrder.byteLength);

    await pool.query('INSERT INTO hand_rankings_data (key, data, version) VALUES ($1, $2, $3)', ['cards', cardsBuf, RANKINGS_VERSION]);
    await pool.query('INSERT INTO hand_rankings_data (key, data, version) VALUES ($1, $2, $3)', ['equities', equitiesBuf, RANKINGS_VERSION]);
    await pool.query('INSERT INTO hand_rankings_data (key, data, version) VALUES ($1, $2, $3)', ['sort_order', sortBuf, RANKINGS_VERSION]);

    await pool.end();

    cachedData = {
      cards,
      equities,
      sortOrder,
      totalHands: TOTAL_HANDS,
    };

    seedProgress = 1;
    seeding = false;
    const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    console.log(`Seed complete! Total time: ${totalElapsed}s. Rankings ready to serve.`);
  } catch (err) {
    console.error('In-process seed failed:', err);
    seeding = false;
    seedProgress = 0;
  }
}

function getHandAtRank(rank: number): HandResult | null {
  if (!cachedData || rank < 0 || rank >= cachedData.totalHands) return null;
  const origIdx = cachedData.sortOrder[rank];
  const base = origIdx * 5;
  const cards: number[] = [];
  for (let i = 0; i < 5; i++) {
    cards.push(cachedData.cards[base + i]);
  }
  return {
    rank: rank + 1,
    cards,
    equity: Math.round(cachedData.equities[origIdx] * 10) / 10,
  };
}

export function getRankingsPage(
  offset: number,
  limit: number,
  filteredIndices?: number[]
): { hands: HandResult[]; total: number } {
  if (!cachedData) return { hands: [], total: 0 };

  if (filteredIndices) {
    const total = filteredIndices.length;
    const start = Math.max(0, offset);
    const end = Math.min(start + limit, total);
    const hands: HandResult[] = [];
    for (let i = start; i < end; i++) {
      const hand = getHandAtRank(filteredIndices[i]);
      if (hand) hands.push(hand);
    }
    return { hands, total };
  }

  const total = cachedData.totalHands;
  const start = Math.max(0, offset);
  const end = Math.min(start + limit, total);
  const hands: HandResult[] = [];
  for (let i = start; i < end; i++) {
    const hand = getHandAtRank(i);
    if (hand) hands.push(hand);
  }
  return { hands, total };
}

interface PatternBranch {
  include: Record<string, number>;
  excludes: Record<string, number>[];
  suitFilter?: 'ds' | 'ss';
  noPair?: boolean;
}

type SearchResult =
  | { type: 'patterns'; branches: PatternBranch[] }
  | { type: 'percent'; lo: number; hi: number }
  | null;

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;
const RANK_ORDER: Record<string, number> = {
  'A': 14, 'K': 13, 'Q': 12, 'J': 11, 'T': 10,
  '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2
};
const VALID_RANKS = new Set<string>(RANKS as unknown as string[]);

const RANK_MACROS: [RegExp, string][] = [
  [/\$B/gi, '[AKQJT]'],
  [/\$R/gi, '[AKQJT]'],
  [/\$M/gi, '[T987]'],
  [/\$Z/gi, '[65432]'],
  [/\$L/gi, '[A2345678]'],
  [/\$W/gi, '[A2345]'],
  [/\$F/gi, '[KQJ]'],
  [/\$N/gi, '[KQJ9]'],
];

function expandRankBrackets(input: string): string[] {
  const bracketMatch = input.match(/\[([A-Z0-9,\-]+)\]/i);
  if (!bracketMatch) return [input];
  const content = bracketMatch[1].toUpperCase();
  const ranks: string[] = [];
  if (content.includes('-') && !content.includes(',')) {
    const parts = content.split('-');
    if (parts.length === 2 && parts[0].length === 1 && parts[1].length === 1) {
      const si = RANKS.indexOf(parts[0] as typeof RANKS[number]);
      const ei = RANKS.indexOf(parts[1] as typeof RANKS[number]);
      if (si !== -1 && ei !== -1) {
        for (let i = Math.min(si, ei); i <= Math.max(si, ei); i++) ranks.push(RANKS[i]);
      }
    }
  } else {
    for (const item of content.split(',')) {
      if (item.includes('-')) {
        const parts = item.split('-');
        if (parts.length === 2) {
          const si = RANKS.indexOf(parts[0] as typeof RANKS[number]);
          const ei = RANKS.indexOf(parts[1] as typeof RANKS[number]);
          if (si !== -1 && ei !== -1) {
            for (let i = Math.min(si, ei); i <= Math.max(si, ei); i++) ranks.push(RANKS[i]);
          }
        }
      } else if (RANK_ORDER[item]) {
        ranks.push(item);
      }
    }
  }
  if (ranks.length === 0) return [input];
  return ranks.map(rank => input.replace(bracketMatch[0], rank));
}

function expandAllBrackets(input: string): string[] {
  let current = [input];
  let changed = true;
  while (changed) {
    changed = false;
    const next: string[] = [];
    for (const s of current) {
      if (s.includes('[')) {
        const exp = expandRankBrackets(s);
        if (exp.length > 1 || exp[0] !== s) { changed = true; next.push(...exp); }
        else next.push(s);
      } else {
        next.push(s);
      }
    }
    current = next;
  }
  return current;
}

function expandRankSpan(pattern: string): string[] {
  const up = pattern.toUpperCase();

  const run4 = up.match(/^([AKQJT98765432]{4})-([AKQJT98765432]{4})$/);
  if (run4) {
    const si = RANKS.indexOf(run4[1][0] as typeof RANKS[number]);
    const ei = RANKS.indexOf(run4[2][0] as typeof RANKS[number]);
    if (si !== -1 && ei !== -1) {
      const results: string[] = [];
      for (let i = Math.min(si, ei); i <= Math.max(si, ei) && i + 3 < RANKS.length; i++)
        results.push(RANKS[i] + RANKS[i + 1] + RANKS[i + 2] + RANKS[i + 3]);
      if (results.length) return results;
    }
  }

  const run5 = up.match(/^([AKQJT98765432]{5})-([AKQJT98765432]{5})$/);
  if (run5) {
    const si = RANKS.indexOf(run5[1][0] as typeof RANKS[number]);
    const ei = RANKS.indexOf(run5[2][0] as typeof RANKS[number]);
    if (si !== -1 && ei !== -1) {
      const results: string[] = [];
      for (let i = Math.min(si, ei); i <= Math.max(si, ei) && i + 4 < RANKS.length; i++)
        results.push(RANKS[i] + RANKS[i + 1] + RANKS[i + 2] + RANKS[i + 3] + RANKS[i + 4]);
      if (results.length) return results;
    }
  }

  const asc = up.match(/^([AKQJT98765432]{2,5})\+$/);
  if (asc) {
    const base = asc[1];
    if (base.length === 2 && base[0] === base[1]) {
      const si = RANKS.indexOf(base[0] as typeof RANKS[number]);
      const results: string[] = [];
      for (let i = 0; i <= si; i++) results.push(RANKS[i] + RANKS[i]);
      return results;
    }
    if (base.length === 2) {
      const hi = base[0];
      const loIdx = RANKS.indexOf(base[1] as typeof RANKS[number]);
      const hiIdx = RANKS.indexOf(hi as typeof RANKS[number]);
      const results: string[] = [];
      for (let i = hiIdx + 1; i <= loIdx; i++) results.push(hi + RANKS[i]);
      if (results.length) return results;
    }
    if (base.length === 3 && base[0] === base[1]) {
      const pairRank = base[0];
      const kickerIdx = RANKS.indexOf(base[2] as typeof RANKS[number]);
      const results: string[] = [];
      for (let i = 0; i <= kickerIdx; i++) {
        if (RANKS[i] !== pairRank) results.push(pairRank + pairRank + RANKS[i]);
      }
      if (results.length) return results;
    }
    if (base.length === 4) {
      const si = RANKS.indexOf(base[0] as typeof RANKS[number]);
      const results: string[] = [];
      for (let i = 0; i <= si && i + 3 < RANKS.length; i++)
        results.push(RANKS[i] + RANKS[i + 1] + RANKS[i + 2] + RANKS[i + 3]);
      if (results.length) return results;
    }
    if (base.length === 5) {
      const si = RANKS.indexOf(base[0] as typeof RANKS[number]);
      const results: string[] = [];
      for (let i = 0; i <= si && i + 4 < RANKS.length; i++)
        results.push(RANKS[i] + RANKS[i + 1] + RANKS[i + 2] + RANKS[i + 3] + RANKS[i + 4]);
      if (results.length) return results;
    }
  }

  const desc4 = up.match(/^([AKQJT98765432]{4})-$/);
  if (desc4) {
    const si = RANKS.indexOf(desc4[1][0] as typeof RANKS[number]);
    const results: string[] = [];
    for (let i = si; i + 3 < RANKS.length; i++)
      results.push(RANKS[i] + RANKS[i + 1] + RANKS[i + 2] + RANKS[i + 3]);
    if (results.length) return results;
  }

  const desc5 = up.match(/^([AKQJT98765432]{5})-$/);
  if (desc5) {
    const si = RANKS.indexOf(desc5[1][0] as typeof RANKS[number]);
    const results: string[] = [];
    for (let i = si; i + 4 < RANKS.length; i++)
      results.push(RANKS[i] + RANKS[i + 1] + RANKS[i + 2] + RANKS[i + 3] + RANKS[i + 4]);
    if (results.length) return results;
  }

  const pairDesc = up.match(/^([AKQJT98765432])\1-$/);
  if (pairDesc) {
    const si = RANKS.indexOf(pairDesc[1] as typeof RANKS[number]);
    const results: string[] = [];
    for (let i = si; i < RANKS.length; i++) results.push(RANKS[i] + RANKS[i]);
    if (results.length) return results;
  }

  const pairKickerDesc = up.match(/^([AKQJT98765432])\1([AKQJT98765432])-$/);
  if (pairKickerDesc) {
    const pairRank = pairKickerDesc[1];
    const kickerIdx = RANKS.indexOf(pairKickerDesc[2] as typeof RANKS[number]);
    const results: string[] = [];
    for (let i = kickerIdx; i < RANKS.length; i++) {
      if (RANKS[i] !== pairRank) results.push(pairRank + pairRank + RANKS[i]);
    }
    if (results.length) return results;
  }

  return [pattern];
}

function parseRankCounts(pattern: string): Record<string, number> {
  const counts: Record<string, number> = {};
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i].toUpperCase();
    if (VALID_RANKS.has(ch)) {
      const next = pattern[i + 1]?.toLowerCase();
      if (next && 'shdc'.includes(next)) { counts[ch] = (counts[ch] || 0) + 1; i += 2; }
      else if (next && 'xyzw'.includes(next)) { counts[ch] = (counts[ch] || 0) + 1; i += 2; }
      else { counts[ch] = (counts[ch] || 0) + 1; i++; }
    } else if (ch === '{') {
      const close = pattern.indexOf('}', i);
      if (close !== -1) i = close + 1; else i++;
    } else { i++; }
  }
  return counts;
}

function hasNoPairConstraint(pattern: string): boolean {
  const idx = pattern.indexOf('{');
  if (idx === -1) return false;
  return pattern.indexOf('}', idx) !== -1;
}

function parseSinglePattern(
  pattern: string,
  suitFilter?: 'ds' | 'ss',
  noPair?: boolean
): PatternBranch[] {
  const parts = pattern.split('!');
  const mainPart = parts[0];
  const excludeParts = parts.slice(1).filter(Boolean);
  const mainExpanded = expandRankSpan(mainPart);
  const allExcludes: Record<string, number>[] = [];
  for (const excl of excludeParts) {
    for (const e of expandRankSpan(excl)) {
      const counts = parseRankCounts(e);
      if (Object.keys(counts).length > 0) allExcludes.push(counts);
    }
  }
  let branchNoPair = noPair;
  if (hasNoPairConstraint(mainPart)) branchNoPair = true;
  const branches: PatternBranch[] = [];
  for (const main of mainExpanded) {
    branches.push({ include: parseRankCounts(main), excludes: allExcludes, suitFilter, noPair: branchNoPair || undefined });
  }
  return branches;
}

function parseToken(token: string): PatternBranch[] {
  let str = token.toUpperCase();
  str = str.replace(/@\d+$/, '');
  let suitFilter: 'ds' | 'ss' | undefined;
  let noPair = false;
  if (/\$DS/i.test(str)) { suitFilter = 'ds'; str = str.replace(/\$DS/gi, ''); }
  if (/\$SS/i.test(str)) { suitFilter = 'ss'; str = str.replace(/\$SS/gi, ''); }
  if (/\$NP/i.test(str)) { noPair = true; str = str.replace(/\$NP/gi, ''); }
  if (/\$OP/i.test(str)) { str = str.replace(/\$OP/gi, ''); }
  if (/\$TP/i.test(str)) { str = str.replace(/\$TP/gi, ''); }
  if (!suitFilter) {
    if (str.length > 2 && str.endsWith('DS')) { suitFilter = 'ds'; str = str.slice(0, -2).trim(); }
    else if (str.length > 2 && str.endsWith('SS')) { suitFilter = 'ss'; str = str.slice(0, -2).trim(); }
  }
  for (const [re, expansion] of RANK_MACROS) str = str.replace(re, expansion);
  const colonIdx = str.indexOf(':');
  if (colonIdx !== -1) {
    const afterColon = str.slice(colonIdx + 1);
    const beforeColon = str.slice(0, colonIdx);
    if (/[xyzw]/i.test(afterColon)) {
      const lower = afterColon.toLowerCase();
      if (!suitFilter) {
        if (lower.includes('xxyy')) suitFilter = 'ds';
        else if (lower.includes('xxyz') || lower.includes('xy') || /^x+$/.test(lower)) suitFilter = 'ss';
      }
      str = beforeColon;
    } else { str = beforeColon + afterColon; }
  }
  str = str.trim();
  if (!str) {
    if (suitFilter || noPair) return [{ include: {}, excludes: [], suitFilter, noPair: noPair || undefined }];
    return [];
  }
  const bracketExpanded = expandAllBrackets(str);
  const branches: PatternBranch[] = [];
  for (const pattern of bracketExpanded) branches.push(...parseSinglePattern(pattern, suitFilter, noPair));
  return branches;
}

function parseSearch(raw: string): SearchResult {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const pctRange = trimmed.match(/^(\d+(?:\.\d+)?)\s*%\s*[-–—]\s*(\d+(?:\.\d+)?)\s*%$/);
  if (pctRange) {
    const a = parseFloat(pctRange[1]);
    const b = parseFloat(pctRange[2]);
    if (a >= 0 && b <= 100 && a <= b) return { type: 'percent', lo: a, hi: b };
  }
  const pctSingle = trimmed.match(/^(\d+(?:\.\d+)?)\s*%$/);
  if (pctSingle) {
    const v = parseFloat(pctSingle[1]);
    if (v >= 0 && v <= 100) return { type: 'percent', lo: 0, hi: v };
  }
  const tokens = trimmed.split(',').map(t => t.trim()).filter(Boolean);
  const allBranches: PatternBranch[] = [];
  for (const token of tokens) allBranches.push(...parseToken(token));
  const hasFilter = allBranches.some(b =>
    Object.keys(b.include).length > 0 || b.excludes.length > 0 || b.suitFilter !== undefined || b.noPair
  );
  if (!hasFilter) return null;
  return { type: 'patterns', branches: allBranches };
}

function matchesBranch(
  rankCounts: Record<string, number>,
  suitType: 'ds' | 'ss',
  branch: PatternBranch
): boolean {
  if (branch.suitFilter && suitType !== branch.suitFilter) return false;
  if (branch.noPair) {
    for (const v of Object.values(rankCounts)) {
      if (v >= 2) return false;
    }
  }
  for (const [rank, minCount] of Object.entries(branch.include)) {
    if ((rankCounts[rank] || 0) < minCount) return false;
  }
  for (const excl of branch.excludes) {
    let matches = true;
    for (const [rank, minCount] of Object.entries(excl)) {
      if ((rankCounts[rank] || 0) < minCount) { matches = false; break; }
    }
    if (matches) return false;
  }
  return true;
}

export function filterRankings(searchQuery: string, offset: number, limit: number): { hands: HandResult[]; total: number } {
  if (!cachedData) return { hands: [], total: 0 };

  const trimmed = searchQuery.trim();
  if (!trimmed) {
    return getRankingsPage(offset, limit);
  }

  const cacheKey = trimmed.toLowerCase();
  let filteredRanks = searchCache.get(cacheKey);

  if (!filteredRanks) {
    const parsed = parseSearch(trimmed);
    if (!parsed) {
      return getRankingsPage(offset, limit);
    }

    filteredRanks = [];

    if (parsed.type === 'percent') {
      const startRank = Math.max(0, Math.floor(parsed.lo / 100 * cachedData.totalHands));
      const endRank = Math.min(cachedData.totalHands, Math.ceil(parsed.hi / 100 * cachedData.totalHands));
      for (let i = startRank; i < endRank; i++) filteredRanks.push(i);
    } else {
      const cardsArr = cachedData.cards;
      const sortArr = cachedData.sortOrder;
      const total = cachedData.totalHands;

      for (let rank = 0; rank < total; rank++) {
        const origIdx = sortArr[rank];
        const base = origIdx * 5;
        const rankCounts: Record<string, number> = {};
        const sc = [0, 0, 0, 0];
        for (let i = 0; i < 5; i++) {
          const c = cardsArr[base + i];
          const r = RANKS_DECODE[c >> 2];
          rankCounts[r] = (rankCounts[r] || 0) + 1;
          sc[c & 3]++;
        }
        let pairs = 0;
        for (let s = 0; s < 4; s++) if (sc[s] >= 2) pairs++;
        const suitType: 'ds' | 'ss' = pairs >= 2 ? 'ds' : 'ss';

        let matched = false;
        for (const branch of parsed.branches) {
          if (matchesBranch(rankCounts, suitType, branch)) { matched = true; break; }
        }
        if (matched) filteredRanks.push(rank);
      }
    }

    if (searchCache.size >= MAX_SEARCH_CACHE) {
      const firstKey = searchCache.keys().next().value;
      if (firstKey) searchCache.delete(firstKey);
    }
    searchCache.set(cacheKey, filteredRanks);
  }

  return getRankingsPage(offset, limit, filteredRanks);
}
