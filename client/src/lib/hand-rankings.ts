import type { Rank, Suit, Card } from './poker-evaluator';

const RANK_VALS = [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2] as const;
const VAL_TO_RANK: Record<number, Rank> = {
  14: 'A', 13: 'K', 12: 'Q', 11: 'J', 10: 'T',
  9: '9', 8: '8', 7: '7', 6: '6', 5: '5', 4: '4', 3: '3', 2: '2'
};

export interface RankedHand {
  cards: Card[];
  score: number;
  combos: number;
  suitType: 'ds' | 'ss';
}

const ALL_PERMS: number[][] = [];
(function initPerms() {
  const arr = [0, 1, 2, 3];
  function permute(start: number) {
    if (start === arr.length) {
      ALL_PERMS.push([...arr]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      [arr[start], arr[i]] = [arr[i], arr[start]];
      permute(start + 1);
      [arr[start], arr[i]] = [arr[i], arr[start]];
    }
  }
  permute(0);
})();

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

const PAIR_BONUSES: Record<number, number> = {
  14: 30, 13: 24, 12: 19, 11: 15, 10: 12, 9: 9, 8: 7, 7: 5, 6: 4, 5: 3, 4: 2.5, 3: 2, 2: 1.5
};

function scoreHand(ranks: number[], suitType: 'ds' | 'ss'): number {
  const sorted = [...ranks].sort((a, b) => b - a);
  let score = 0;

  const weights = [2.0, 1.8, 1.5, 1.2, 1.0];
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
    score -= 30;
  } else if (tripsRank > 0) {
    score -= 12;
    score += Math.max(0, (tripsRank - 8) * 0.5);
  } else {
    for (const p of pairs) {
      score += PAIR_BONUSES[p] || 1;
    }
    if (pairs.length >= 2) score += 10;
  }

  if (suitType === 'ds') {
    score += 14;
    if (sorted[0] === 14) score += 3;
  } else {
    if (sorted[0] === 14) score += 9;
    else if (sorted[0] === 13) score += 7;
    else score += 5;
  }

  const uniqueSet: Record<number, boolean> = {};
  const unique: number[] = [];
  for (const r of sorted) {
    if (!uniqueSet[r]) { uniqueSet[r] = true; unique.push(r); }
  }
  let maxInWindow = 0;

  for (let base = 2; base <= 10; base++) {
    let count = 0;
    for (const r of unique) {
      if (r >= base && r <= base + 4) count++;
    }
    if (count > maxInWindow) maxInWindow = count;
  }

  const wheelRanks: number[] = [];
  for (const r of unique) wheelRanks.push(r === 14 ? 1 : r);
  const wheelSet: Record<number, boolean> = {};
  const uniqueWheel: number[] = [];
  for (const r of wheelRanks) {
    if (!wheelSet[r]) { wheelSet[r] = true; uniqueWheel.push(r); }
  }
  for (let base = 1; base <= 6; base++) {
    let count = 0;
    for (const r of uniqueWheel) {
      if (r >= base && r <= base + 4) count++;
    }
    if (count > maxInWindow) maxInWindow = count;
  }

  const connectBonuses = [0, 0, 4, 12, 20, 28];
  score += connectBonuses[Math.min(maxInWindow, 5)];

  let maxTight = 1, currentTight = 1;
  for (let i = 1; i < unique.length; i++) {
    if (unique[i - 1] - unique[i] === 1) {
      currentTight++;
      if (currentTight > maxTight) maxTight = currentTight;
    } else {
      currentTight = 1;
    }
  }
  if (maxTight >= 5) score += 8;
  else if (maxTight >= 4) score += 6;
  else if (maxTight >= 3) score += 3;

  if (maxInWindow >= 3) {
    let highCount = 0;
    for (const r of unique) {
      if (r >= 10) highCount++;
    }
    if (highCount >= 3) score += 6;
  }

  return Math.round(score * 100) / 100;
}

function computeCombos(cards: Card[]): number {
  const suitToIdx: Record<string, number> = { s: 0, h: 1, d: 2, c: 3 };
  const rankVal: Record<string, number> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
    '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
  };

  const encoded = new Set(cards.map(c => rankVal[c.rank] * 4 + suitToIdx[c.suit]));
  const cardSuits = cards.map(c => suitToIdx[c.suit]);
  const cardRanks = cards.map(c => rankVal[c.rank]);

  let auto = 0;
  for (const perm of ALL_PERMS) {
    let match = true;
    for (let i = 0; i < 5; i++) {
      if (!encoded.has(cardRanks[i] * 4 + perm[cardSuits[i]])) {
        match = false;
        break;
      }
    }
    if (match) auto++;
  }

  return 24 / auto;
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

            let maxCount = 0;
            const cnt = new Uint8Array(15);
            for (const r of ranks) {
              cnt[r]++;
              if (cnt[r] > maxCount) maxCount = cnt[r];
            }
            if (maxCount > 4) continue;

            const dsCards = assignDS(ranks);
            if (dsCards) {
              hands.push({
                cards: dsCards,
                score: scoreHand(ranks, 'ds'),
                combos: computeCombos(dsCards),
                suitType: 'ds',
              });
            }

            const ssCards = assignSS(ranks);
            hands.push({
              cards: ssCards,
              score: scoreHand(ranks, 'ss'),
              combos: computeCombos(ssCards),
              suitType: 'ss',
            });
          }
        }
      }
    }
  }

  hands.sort((a, b) => b.score - a.score);
  cachedHands = hands;
  return hands;
}
