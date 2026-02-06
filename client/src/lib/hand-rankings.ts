import type { Rank, Suit, Card } from './poker-evaluator';

const RANK_VALS = [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2] as const;
const VAL_TO_RANK: Record<number, Rank> = {
  14: 'A', 13: 'K', 12: 'Q', 11: 'J', 10: 'T',
  9: '9', 8: '8', 7: '7', 6: '6', 5: '5', 4: '4', 3: '3', 2: '2'
};

export const TOTAL_5CARD_HANDS = 2598960;

export interface RankedHand {
  cards: Card[];
  score: number;
  combos: number;
  suitType: 'ds' | 'ss';
  rankKey: string;
  percentile: number;
}

const SUBSETS: number[][][] = [
  [[]],
  [[0], [1], [2], [3]],
  [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]],
  [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]],
  [[0, 1, 2, 3]],
];

const C4 = [1, 4, 6, 4, 1];

function countSuitAssignments(mults: number[], target: number[], idx: number): number {
  if (idx === mults.length) {
    return (target[0] === 0 && target[1] === 0 && target[2] === 0 && target[3] === 0) ? 1 : 0;
  }

  const ci = mults[idx];
  let total = 0;

  for (const subset of SUBSETS[ci]) {
    let nt0 = target[0], nt1 = target[1], nt2 = target[2], nt3 = target[3];
    let valid = true;
    for (let s = 0; s < ci; s++) {
      const suit = subset[s];
      if (suit === 0) { nt0--; if (nt0 < 0) { valid = false; break; } }
      else if (suit === 1) { nt1--; if (nt1 < 0) { valid = false; break; } }
      else if (suit === 2) { nt2--; if (nt2 < 0) { valid = false; break; } }
      else { nt3--; if (nt3 < 0) { valid = false; break; } }
    }
    if (valid) {
      total += countSuitAssignments(mults, [nt0, nt1, nt2, nt3], idx + 1);
    }
  }

  return total;
}

function computeTotalCombos(mults: number[]): number {
  let total = 1;
  for (const m of mults) total *= C4[m];
  return total;
}

function computeDSCombos(mults: number[]): number {
  return 12 * countSuitAssignments(mults, [2, 2, 1, 0], 0);
}

function assignDS(ranks: number[]): Card[] | null {
  let bestCards: Card[] | null = null;
  let bestScore = -1;

  for (let i = 0; i < 5; i++) {
    for (let j = i + 1; j < 5; j++) {
      if (ranks[i] === ranks[j]) continue;
      for (let k = 0; k < 5; k++) {
        if (k === i || k === j) continue;
        for (let l = k + 1; l < 5; l++) {
          if (l === i || l === j) continue;
          if (ranks[k] === ranks[l]) continue;

          const a1 = Math.max(ranks[i], ranks[j]);
          const b1 = Math.min(ranks[i], ranks[j]);
          const a2 = Math.max(ranks[k], ranks[l]);
          const b2 = Math.min(ranks[k], ranks[l]);
          const p1 = a1 * 100 + b1;
          const p2 = a2 * 100 + b2;
          const hi = Math.max(p1, p2);
          const lo = Math.min(p1, p2);
          const score = hi * 10000 + lo;

          if (score > bestScore) {
            bestScore = score;
            const m = [0, 1, 2, 3, 4].find(x => x !== i && x !== j && x !== k && x !== l)!;
            const suits: Suit[] = ['c', 'c', 'c', 'c', 'c'];
            if (p1 >= p2) {
              suits[i] = 's'; suits[j] = 's';
              suits[k] = 'h'; suits[l] = 'h';
            } else {
              suits[k] = 's'; suits[l] = 's';
              suits[i] = 'h'; suits[j] = 'h';
            }
            suits[m] = 'd';
            bestCards = ranks.map((r, idx) => ({
              rank: VAL_TO_RANK[r],
              suit: suits[idx],
            }));
          }
        }
      }
    }
  }

  return bestCards;
}

function assignSS(ranks: number[]): Card[] {
  let bestI = 0, bestJ = 1;
  let bestScore = -1;

  for (let i = 0; i < 5; i++) {
    for (let j = i + 1; j < 5; j++) {
      if (ranks[i] === ranks[j]) continue;
      const score = Math.max(ranks[i], ranks[j]) * 100 + Math.min(ranks[i], ranks[j]);
      if (score > bestScore) {
        bestScore = score;
        bestI = i;
        bestJ = j;
      }
    }
  }

  const suits: Suit[] = ['c', 'c', 'c', 'c', 'c'];
  suits[bestI] = 's';
  suits[bestJ] = 's';
  const remainSuits: Suit[] = ['h', 'd', 'c'];
  let si = 0;
  for (let k = 0; k < 5; k++) {
    if (k !== bestI && k !== bestJ) {
      suits[k] = remainSuits[si++];
    }
  }

  return ranks.map((r, idx) => ({
    rank: VAL_TO_RANK[r],
    suit: suits[idx],
  }));
}

const PAIR_BONUS: Record<number, number> = {
  14: 18, 13: 14, 12: 11, 11: 9, 10: 6,
  9: 4, 8: 3, 7: 2, 6: 1.5, 5: 1, 4: 0.5, 3: 0.5, 2: 0.5
};

