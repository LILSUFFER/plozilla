import type { AllHandsRankings } from './hand-rankings';

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;
const RANK_ORDER: Record<string, number> = {
  'A': 14, 'K': 13, 'Q': 12, 'J': 11, 'T': 10,
  '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2
};
const VALID_RANKS = new Set<string>(RANKS as unknown as string[]);
const RANKS_DECODE = '23456789TJQKA';

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

export type SearchResult =
  | { type: 'patterns'; branches: PatternBranch[]; label: string }
  | { type: 'percent'; lo: number; hi: number }
  | null;

interface PatternBranch {
  include: Record<string, number>;
  excludes: Record<string, number>[];
  suitFilter?: 'ds' | 'ss';
  noPair?: boolean;
}

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
        if (exp.length > 1 || exp[0] !== s) {
          changed = true;
          next.push(...exp);
        } else {
          next.push(s);
        }
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
  const upperPattern = pattern.toUpperCase();
  
  // Check if it's a specific 5-card hand (e.g. JsTh5dTc4c)
  const fullHandMatch = upperPattern.match(/^([AKQJT2-9][SHDC]){5}$/);
  if (fullHandMatch) {
    for (let j = 0; j < 5; j++) {
      const rank = upperPattern[j * 2];
      counts[rank] = (counts[rank] || 0) + 1;
    }
    return counts;
  }

  while (i < pattern.length) {
    const ch = pattern[i].toUpperCase();
    if (VALID_RANKS.has(ch)) {
      const next = pattern[i + 1]?.toLowerCase();
      if (next && 'shdc'.includes(next)) {
        counts[ch] = (counts[ch] || 0) + 1;
        i += 2;
      } else if (next && 'xyzw'.includes(next)) {
        counts[ch] = (counts[ch] || 0) + 1;
        i += 2;
      } else {
        counts[ch] = (counts[ch] || 0) + 1;
        i++;
      }
    } else if (ch === '{') {
      const close = pattern.indexOf('}', i);
      if (close !== -1) i = close + 1;
      else i++;
    } else {
      i++;
    }
  }
  return counts;
}

function hasNoPairConstraint(pattern: string): boolean {
  const idx = pattern.indexOf('{');
  if (idx === -1) return false;
  const close = pattern.indexOf('}', idx);
  return close !== -1;
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
    const exclExpanded = expandRankSpan(excl);
    for (const e of exclExpanded) {
      const counts = parseRankCounts(e);
      if (Object.keys(counts).length > 0) allExcludes.push(counts);
    }
  }

  let branchNoPair = noPair;
  if (hasNoPairConstraint(mainPart)) {
    branchNoPair = true;
  }

  const branches: PatternBranch[] = [];
  for (const main of mainExpanded) {
    const include = parseRankCounts(main);
    branches.push({
      include,
      excludes: allExcludes,
      suitFilter,
      noPair: branchNoPair || undefined,
    });
  }
  return branches;
}

function parseToken(token: string): PatternBranch[] {
  let str = token.toUpperCase();

  str = str.replace(/@\d+$/, '');

  let suitFilter: 'ds' | 'ss' | undefined;
  let noPair = false;

  if (/\$DS/i.test(str)) {
    suitFilter = 'ds';
    str = str.replace(/\$DS/gi, '');
  }
  if (/\$SS/i.test(str)) {
    suitFilter = 'ss';
    str = str.replace(/\$SS/gi, '');
  }
  if (/\$NP/i.test(str)) {
    noPair = true;
    str = str.replace(/\$NP/gi, '');
  }
  if (/\$OP/i.test(str)) {
    str = str.replace(/\$OP/gi, '');
  }
  if (/\$TP/i.test(str)) {
    str = str.replace(/\$TP/gi, '');
  }

  if (!suitFilter) {
    if (str.length > 2 && str.endsWith('DS')) {
      suitFilter = 'ds';
      str = str.slice(0, -2).trim();
    } else if (str.length > 2 && str.endsWith('SS')) {
      suitFilter = 'ss';
      str = str.slice(0, -2).trim();
    }
  }

  for (const [re, expansion] of RANK_MACROS) {
    str = str.replace(re, expansion);
  }

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
    } else {
      str = beforeColon + afterColon;
    }
  }

  str = str.trim();

  if (!str) {
    if (suitFilter || noPair) {
      return [{ include: {}, excludes: [], suitFilter, noPair: noPair || undefined }];
    }
    return [];
  }

  const bracketExpanded = expandAllBrackets(str);
  const branches: PatternBranch[] = [];

  for (const pattern of bracketExpanded) {
    branches.push(...parseSinglePattern(pattern, suitFilter, noPair));
  }

  return branches;
}

