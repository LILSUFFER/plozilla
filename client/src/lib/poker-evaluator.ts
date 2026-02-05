export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const;
export const SUITS = ['c', 'd', 'h', 's'] as const;

export type Rank = typeof RANKS[number];
export type Suit = typeof SUITS[number];

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type HandCategory = 
  | 'Royal Flush'
  | 'Straight Flush'
  | 'Four of a Kind'
  | 'Full House'
  | 'Flush'
  | 'Straight'
  | 'Three of a Kind'
  | 'Two Pair'
  | 'One Pair'
  | 'High Card';

export interface HandResult {
  category: HandCategory;
  categoryRank: number;
  handRank: number;
  totalHands: number;
  percentile: number;
  description: string;
  kickers: number[];
}

const RANK_VALUES: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

const CATEGORY_RANKS: Record<HandCategory, number> = {
  'Royal Flush': 10,
  'Straight Flush': 9,
  'Four of a Kind': 8,
  'Full House': 7,
  'Flush': 6,
  'Straight': 5,
  'Three of a Kind': 4,
  'Two Pair': 3,
  'One Pair': 2,
  'High Card': 1
};

const HAND_COUNTS: Record<HandCategory, number> = {
  'Royal Flush': 4,
  'Straight Flush': 36,
  'Four of a Kind': 624,
  'Full House': 3744,
  'Flush': 5108,
  'Straight': 10200,
  'Three of a Kind': 54912,
  'Two Pair': 123552,
  'One Pair': 1098240,
  'High Card': 1302540
};

const TOTAL_HANDS = 2598960;

export function parseCard(str: string): Card | null {
  const cleaned = str.trim().toUpperCase();
  if (cleaned.length < 2) return null;
  
  let rank = cleaned[0];
  let suit = cleaned[1].toLowerCase();
  
  if (rank === '1' && cleaned[1] === '0') {
    rank = 'T';
    suit = cleaned[2]?.toLowerCase() || '';
  }
  
  if (!RANKS.includes(rank as Rank)) return null;
  if (!SUITS.includes(suit as Suit)) return null;
  
  return { rank: rank as Rank, suit: suit as Suit };
}

export function parseHand(input: string): Card[] | null {
  const parts = input.trim().split(/[\s,]+/).filter(Boolean);
  if (parts.length !== 5) return null;
  
  const cards: Card[] = [];
  const seen = new Set<string>();
  
  for (const part of parts) {
    const card = parseCard(part);
    if (!card) return null;
    
    const key = `${card.rank}${card.suit}`;
    if (seen.has(key)) return null;
    seen.add(key);
    
    cards.push(card);
  }
  
  return cards;
}

export function cardToString(card: Card): string {
  return `${card.rank}${card.suit}`;
}

export function handToString(cards: Card[]): string {
  return cards.map(cardToString).join(' ');
}

function getRankCounts(cards: Card[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const card of cards) {
    const val = RANK_VALUES[card.rank];
    counts.set(val, (counts.get(val) || 0) + 1);
  }
  return counts;
}

function getSuitCounts(cards: Card[]): Map<Suit, number> {
  const counts = new Map<Suit, number>();
  for (const card of cards) {
    counts.set(card.suit, (counts.get(card.suit) || 0) + 1);
  }
  return counts;
}

function isFlush(cards: Card[]): boolean {
  const suitCounts = getSuitCounts(cards);
  return Array.from(suitCounts.values()).some(count => count === 5);
}

function getStraightHighCard(cards: Card[]): number | null {
  const values = cards.map(c => RANK_VALUES[c.rank]);
  const unique = [...new Set(values)].sort((a, b) => b - a);
  
  if (unique.length !== 5) return null;
  
  if (unique[0] - unique[4] === 4) {
    return unique[0];
  }
  
  if (unique[0] === 14 && unique[1] === 5 && unique[2] === 4 && unique[3] === 3 && unique[4] === 2) {
    return 5;
  }
  
  return null;
}

function isStraight(cards: Card[]): boolean {
  return getStraightHighCard(cards) !== null;
}

