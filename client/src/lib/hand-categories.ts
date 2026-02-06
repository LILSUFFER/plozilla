const RANKS_DECODE = '23456789TJQKA';
const BROADWAY = new Set([14, 13, 12, 11, 10]);

export type PairType = 'unpaired' | 'one_pair' | 'two_pair' | 'trips' | 'other';
export type SuitedType = 'ds' | 'ss' | 'other_suited';
export type UnpairedSub = 'rundown5' | 'rundown4' | 'broadway3' | 'broadway2_low3' | 'ragged';

export interface HandCategory {
  pairType: PairType;
  suitedType: SuitedType;
  unpairedSub?: UnpairedSub;
}

export type CategoryPath =
  | 'all'
  | 'unpaired' | 'unpaired.ds' | 'unpaired.ss'
  | 'unpaired.ds.rundown5' | 'unpaired.ds.rundown4' | 'unpaired.ds.broadway3' | 'unpaired.ds.broadway2_low3' | 'unpaired.ds.ragged'
  | 'unpaired.ss.rundown5' | 'unpaired.ss.rundown4' | 'unpaired.ss.broadway3' | 'unpaired.ss.broadway2_low3' | 'unpaired.ss.ragged'
  | 'one_pair' | 'one_pair.ds' | 'one_pair.ss'
  | 'two_pair' | 'two_pair.ds' | 'two_pair.ss'
  | 'trips' | 'trips.ds' | 'trips.ss';

function cardRank(cardIdx: number): number {
  return (cardIdx >> 2) + 2;
}

function cardSuit(cardIdx: number): number {
  return cardIdx & 3;
}

function classifyPairType(ranks: number[]): PairType {
  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) || 0) + 1);
  const vals = Array.from(counts.values()).sort((a, b) => b - a);
  const key = vals.join('');
  if (key === '11111') return 'unpaired';
  if (key === '2111') return 'one_pair';
  if (key === '221') return 'two_pair';
  if (key === '311') return 'trips';
  return 'other';
}

function classifySuitedType(suits: number[]): SuitedType {
  const counts = new Map<number, number>();
  for (const s of suits) counts.set(s, (counts.get(s) || 0) + 1);
  const vals = Array.from(counts.values()).sort((a, b) => b - a);
  const key = vals.join('');
  if (key === '221') return 'ds';
  if (key === '2111') return 'ss';
  return 'other_suited';
}

function computeGaps(rankSet: number[]): number {
  const sorted = [...rankSet].sort((a, b) => a - b);
  const span = sorted[sorted.length - 1] - sorted[0] + 1;
  return span - sorted.length;
}

function bestGapsForSubset(ranks: number[], subsetSize: number): number {
  const unique = Array.from(new Set(ranks));
  if (unique.length < subsetSize) return Infinity;

  let minGaps = Infinity;

  function combos(start: number, chosen: number[]) {
    if (chosen.length === subsetSize) {
      const g = computeGaps(chosen);
      if (g < minGaps) minGaps = g;
      return;
    }
    const remaining = subsetSize - chosen.length;
    for (let i = start; i <= unique.length - remaining; i++) {
      chosen.push(unique[i]);
      combos(i + 1, chosen);
      chosen.pop();
    }
  }

  combos(0, []);
  return minGaps;
}

function classifyUnpairedSub(cardIndices: number[]): UnpairedSub {
  const ranks = cardIndices.map(cardRank);
  const hasAce = ranks.includes(14);

  const ranksWithWheel = hasAce ? [...ranks, 1] : ranks;

  if (bestGapsForSubset(ranksWithWheel, 5) <= 2) return 'rundown5';
  if (bestGapsForSubset(ranksWithWheel, 4) <= 2) return 'rundown4';

  const broadwayCount = ranks.filter(r => BROADWAY.has(r)).length;
  if (broadwayCount >= 3) return 'broadway3';
  if (broadwayCount === 2) {
    const lowCount = ranks.filter(r => r <= 9).length;
    if (lowCount >= 3) return 'broadway2_low3';
  }
  return 'ragged';
}

export function classifyHand(cardIndices: number[]): HandCategory {
  const ranks = cardIndices.map(cardRank);
  const suits = cardIndices.map(cardSuit);
  const pairType = classifyPairType(ranks);
  const suitedType = classifySuitedType(suits);
  const result: HandCategory = { pairType, suitedType };
  if (pairType === 'unpaired') {
    result.unpairedSub = classifyUnpairedSub(cardIndices);
  }
  return result;
}

export function matchesCategory(cat: HandCategory, path: CategoryPath): boolean {
  if (path === 'all') return true;

  const parts = path.split('.');
  if (cat.pairType !== parts[0]) return false;
  if (parts.length === 1) return true;

  if (cat.suitedType !== parts[1]) return false;
  if (parts.length === 2) return true;

  if (cat.unpairedSub !== parts[2]) return false;
  return true;
}

export interface CategoryNode {
  path: CategoryPath;
  labelKey: string;
  children?: CategoryNode[];
}

const unpairedSubs: CategoryNode[] = [
  { path: 'unpaired.ds.rundown5' as CategoryPath, labelKey: 'catRundown5' },
  { path: 'unpaired.ds.rundown4' as CategoryPath, labelKey: 'catRundown4' },
  { path: 'unpaired.ds.broadway3' as CategoryPath, labelKey: 'catBroadway3' },
  { path: 'unpaired.ds.broadway2_low3' as CategoryPath, labelKey: 'catBroadway2Low3' },
  { path: 'unpaired.ds.ragged' as CategoryPath, labelKey: 'catRagged' },
];

function makeUnpairedSubsForSuit(suitPrefix: string): CategoryNode[] {
  return unpairedSubs.map(n => ({
    ...n,
    path: n.path.replace('unpaired.ds', `unpaired.${suitPrefix}`) as CategoryPath,
  }));
}

export const CATEGORY_TREE: CategoryNode[] = [
  { path: 'all', labelKey: 'catAll' },
  {
    path: 'unpaired', labelKey: 'catUnpaired', children: [
      { path: 'unpaired.ds', labelKey: 'catDS', children: makeUnpairedSubsForSuit('ds') },
      { path: 'unpaired.ss', labelKey: 'catSS', children: makeUnpairedSubsForSuit('ss') },
    ],
  },
  {
    path: 'one_pair', labelKey: 'catOnePair', children: [
      { path: 'one_pair.ds', labelKey: 'catDS' },
      { path: 'one_pair.ss', labelKey: 'catSS' },
    ],
  },
  {
    path: 'two_pair', labelKey: 'catTwoPair', children: [
      { path: 'two_pair.ds', labelKey: 'catDS' },
      { path: 'two_pair.ss', labelKey: 'catSS' },
    ],
  },
  {
    path: 'trips', labelKey: 'catTrips', children: [
      { path: 'trips.ds', labelKey: 'catDS' },
      { path: 'trips.ss', labelKey: 'catSS' },
    ],
  },
];