function scoreHand(ranks: number[], suitType: 'ds' | 'ss'): number {
  const sorted = [...ranks].sort((a, b) => b - a);
  let score = 0;

  const weights = [2.5, 2.0, 1.5, 1.0, 0.5];
  for (let i = 0; i < 5; i++) {
    score += (sorted[i] - 2) * weights[i];
  }

  const cnt = new Uint8Array(15);
  for (const r of ranks) cnt[r]++;

  const pairs: number[] = [];
  let tripsRank = 0;
  let hasQuads = false;

  for (let rank = 2; rank <= 14; rank++) {
    if (cnt[rank] === 2) pairs.push(rank);
    if (cnt[rank] === 3) tripsRank = rank;
    if (cnt[rank] >= 4) hasQuads = true;
  }

  if (hasQuads) {
    score -= 25;
  } else if (tripsRank > 0) {
    score -= 10;
    score += Math.max(0, (tripsRank - 8) * 0.5);
  } else {
    for (const p of pairs) {
      score += PAIR_BONUS[p] || 0.5;
    }
    if (pairs.length >= 2) score += 5;
  }

  const uniqueSet = new Set<number>();
  for (const r of ranks) uniqueSet.add(r);
  const unique = Array.from(uniqueSet).sort((a, b) => b - a);

  let bestWindowCount = 0;
  let bestWindowHigh = 0;

  for (let base = 2; base <= 10; base++) {
    let count = 0;
    for (const r of unique) {
      if (r >= base && r <= base + 4) count++;
    }
    if (count > bestWindowCount || (count === bestWindowCount && base + 4 > bestWindowHigh)) {
      bestWindowCount = count;
      bestWindowHigh = base + 4;
    }
  }

  {
    let count = 0;
    for (const r of unique) {
      if (r === 14 || (r >= 2 && r <= 5)) count++;
    }
    if (count > bestWindowCount) {
      bestWindowCount = count;
      bestWindowHigh = 5;
    }
  }

  const connectBonuses = [0, 0, 1, 5, 11, 18];
  score += connectBonuses[Math.min(bestWindowCount, 5)];

  if (bestWindowCount >= 3 && bestWindowHigh >= 12) score += 2;

  let maxConsec = 1, curConsec = 1;
  for (let i = 1; i < unique.length; i++) {
    if (unique[i - 1] - unique[i] === 1) {
      curConsec++;
      if (curConsec > maxConsec) maxConsec = curConsec;
    } else {
      curConsec = 1;
    }
  }
  if (maxConsec >= 5) score += 7;
  else if (maxConsec >= 4) score += 5;
  else if (maxConsec >= 3) score += 2;

  if (suitType === 'ds') {
    score += 5;
  } else {
    score += 2;
  }
  if (sorted[0] === 14) score += 2;
  else if (sorted[0] === 13) score += 1;

  for (const r of unique) {
    let minGap = Infinity;
    for (const other of unique) {
      if (other === r) continue;
      minGap = Math.min(minGap, Math.abs(r - other));
    }
    if (minGap !== Infinity) {
      if (minGap >= 5) score -= 4;
      else if (minGap >= 4) score -= 2;
    }
  }

  return Math.round(score * 100) / 100;
}

function makeRankKey(ranks: number[]): string {
  return ranks.map(r => VAL_TO_RANK[r]).join('');
}

let cachedHands: RankedHand[] | null = null;

export function generateRankedHands(): RankedHand[] {
  if (cachedHands) return cachedHands;

  const hands: RankedHand[] = [];

  for (let a = 0; a < 13; a++) {
    for (let b = a; b < 13; b++) {
      for (let c = b; c < 13; c++) {
        for (let d = c; d < 13; d++) {
          for (let e = d; e < 13; e++) {
            const ranks = [RANK_VALS[a], RANK_VALS[b], RANK_VALS[c], RANK_VALS[d], RANK_VALS[e]];

            const cnt = new Uint8Array(15);
            let maxCnt = 0;
            for (const r of ranks) {
              cnt[r]++;
              if (cnt[r] > maxCnt) maxCnt = cnt[r];
            }
            if (maxCnt > 4) continue;

            const mults: number[] = [];
            for (let r = 14; r >= 2; r--) {
              if (cnt[r] > 0) mults.push(cnt[r]);
            }

            const total = computeTotalCombos(mults);
            const dsCombos = computeDSCombos(mults);
            const rankKey = makeRankKey(ranks);

            if (dsCombos > 0) {
              const dsCards = assignDS(ranks);
              if (dsCards) {
                hands.push({
                  cards: dsCards,
                  score: scoreHand(ranks, 'ds'),
                  combos: dsCombos,
                  suitType: 'ds',
                  rankKey,
                  percentile: 0,
                });
              }
            }

            const nonDsCombos = total - dsCombos;
            if (nonDsCombos > 0) {
              const ssCards = assignSS(ranks);
              hands.push({
                cards: ssCards,
                score: scoreHand(ranks, 'ss'),
                combos: nonDsCombos,
                suitType: 'ss',
                rankKey,
                percentile: 0,
              });
            }
          }
        }
      }
    }
  }

  hands.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.suitType !== b.suitType) return a.suitType === 'ds' ? -1 : 1;
    return a.rankKey < b.rankKey ? -1 : a.rankKey > b.rankKey ? 1 : 0;
  });

  let cumCombos = 0;
  for (const h of hands) {
    cumCombos += h.combos;
    h.percentile = Math.round((cumCombos / TOTAL_5CARD_HANDS) * 10000) / 100;
  }

  cachedHands = hands;
  return hands;
}