export function evaluateHand(cards: Card[]): HandResult {
  if (cards.length !== 5) {
    throw new Error('Hand must contain exactly 5 cards');
  }
  
  const rankCounts = getRankCounts(cards);
  const values = cards.map(c => RANK_VALUES[c.rank]).sort((a, b) => b - a);
  const flush = isFlush(cards);
  const straightHigh = getStraightHighCard(cards);
  const straight = straightHigh !== null;
  
  const countGroups = new Map<number, number[]>();
  for (const [rank, count] of rankCounts) {
    if (!countGroups.has(count)) countGroups.set(count, []);
    countGroups.get(count)!.push(rank);
  }
  
  for (const ranks of countGroups.values()) {
    ranks.sort((a, b) => b - a);
  }
  
  let category: HandCategory;
  let kickers: number[] = [];
  let description: string;
  
  if (flush && straight && straightHigh === 14) {
    category = 'Royal Flush';
    kickers = [14];
    description = 'Royal Flush';
  } else if (flush && straight) {
    category = 'Straight Flush';
    kickers = [straightHigh!];
    description = `Straight Flush, ${rankName(straightHigh!)} high`;
  } else if (countGroups.has(4)) {
    category = 'Four of a Kind';
    const quad = countGroups.get(4)![0];
    const kicker = countGroups.get(1)![0];
    kickers = [quad, kicker];
    description = `Four of a Kind, ${rankName(quad)}s`;
  } else if (countGroups.has(3) && countGroups.has(2)) {
    category = 'Full House';
    const trips = countGroups.get(3)![0];
    const pair = countGroups.get(2)![0];
    kickers = [trips, pair];
    description = `Full House, ${rankName(trips)}s full of ${rankName(pair)}s`;
  } else if (flush) {
    category = 'Flush';
    kickers = [...values];
    description = `Flush, ${rankName(values[0])} high`;
  } else if (straight) {
    category = 'Straight';
    kickers = [straightHigh!];
    description = `Straight, ${rankName(straightHigh!)} high`;
  } else if (countGroups.has(3)) {
    category = 'Three of a Kind';
    const trips = countGroups.get(3)![0];
    const kickerCards = countGroups.get(1)!;
    kickers = [trips, ...kickerCards];
    description = `Three of a Kind, ${rankName(trips)}s`;
  } else if (countGroups.has(2) && countGroups.get(2)!.length === 2) {
    category = 'Two Pair';
    const pairs = countGroups.get(2)!;
    const kicker = countGroups.get(1)![0];
    kickers = [...pairs, kicker];
    description = `Two Pair, ${rankName(pairs[0])}s and ${rankName(pairs[1])}s`;
  } else if (countGroups.has(2)) {
    category = 'One Pair';
    const pair = countGroups.get(2)![0];
    const kickerCards = countGroups.get(1)!;
    kickers = [pair, ...kickerCards];
    description = `One Pair, ${rankName(pair)}s`;
  } else {
    category = 'High Card';
    kickers = [...values];
    description = `High Card, ${rankName(values[0])}`;
  }
  
  const handRank = calculateHandRank(category, kickers);
  const percentile = calculatePercentile(handRank);
  
  return {
    category,
    categoryRank: CATEGORY_RANKS[category],
    handRank,
    totalHands: TOTAL_HANDS,
    percentile,
    description,
    kickers
  };
}

function rankName(value: number): string {
  const names: Record<number, string> = {
    14: 'Ace', 13: 'King', 12: 'Queen', 11: 'Jack', 10: 'Ten',
    9: 'Nine', 8: 'Eight', 7: 'Seven', 6: 'Six', 5: 'Five',
    4: 'Four', 3: 'Three', 2: 'Two'
  };
  return names[value] || String(value);
}

function calculateHandRank(category: HandCategory, kickers: number[]): number {
  const BASE = 1000000;
  
  const kickerValue = (ks: number[]) => {
    let v = 0;
    for (let i = 0; i < ks.length && i < 5; i++) {
      v += ks[i] * Math.pow(15, 4 - i);
    }
    return v;
  };
  
  switch (category) {
    case 'Royal Flush':
      return 9 * BASE + kickers[0];
    case 'Straight Flush':
      return 8 * BASE + kickers[0];
    case 'Four of a Kind':
      return 7 * BASE + kickers[0] * 15 + kickers[1];
    case 'Full House':
      return 6 * BASE + kickers[0] * 15 + kickers[1];
    case 'Flush':
      return 5 * BASE + kickerValue(kickers);
    case 'Straight':
      return 4 * BASE + kickers[0];
    case 'Three of a Kind':
      return 3 * BASE + kickers[0] * 225 + kickers[1] * 15 + kickers[2];
    case 'Two Pair':
      return 2 * BASE + kickers[0] * 225 + kickers[1] * 15 + kickers[2];
    case 'One Pair':
      return 1 * BASE + kickers[0] * 3375 + kickers[1] * 225 + kickers[2] * 15 + kickers[3];
    case 'High Card':
      return 0 * BASE + kickerValue(kickers);
    default:
      return 0;
  }
}

