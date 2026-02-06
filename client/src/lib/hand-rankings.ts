import type { Rank, Suit, Card } from './poker-evaluator';
import type { WorkerResponse } from './rankings-worker';

const RANKS_DECODE = '23456789TJQKA';
const SUITS_DECODE = 'cdhs';

export const TOTAL_5CARD_HANDS = 2598960;
const RANKINGS_VERSION = 3;
const TRIALS_PER_HAND = 50;
const IDB_DB_NAME = 'plozilla-rankings';
const IDB_STORE_NAME = 'rankings';

export interface AllHandsRankings {
  cards: Uint8Array;
  equities: Float32Array;
  sortOrder: Uint32Array;
  totalHands: number;
}

export function cardIndexToCard(idx: number): Card {
  return {
    rank: RANKS_DECODE[idx >> 2] as Rank,
    suit: SUITS_DECODE[idx & 3] as Suit,
  };
}

export function getHandCards(data: AllHandsRankings, origIdx: number): Card[] {
  const cards: Card[] = [];
  const base = origIdx * 5;
  for (let i = 0; i < 5; i++) {
    cards.push(cardIndexToCard(data.cards[base + i]));
  }
  return cards;
}

export function getHandSuitType(data: AllHandsRankings, origIdx: number): 'ds' | 'ss' {
  const sc = [0, 0, 0, 0];
  const base = origIdx * 5;
  for (let i = 0; i < 5; i++) {
    sc[data.cards[base + i] & 3]++;
  }
  let pairs = 0;
  for (const c of sc) if (c >= 2) pairs++;
  return pairs >= 2 ? 'ds' : 'ss';
}

export function getHandRankCounts(data: AllHandsRankings, origIdx: number): Record<string, number> {
  const counts: Record<string, number> = {};
  const base = origIdx * 5;
  for (let i = 0; i < 5; i++) {
    const r = RANKS_DECODE[data.cards[base + i] >> 2];
    counts[r] = (counts[r] || 0) + 1;
  }
  return counts;
}

export interface RankedHand {
  cards: Card[];
  score: number;
  equity: number;
  combos: number;
  suitType: 'ds' | 'ss';
  rankKey: string;
  percentile: number;
}

export type RankingsProgress = {
  stage: 'loading' | 'computing' | 'sorting' | 'done';
  current?: number;
  total?: number;
};

async function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB_NAME, 2);
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

async function getCachedRankings(): Promise<AllHandsRankings | null> {
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readonly');
      const store = tx.objectStore(IDB_STORE_NAME);
      const req = store.get(`v${RANKINGS_VERSION}`);
      req.onsuccess = () => {
        db.close();
        const d = req.result;
        if (d && d.cards && d.equities && d.sortOrder) {
          resolve({
            cards: new Uint8Array(d.cards),
            equities: new Float32Array(d.equities),
            sortOrder: new Uint32Array(d.sortOrder),
            totalHands: TOTAL_5CARD_HANDS,
          });
        } else {
          resolve(null);
        }
      };
      req.onerror = () => { db.close(); resolve(null); };
    });
  } catch {
    return null;
  }
}

async function setCachedRankings(data: AllHandsRankings): Promise<void> {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
    const store = tx.objectStore(IDB_STORE_NAME);
    store.put({
      cards: data.cards.buffer.slice(0),
      equities: data.equities.buffer.slice(0),
      sortOrder: data.sortOrder.buffer.slice(0),
    }, `v${RANKINGS_VERSION}`);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch {
  }
}

let cachedData: AllHandsRankings | null = null;

export function getCachedAllHands(): AllHandsRankings | null {
  return cachedData;
}

export async function generateAllHandsAsync(
  onProgress?: (p: RankingsProgress) => void
): Promise<AllHandsRankings> {
  if (cachedData) return cachedData;

  const cached = await getCachedRankings();
  if (cached) {
    cachedData = cached;
    onProgress?.({ stage: 'done' });
    return cached;
  }

  onProgress?.({ stage: 'loading' });

  const data = await new Promise<AllHandsRankings>((resolve, reject) => {
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
        resolve({
          cards: new Uint8Array(msg.cards),
          equities: new Float32Array(msg.equities),
          sortOrder: new Uint32Array(msg.sortOrder),
          totalHands: TOTAL_5CARD_HANDS,
        });
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      reject(err);
    };

    worker.postMessage({
      type: 'compute',
      trialsPerHand: TRIALS_PER_HAND,
    });
  });

  cachedData = data;
  onProgress?.({ stage: 'done' });
  setCachedRankings(data);
  return data;
}

export function getCachedRankedHands(): RankedHand[] | null {
  return null;
}

export function generateRankedHands(): RankedHand[] {
  return [];
}

export async function generateRankedHandsAsync(
  onProgress?: (p: RankingsProgress) => void
): Promise<RankedHand[]> {
  return [];
}
