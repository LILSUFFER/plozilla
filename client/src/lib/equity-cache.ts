// Equity cache with suit canonicalization for preflop calculations
// Uses IndexedDB for persistent storage

import type { Card } from './poker-evaluator';

interface CachedEquity {
  equity1: number;
  equity2: number;
  runouts: number;
}

const DB_NAME = 'PokerEquityCache';
const DB_VERSION = 1;
const STORE_NAME = 'preflop_equities';

let db: IDBDatabase | null = null;
let dbReady: Promise<void> | null = null;
const memoryCache = new Map<string, CachedEquity>();

async function openDB(): Promise<void> {
  if (db) return;
  if (dbReady) return dbReady;
  
  dbReady = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      console.warn('IndexedDB not available, using memory cache only');
      resolve();
    };
    
    request.onsuccess = () => {
      db = request.result;
      console.log('Equity cache database opened');
      resolve();
    };
    
    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
  });
  
  return dbReady;
}

function canonicalizeHand(cards: Card[]): string {
  const suitMap = new Map<string, number>();
  let nextSuit = 0;
  const SUIT_CHARS = ['a', 'b', 'c', 'd'];
  
  const normalized = cards.map(card => {
    let mappedSuit = suitMap.get(card.suit);
    if (mappedSuit === undefined) {
      mappedSuit = nextSuit++;
      suitMap.set(card.suit, mappedSuit);
    }
    return { rank: card.rank, suit: SUIT_CHARS[mappedSuit] };
  });
  
  normalized.sort((a, b) => {
    const rankOrder = '23456789TJQKA';
    const rankDiff = rankOrder.indexOf(b.rank) - rankOrder.indexOf(a.rank);
    if (rankDiff !== 0) return rankDiff;
    return a.suit.localeCompare(b.suit);
  });
  
  return normalized.map(c => c.rank + c.suit).join('');
}

function canonicalizeMatchup(hand1: Card[], hand2: Card[]): string {
  const allCards = [...hand1, ...hand2];
  const suitMap = new Map<string, number>();
  let nextSuit = 0;
  const SUIT_CHARS = ['a', 'b', 'c', 'd'];
  
  const mapCard = (card: Card) => {
    let mappedSuit = suitMap.get(card.suit);
    if (mappedSuit === undefined) {
      mappedSuit = nextSuit++;
      suitMap.set(card.suit, mappedSuit);
    }
    return { rank: card.rank, suit: SUIT_CHARS[mappedSuit] };
  };
  
  const norm1 = hand1.map(mapCard);
  const norm2 = hand2.map(mapCard);
  
  const sortCards = (cards: {rank: string, suit: string}[]) => {
    const rankOrder = '23456789TJQKA';
    return [...cards].sort((a, b) => {
      const rankDiff = rankOrder.indexOf(b.rank) - rankOrder.indexOf(a.rank);
      if (rankDiff !== 0) return rankDiff;
      return a.suit.localeCompare(b.suit);
    });
  };
  
  const sorted1 = sortCards(norm1);
  const sorted2 = sortCards(norm2);
  
  const key1 = sorted1.map(c => c.rank + c.suit).join('');
  const key2 = sorted2.map(c => c.rank + c.suit).join('');
  
  if (key1 <= key2) {
    return `${key1}|${key2}`;
  } else {
    return `${key2}|${key1}|swap`;
  }
}

export async function getCachedEquity(hand1: Card[], hand2: Card[]): Promise<CachedEquity | null> {
  await openDB();
  
  const key = canonicalizeMatchup(hand1, hand2);
  
  if (memoryCache.has(key)) {
    const cached = memoryCache.get(key)!;
    if (key.endsWith('|swap')) {
      return { equity1: cached.equity2, equity2: cached.equity1, runouts: cached.runouts };
    }
    return cached;
  }
  
  if (!db) return null;
  
  return new Promise((resolve) => {
    const transaction = db!.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const baseKey = key.replace('|swap', '');
    const request = store.get(baseKey);
    
    request.onsuccess = () => {
      if (request.result) {
        const cached = request.result as { key: string, equity1: number, equity2: number, runouts: number };
        memoryCache.set(baseKey, { equity1: cached.equity1, equity2: cached.equity2, runouts: cached.runouts });
        if (key.endsWith('|swap')) {
          resolve({ equity1: cached.equity2, equity2: cached.equity1, runouts: cached.runouts });
        } else {
          resolve({ equity1: cached.equity1, equity2: cached.equity2, runouts: cached.runouts });
        }
      } else {
        resolve(null);
      }
    };
    
    request.onerror = () => resolve(null);
  });
}

export async function setCachedEquity(
  hand1: Card[],
  hand2: Card[],
  equity1: number,
  equity2: number,
  runouts: number
): Promise<void> {
  await openDB();
  
  const key = canonicalizeMatchup(hand1, hand2);
  const baseKey = key.replace('|swap', '');
  const swapped = key.endsWith('|swap');
  
  const data = swapped
    ? { equity1: equity2, equity2: equity1, runouts }
    : { equity1, equity2, runouts };
  
  memoryCache.set(baseKey, data);
  
  if (!db) return;
  
  return new Promise((resolve) => {
    const transaction = db!.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put({ key: baseKey, ...data });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
  });
}

export function getMemoryCacheSize(): number {
  return memoryCache.size;
}