function calculateFlushRank(kickers: number[]): number {
  const indices = kickers.map(k => k - 2);
  let rank = 0;
  let count = 0;
  
  for (let a = 12; a >= 4; a--) {
    for (let b = a - 1; b >= 3; b--) {
      for (let c = b - 1; c >= 2; c--) {
        for (let d = c - 1; d >= 1; d--) {
          for (let e = d - 1; e >= 0; e--) {
            if (!(a - e === 4 || (a === 12 && b === 3 && c === 2 && d === 1 && e === 0))) {
              if (indices[0] === a && indices[1] === b && indices[2] === c && 
                  indices[3] === d && indices[4] === e) {
                return count;
              }
              count++;
            }
          }
        }
      }
    }
  }
  
  return rank;
}

function calculateTripsRank(kickers: number[]): number {
  const tripsIndex = kickers[0] - 2;
  const k1 = kickers[1] - 2;
  const k2 = kickers[2] - 2;
  
  let kickerRank = 0;
  for (let i = 12; i >= 1; i--) {
    if (i === tripsIndex) continue;
    for (let j = i - 1; j >= 0; j--) {
      if (j === tripsIndex) continue;
      const adjustedI = i > tripsIndex ? i - 1 : i;
      const adjustedJ = j > tripsIndex ? j - 1 : j;
      const adjK1 = k1 > tripsIndex ? k1 - 1 : k1;
      const adjK2 = k2 > tripsIndex ? k2 - 1 : k2;
      if (adjustedI === adjK1 && adjustedJ === adjK2) {
        return tripsIndex * 66 + kickerRank;
      }
      kickerRank++;
    }
  }
  
  return tripsIndex * 66;
}

function calculateTwoPairRank(kickers: number[]): number {
  const highPair = kickers[0] - 2;
  const lowPair = kickers[1] - 2;
  const kicker = kickers[2] - 2;
  
  let pairCombo = 0;
  for (let h = 12; h >= 1; h--) {
    for (let l = h - 1; l >= 0; l--) {
      if (h === highPair && l === lowPair) {
        let kickerRank = 0;
        for (let k = 12; k >= 0; k--) {
          if (k !== highPair && k !== lowPair) {
            if (k === kicker) {
              return pairCombo * 11 + kickerRank;
            }
            kickerRank++;
          }
        }
      }
      pairCombo++;
    }
  }
  
  return 0;
}

function calculateOnePairRank(kickers: number[]): number {
  const pairIndex = kickers[0] - 2;
  const k1 = kickers[1] - 2;
  const k2 = kickers[2] - 2;
  const k3 = kickers[3] - 2;
  
  let kickerRank = 0;
  for (let a = 12; a >= 2; a--) {
    if (a === pairIndex) continue;
    for (let b = a - 1; b >= 1; b--) {
      if (b === pairIndex) continue;
      for (let c = b - 1; c >= 0; c--) {
        if (c === pairIndex) continue;
        if (a === k1 && b === k2 && c === k3) {
          return pairIndex * 220 + kickerRank;
        }
        kickerRank++;
      }
    }
  }
  
  return pairIndex * 220;
}

function calculateHighCardRank(kickers: number[]): number {
  const indices = kickers.map(k => k - 2);
  let rank = 0;
  
  for (let a = 12; a >= 4; a--) {
    for (let b = a - 1; b >= 3; b--) {
      for (let c = b - 1; c >= 2; c--) {
        for (let d = c - 1; d >= 1; d--) {
          for (let e = d - 1; e >= 0; e--) {
            if (!(a - e === 4 || (a === 12 && b === 3 && c === 2 && d === 1 && e === 0))) {
              if (indices[0] === a && indices[1] === b && indices[2] === c && 
                  indices[3] === d && indices[4] === e) {
                return rank;
              }
              rank++;
            }
          }
        }
      }
    }
  }
  
  return rank;
}

function calculatePercentile(handRank: number): number {
  return ((TOTAL_HANDS - handRank + 1) / TOTAL_HANDS) * 100;
}

export function compareHands(hand1: Card[], hand2: Card[]): number {
  const result1 = evaluateHand(hand1);
  const result2 = evaluateHand(hand2);
  return result2.handRank - result1.handRank;
}

export function generateRandomHand(): Card[] {
  const deck: Card[] = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      deck.push({ rank, suit });
    }
  }
  
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  
  return deck.slice(0, 5);
}

export function getSuitSymbol(suit: Suit): string {
  const symbols: Record<Suit, string> = {
    'c': '♣',
    'd': '♦',
    'h': '♥',
    's': '♠'
  };
  return symbols[suit];
}

export function getSuitColor(suit: Suit): 'red' | 'black' {
  return suit === 'h' || suit === 'd' ? 'red' : 'black';
}

export function getRankDisplay(rank: Rank): string {
  return rank === 'T' ? '10' : rank;
}