export function parseRankingsSearch(raw: string): SearchResult {
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

  for (const token of tokens) {
    allBranches.push(...parseToken(token));
  }

  const hasFilter = allBranches.some(b =>
    Object.keys(b.include).length > 0 ||
    b.excludes.length > 0 ||
    b.suitFilter !== undefined ||
    b.noPair
  );

  if (!hasFilter) return null;

  return { type: 'patterns', branches: allBranches, label: trimmed.toUpperCase() };
}

function matchesBranch(
  rankCounts: Record<string, number>,
  suitType: 'ds' | 'ss',
  branch: PatternBranch,
  totalRanks: number
): boolean {
  if (branch.suitFilter && suitType !== branch.suitFilter) return false;

  if (branch.noPair) {
    for (const v of Object.values(rankCounts)) {
      if (v >= 2) return false;
    }
  }

  const includeEntries = Object.entries(branch.include);
  const totalInclude = includeEntries.reduce((sum, [_, count]) => sum + count, 0);

  // If we have exactly 5 ranks specified, it's an exact match search
  if (totalInclude === 5) {
    // For exact 5-card search, we must match the distribution of ranks exactly.
    // E.g. JsTh5dTc4c has J:1, T:2, 5:1, 4:1. totalRanks is always 5 for canonical hands.
    for (const [rank, count] of includeEntries) {
      if ((rankCounts[rank] || 0) !== count) return false;
    }
    // Also ensure no extra ranks exist that aren't in the include list
    for (const rank of Object.keys(rankCounts)) {
      if (!(rank in branch.include)) return false;
    }
  } else {
    // Partial pattern match
    for (const [rank, minCount] of includeEntries) {
      if ((rankCounts[rank] || 0) < minCount) return false;
    }
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

export function matchesHandByCards(
  rankCounts: Record<string, number>,
  suitType: 'ds' | 'ss',
  percentile: number,
  search: SearchResult,
): boolean {
  if (!search) return true;

  if (search.type === 'percent') {
    return percentile >= search.lo && percentile <= search.hi;
  }

  let totalRanks = 0;
  for (const count of Object.values(rankCounts)) {
    totalRanks += count;
  }

  for (const branch of search.branches) {
    if (matchesBranch(rankCounts, suitType, branch, totalRanks)) return true;
  }

  return false;
}

const MAX_FILTER_RESULTS = 100000;

export function filterAllHands(
  data: AllHandsRankings,
  search: SearchResult,
): number[] {
  if (!search) {
    const limit = Math.min(MAX_FILTER_RESULTS, data.totalHands);
    const result = new Array<number>(limit);
    for (let i = 0; i < limit; i++) result[i] = i;
    return result;
  }

  if (search.type === 'percent') {
    const startRank = Math.max(0, Math.floor(search.lo / 100 * data.totalHands));
    const endRank = Math.min(data.totalHands, Math.ceil(search.hi / 100 * data.totalHands));
    const len = Math.min(endRank - startRank, MAX_FILTER_RESULTS);
    const result = new Array<number>(len);
    for (let i = 0; i < len; i++) result[i] = startRank + i;
    return result;
  }

  const result: number[] = [];
  const cardsArr = data.cards;
  const sortArr = data.sortOrder;
  const total = data.totalHands;

  for (let rank = 0; rank < total && result.length < MAX_FILTER_RESULTS; rank++) {
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

    const percentile = ((rank + 1) / total) * 100;

    let totalRanks = 0;
    for (const count of Object.values(rankCounts)) {
      totalRanks += count;
    }

    let matched = false;
    for (const branch of search.branches) {
      if (matchesBranch(rankCounts, suitType, branch, totalRanks)) { matched = true; break; }
    }

    if (matched) result.push(rank);
  }

  return result;
}
