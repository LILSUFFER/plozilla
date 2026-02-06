import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

const TOTAL_HANDS_ALL = 2598960;
const RANKS_DECODE = '23456789TJQKA';
const DATA_FILE_QUASI = path.join(process.cwd(), 'public', 'plo5_rankings_quasi_v1.json.gz');
const DATA_FILE_V4 = path.join(process.cwd(), 'public', 'plo5_rankings_v4.json.gz');
const DATA_FILE = fs.existsSync(DATA_FILE_QUASI) ? DATA_FILE_QUASI : DATA_FILE_V4;

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

export function canonicalKey(c0: number, c1: number, c2: number, c3: number, c4: number): string {
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

interface PrecomputedHand {
  key: string;
  cards: number[];
  equity: number;
  combos: number;
  percentile: number;
}

interface RankingsData {
  hands: PrecomputedHand[];
  keyToRank: Map<string, number>;
  totalCanonical: number;
  totalCombos: number;
  metadata?: {
    method: string;
    boardSampleRate: number;
    villainSamplesPerBoard: number;
    samplesPerHand: number;
    generatedAt: string;
  };
}

export function getRankingsStatus() {
  if (!cachedData) return { ready: false, error: loadError };
  const meta = cachedData.metadata;
  const isTestFile = meta ? meta.boardSampleRate < 1.0 : false;
  const lowSamples = meta ? meta.samplesPerHand < 50000 : false;

  return {
    ready: true,
    totalCanonical: cachedData.totalCanonical,
    totalCombos: cachedData.totalCombos,
    method: meta?.method || 'unknown',
    boardSampleRate: meta?.boardSampleRate ?? 0,
    villainSamplesPerBoard: meta?.villainSamplesPerBoard ?? 0,
    samplesPerHand: meta?.samplesPerHand ?? 0,
    generatedAt: meta?.generatedAt || 'unknown',
    isTestFile,
    lowSamples,
    warning: isTestFile ? 'TEST FILE' : (lowSamples ? 'LOW SAMPLE QUALITY' : null)
  };
}

export interface HandResult {
  rank: number;
  cards: number[];
  equity: number;
  comboCount: number;
}

let cachedData: RankingsData | null = null;
let loadError: string | null = null;
let calculationCallCount = 0;

const searchCache = new Map<string, number[]>();
const MAX_SEARCH_CACHE = 200;

export function isRankingsReady(): boolean {
  return cachedData !== null;
}

export function getRankingsError(): string | null {
  return loadError;
}

export function getCalculationCallCount(): number {
  return calculationCallCount;
}

export function getRankingsTotal(): number {
  return cachedData?.totalCanonical ?? 0;
}

export function getTotalCombos(): number {
  return cachedData?.totalCombos ?? TOTAL_HANDS_ALL;
}

export function lookupByCanonicalKey(key: string): HandResult | null {
  if (!cachedData) return null;
  const rank = cachedData.keyToRank.get(key);
  if (rank === undefined) return null;
  const h = cachedData.hands[rank];
  return {
    rank: rank + 1,
    cards: h.cards,
    equity: h.equity,
    comboCount: h.combos,
  };
}

export function loadRankingsFromFile(): boolean {
  if (cachedData) return true;

  if (!fs.existsSync(DATA_FILE)) {
    loadError = 'Rankings database not found. Run: npm run precompute:quasi (or npm run precompute:rankings)';
    console.log(`Rankings file not found: ${DATA_FILE}`);
    console.log(loadError);
    return false;
  }

  try {
    const startLoad = Date.now();
    console.log(`Loading rankings from ${DATA_FILE}...`);

    const compressed = fs.readFileSync(DATA_FILE);
    const jsonStr = zlib.gunzipSync(compressed).toString('utf-8');
    const data = JSON.parse(jsonStr);
    const rawHands: any[] = data.hands;
    rawHands.sort((a: any, b: any) => a.rank - b.rank);

    const hands: PrecomputedHand[] = rawHands.map((h: any) => ({
      key: h.hand_key,
      cards: [h.card0, h.card1, h.card2, h.card3, h.card4],
      equity: h.equity,
      combos: h.combo_count,
      percentile: h.percentile,
    }));

    const keyToRank = new Map<string, number>();
    let totalCombos = 0;
    for (let i = 0; i < hands.length; i++) {
      keyToRank.set(hands[i].key, i);
      totalCombos += hands[i].combos;
    }

    cachedData = {
      hands,
      keyToRank,
      totalCanonical: data.canonicalHands || hands.length,
      totalCombos,
      metadata: {
        method: data.method || 'unknown',
        boardSampleRate: data.boardSampleRate || 0,
        villainSamplesPerBoard: data.villainSamplesPerBoard || 0,
        samplesPerHand: data.samplesPerHand || 0,
        generatedAt: data.generatedAt || 'unknown',
      }
    };

    if (cachedData.metadata && cachedData.metadata.boardSampleRate < 1.0) {
      console.warn('WARNING: Loaded rankings from a TEST FILE (boardSampleRate < 1.0)');
    }

    loadError = null;
    const elapsed = ((Date.now() - startLoad) / 1000).toFixed(1);
    console.log(`Rankings loaded: ${hands.length.toLocaleString()} canonical hands (${totalCombos.toLocaleString()} total combos) in ${elapsed}s`);
    return true;
  } catch (err) {
    loadError = `Failed to load rankings file: ${err instanceof Error ? err.message : String(err)}`;
    console.error(loadError);
    return false;
  }
}

function getHandAtRank(rank: number): HandResult | null {
  if (!cachedData || rank < 0 || rank >= cachedData.totalCanonical) return null;
  const hand = cachedData.hands[rank];
  return {
    rank: rank + 1,
    cards: hand.cards,
    equity: hand.equity,
    comboCount: hand.combos,
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

  const total = cachedData.totalCanonical;
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

function tryParseExactHand(input: string): string | null {
  const clean = input.replace(/\s+/g, '');
  const match = clean.match(/^([AKQJT2-9][shdc])([AKQJT2-9][shdc])([AKQJT2-9][shdc])([AKQJT2-9][shdc])([AKQJT2-9][shdc])$/i);
  if (!match) return null;

  const RANK_MAP: Record<string, number> = {
    '2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '8': 6, '9': 7,
    'T': 8, 'J': 9, 'Q': 10, 'K': 11, 'A': 12
  };
  const SUIT_MAP: Record<string, number> = { 's': 0, 'h': 1, 'd': 2, 'c': 3 };

  const cards: number[] = [];
  for (let i = 1; i <= 5; i++) {
    const card = match[i];
    const rank = RANK_MAP[card[0].toUpperCase()];
    const suit = SUIT_MAP[card[1].toLowerCase()];
    if (rank === undefined || suit === undefined) return null;
    cards.push(rank * 4 + suit);
  }

  if (new Set(cards).size !== 5) return null;

  return canonicalKey(cards[0], cards[1], cards[2], cards[3], cards[4]);
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
    const exactKey = tryParseExactHand(trimmed);
    if (exactKey && cachedData.keyToRank.has(exactKey)) {
      filteredRanks = [cachedData.keyToRank.get(exactKey)!];
    } else {
      const parsed = parseSearch(trimmed);
      if (!parsed) {
        return getRankingsPage(offset, limit);
      }

      filteredRanks = [];

      if (parsed.type === 'percent') {
        const startRank = Math.max(0, Math.floor(parsed.lo / 100 * cachedData.totalCanonical));
        const endRank = Math.min(cachedData.totalCanonical, Math.ceil(parsed.hi / 100 * cachedData.totalCanonical));
        for (let i = startRank; i < endRank; i++) filteredRanks.push(i);
      } else {
        const { hands, totalCanonical } = cachedData;

        for (let rank = 0; rank < totalCanonical; rank++) {
          const hand = hands[rank];
          const rankCounts: Record<string, number> = {};
          const sc = [0, 0, 0, 0];
          for (const c of hand.cards) {
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
    }

    if (searchCache.size >= MAX_SEARCH_CACHE) {
      const firstKey = searchCache.keys().next().value;
      if (firstKey) searchCache.delete(firstKey);
    }
    searchCache.set(cacheKey, filteredRanks);
  }

  return getRankingsPage(offset, limit, filteredRanks);
}
