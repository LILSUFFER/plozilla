import type { Rank, Suit, Card } from './poker-evaluator';
import type { HandGroupData, WorkerResponse } from './rankings-worker';

const RANK_VALS = [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2] as const;
const VAL_TO_RANK: Record<number, Rank> = {
  14: 'A', 13: 'K', 12: 'Q', 11: 'J', 10: 'T',
  9: '9', 8: '8', 7: '7', 6: '6', 5: '5', 4: '4', 3: '3', 2: '2'
};

const RC: Record<string, number> = {'2':0,'3':1,'4':2,'5':3,'6':4,'7':5,'8':6,'9':7,'T':8,'J':9,'Q':10,'K':11,'A':12};
const SC: Record<string, number> = {'c':0,'d':1,'h':2,'s':3};

function encodeCard(card: Card): number {
  return RC[card.rank] * 4 + SC[card.suit];
}

export const TOTAL_5CARD_HANDS = 2598960;
const RANKINGS_VERSION = 2;
const SAMPLES_PER_HAND = 2000;
const IDB_DB_NAME = 'plozilla-rankings';
const IDB_STORE_NAME = 'rankings';

export interface RankedHand {
  cards: Card[];
  score: number;
  equity: number;
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

function makeRankKey(ranks: number[]): string {
  return ranks.map(r => VAL_TO_RANK[r]).join('');
}

interface HandGroupRaw {
  cards: Card[];
  combos: number;
  suitType: 'ds' | 'ss';
  rankKey: string;
  encodedCards: number[];
}

function generateHandGroups(): HandGroupRaw[] {
  const groups: HandGroupRaw[] = [];

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
                groups.push({
                  cards: dsCards,
                  combos: dsCombos,
                  suitType: 'ds',
                  rankKey,
                  encodedCards: dsCards.map(encodeCard),
                });
              }
            }

            const nonDsCombos = total - dsCombos;
            if (nonDsCombos > 0) {
              const ssCards = assignSS(ranks);
              groups.push({
                cards: ssCards,
                combos: nonDsCombos,
                suitType: 'ss',
                rankKey,
                encodedCards: ssCards.map(encodeCard),
              });
            }
          }
        }
      }
    }
  }

  return groups;
}

async function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getCachedRankings(): Promise<RankedHand[] | null> {
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readonly');
      const store = tx.objectStore(IDB_STORE_NAME);
      const req = store.get(`v${RANKINGS_VERSION}`);
      req.onsuccess = () => {
        db.close();
        resolve(req.result || null);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

async function setCachedRankings(hands: RankedHand[]): Promise<void> {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
    const store = tx.objectStore(IDB_STORE_NAME);
    store.put(hands, `v${RANKINGS_VERSION}`);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch {
  }
}

let cachedHands: RankedHand[] | null = null;

export function getCachedRankedHands(): RankedHand[] | null {
  return cachedHands;
}

export type RankingsProgress = {
  stage: 'loading' | 'computing' | 'done';
  current?: number;
  total?: number;
};

export async function generateRankedHandsAsync(
  onProgress?: (p: RankingsProgress) => void
): Promise<RankedHand[]> {
  if (cachedHands) return cachedHands;

  const cached = await getCachedRankings();
  if (cached && cached.length > 0) {
    cachedHands = cached;
    onProgress?.({ stage: 'done' });
    return cached;
  }

  onProgress?.({ stage: 'loading' });

  const groups = generateHandGroups();
  const workerData: HandGroupData[] = groups.map(g => ({
    encodedCards: g.encodedCards,
  }));

  const equities = await new Promise<number[]>((resolve, reject) => {
    const worker = new Worker(
      new URL('./rankings-worker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      if (msg.type === 'status') {
        onProgress?.({ stage: msg.message === 'loading' ? 'loading' : 'computing' });
      } else if (msg.type === 'progress') {
        onProgress?.({ stage: 'computing', current: msg.current, total: msg.total });
      } else if (msg.type === 'complete') {
        worker.terminate();
        resolve(msg.equities);
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      reject(err);
    };

    worker.postMessage({
      type: 'compute',
      hands: workerData,
      samplesPerHand: SAMPLES_PER_HAND,
    } as import('./rankings-worker').WorkerMessage);
  });

  const hands: RankedHand[] = groups.map((g, i) => ({
    cards: g.cards,
    score: equities[i],
    equity: equities[i],
    combos: g.combos,
    suitType: g.suitType,
    rankKey: g.rankKey,
    percentile: 0,
  }));

  hands.sort((a, b) => {
    if (b.equity !== a.equity) return b.equity - a.equity;
    if (a.suitType !== b.suitType) return a.suitType === 'ds' ? -1 : 1;
    return a.rankKey < b.rankKey ? -1 : a.rankKey > b.rankKey ? 1 : 0;
  });

  let cumCombos = 0;
  for (const h of hands) {
    cumCombos += h.combos;
    h.percentile = Math.round((cumCombos / TOTAL_5CARD_HANDS) * 10000) / 100;
  }

  cachedHands = hands;
  onProgress?.({ stage: 'done' });

  setCachedRankings(hands);

  return hands;
}

export function generateRankedHands(): RankedHand[] {
  if (cachedHands) return cachedHands;
  return [];
}
