import type { Card } from './poker-evaluator';

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;
const SUITS = ['s', 'h', 'd', 'c'] as const;
const RANK_ORDER: Record<string, number> = {
  'A': 14, 'K': 13, 'Q': 12, 'J': 11, 'T': 10,
  '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2
};

type Suit = 's' | 'h' | 'd' | 'c';
type Rank = typeof RANKS[number];

export interface RangeResult {
  isRange: boolean;
  isSpecificHand: boolean;
  hands: Card[][];
  comboCount: number;
  error?: string;
}

function createCard(rank: string, suit: string): Card {
  return { rank, suit } as Card;
}

function getAllCards(): Card[] {
  const cards: Card[] = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      cards.push(createCard(rank, suit));
    }
  }
  return cards;
}

function cardKey(card: Card): string {
  return `${card.rank}${card.suit}`;
}

function parseSpecificCards(input: string): Card[] | null {
  const cards: Card[] = [];
  let i = 0;
  while (i < input.length) {
    let rank = input[i].toUpperCase();
    if (rank === '1' && input[i + 1] === '0') {
      rank = 'T';
      i += 2;
    } else {
      i++;
    }
    
    if (!RANK_ORDER[rank]) return null;
    
    const suit = input[i]?.toLowerCase();
    if (!suit || !SUITS.includes(suit as Suit)) return null;
    
    cards.push(createCard(rank, suit));
    i++;
  }
  return cards.length > 0 ? cards : null;
}

function isSpecificHand(input: string): boolean {
  const cards = parseSpecificCards(input);
  return cards !== null && cards.length >= 2 && cards.length <= 5;
}

function getPairCombos(rank: Rank, numCards: number = 5): Card[][] {
  const combos: Card[][] = [];
  const suitCombos: Suit[][] = [];
  
  function generateSuitCombos(current: Suit[], startIdx: number, count: number) {
    if (current.length === count) {
      suitCombos.push([...current]);
      return;
    }
    for (let i = startIdx; i < SUITS.length; i++) {
      current.push(SUITS[i]);
      generateSuitCombos(current, i + 1, count);
      current.pop();
    }
  }
  
  generateSuitCombos([], 0, 2);
  
  for (const suits of suitCombos) {
    const hand = suits.map(s => createCard(rank, s));
    combos.push(hand);
  }
  
  return combos;
}

function getUnpairedCombos(ranks: Rank[], suited: boolean | null): Card[][] {
  const combos: Card[][] = [];
  
  if (suited === true) {
    for (const suit of SUITS) {
      const hand = ranks.map(r => createCard(r, suit));
      combos.push(hand);
    }
  } else if (suited === false) {
    const suitPerms = generateSuitPermutations(ranks.length);
    for (const suits of suitPerms) {
      if (new Set(suits).size === suits.length) continue;
      const hand = ranks.map((r, i) => createCard(r, suits[i]));
      combos.push(hand);
    }
    const offsuitPerms = suitPerms.filter(s => new Set(s).size === s.length);
    for (const suits of offsuitPerms) {
      const hand = ranks.map((r, i) => createCard(r, suits[i]));
      combos.push(hand);
    }
  } else {
    const suitPerms = generateSuitPermutations(ranks.length);
    for (const suits of suitPerms) {
      const hand = ranks.map((r, i) => createCard(r, suits[i]));
      combos.push(hand);
    }
  }
  
  return combos;
}

function generateSuitPermutations(n: number): Suit[][] {
  if (n === 0) return [[]];
  const result: Suit[][] = [];
  const sub = generateSuitPermutations(n - 1);
  for (const perm of sub) {
    for (const suit of SUITS) {
      result.push([...perm, suit]);
    }
  }
  return result;
}

function expandPairPlus(startRank: Rank): Card[][] {
  const startIdx = RANKS.indexOf(startRank);
  const combos: Card[][] = [];
  for (let i = 0; i <= startIdx; i++) {
    combos.push(...getPairCombos(RANKS[i]));
  }
  return combos;
}

function expandPairRange(highRank: Rank, lowRank: Rank): Card[][] {
  const highIdx = RANKS.indexOf(highRank);
  const lowIdx = RANKS.indexOf(lowRank);
  const combos: Card[][] = [];
  for (let i = highIdx; i <= lowIdx; i++) {
    combos.push(...getPairCombos(RANKS[i]));
  }
  return combos;
}

function expandUnpairedPlus(rank1: Rank, rank2: Rank, suited: boolean | null): Card[][] {
  const idx1 = RANKS.indexOf(rank1);
  const idx2Start = RANKS.indexOf(rank2);
  const combos: Card[][] = [];
  
  for (let i = idx1 + 1; i <= idx2Start; i++) {
    const ranks = [rank1, RANKS[i]] as Rank[];
    if (suited === true) {
      for (const suit of SUITS) {
        combos.push(ranks.map(r => createCard(r, suit)));
      }
    } else if (suited === false) {
      for (const s1 of SUITS) {
        for (const s2 of SUITS) {
          if (s1 !== s2) {
            combos.push([createCard(ranks[0], s1), createCard(ranks[1], s2)]);
          }
        }
      }
    } else {
      for (const s1 of SUITS) {
        for (const s2 of SUITS) {
          combos.push([createCard(ranks[0], s1), createCard(ranks[1], s2)]);
        }
      }
    }
  }
  
  return combos;
}

function parseRangeToken(token: string): Card[][] {
  const trimmed = token.trim();
  if (!trimmed) return [];
  
  if (isSpecificHand(trimmed)) {
    const cards = parseSpecificCards(trimmed);
    return cards ? [cards] : [];
  }
  
  if (trimmed === '*' || trimmed.toLowerCase() === 'random') {
    return [];
  }
  
  const pairPlusMatch = trimmed.match(/^([AKQJT98765432])([AKQJT98765432])\+$/i);
  if (pairPlusMatch) {
    const [, r1, r2] = pairPlusMatch;
    if (r1.toUpperCase() === r2.toUpperCase()) {
      return expandPairPlus(r1.toUpperCase() as Rank);
    }
  }
  
  const pairRangeMatch = trimmed.match(/^([AKQJT98765432])([AKQJT98765432])-([AKQJT98765432])([AKQJT98765432])$/i);
  if (pairRangeMatch) {
    const [, r1, r2, r3, r4] = pairRangeMatch;
    if (r1.toUpperCase() === r2.toUpperCase() && r3.toUpperCase() === r4.toUpperCase()) {
      return expandPairRange(r1.toUpperCase() as Rank, r3.toUpperCase() as Rank);
    }
  }
  
  const pairMatch = trimmed.match(/^([AKQJT98765432])([AKQJT98765432])$/i);
  if (pairMatch) {
    const [, r1, r2] = pairMatch;
    if (r1.toUpperCase() === r2.toUpperCase()) {
      return getPairCombos(r1.toUpperCase() as Rank);
    }
    const ranks = [r1.toUpperCase(), r2.toUpperCase()] as Rank[];
    const combos: Card[][] = [];
    for (const s1 of SUITS) {
      for (const s2 of SUITS) {
        combos.push([createCard(ranks[0], s1), createCard(ranks[1], s2)]);
      }
    }
    return combos;
  }
  
  const suitedMatch = trimmed.match(/^([AKQJT98765432])([AKQJT98765432])\$s$/i);
  if (suitedMatch) {
    const [, r1, r2] = suitedMatch;
    const ranks = [r1.toUpperCase(), r2.toUpperCase()] as Rank[];
    const combos: Card[][] = [];
    for (const suit of SUITS) {
      combos.push(ranks.map(r => createCard(r, suit)));
    }
    return combos;
  }
  
  const offsuitMatch = trimmed.match(/^([AKQJT98765432])([AKQJT98765432])\$o$/i);
  if (offsuitMatch) {
    const [, r1, r2] = offsuitMatch;
    const ranks = [r1.toUpperCase(), r2.toUpperCase()] as Rank[];
    const combos: Card[][] = [];
    for (const s1 of SUITS) {
      for (const s2 of SUITS) {
        if (s1 !== s2) {
          combos.push([createCard(ranks[0], s1), createCard(ranks[1], s2)]);
        }
      }
    }
    return combos;
  }
  
  const suitedPlusMatch = trimmed.match(/^([AKQJT98765432])([AKQJT98765432])\$s\+$/i);
  if (suitedPlusMatch) {
    const [, r1, r2] = suitedPlusMatch;
    return expandUnpairedPlus(r1.toUpperCase() as Rank, r2.toUpperCase() as Rank, true);
  }
  
  const offsuitPlusMatch = trimmed.match(/^([AKQJT98765432])([AKQJT98765432])\$o\+$/i);
  if (offsuitPlusMatch) {
    const [, r1, r2] = offsuitPlusMatch;
    return expandUnpairedPlus(r1.toUpperCase() as Rank, r2.toUpperCase() as Rank, false);
  }
  
  const unpairedPlusMatch = trimmed.match(/^([AKQJT98765432])([AKQJT98765432])\+$/i);
  if (unpairedPlusMatch) {
    const [, r1, r2] = unpairedPlusMatch;
    if (r1.toUpperCase() !== r2.toUpperCase()) {
      return expandUnpairedPlus(r1.toUpperCase() as Rank, r2.toUpperCase() as Rank, null);
    }
  }
  
  return [];
}

export function parseRange(input: string): RangeResult {
  const trimmed = input.trim();
  
  if (!trimmed) {
    return { isRange: false, isSpecificHand: false, hands: [], comboCount: 0 };
  }
  
  if (isSpecificHand(trimmed)) {
    const cards = parseSpecificCards(trimmed);
    if (cards && cards.length >= 2 && cards.length <= 5) {
      return {
        isRange: false,
        isSpecificHand: true,
        hands: [cards],
        comboCount: 1
      };
    }
  }
  
  const tokens = trimmed.split(',').map(t => t.trim()).filter(Boolean);
  const allHands: Card[][] = [];
  const seen = new Set<string>();
  
  for (const token of tokens) {
    const hands = parseRangeToken(token);
    for (const hand of hands) {
      const key = hand.map(cardKey).sort().join('|');
      if (!seen.has(key)) {
        seen.add(key);
        allHands.push(hand);
      }
    }
  }
  
  if (allHands.length === 0 && tokens.length > 0) {
    return {
      isRange: true,
      isSpecificHand: false,
      hands: [],
      comboCount: 0,
      error: `Unknown range syntax: ${trimmed}`
    };
  }
  
  return {
    isRange: allHands.length > 1 || tokens.some(t => !isSpecificHand(t)),
    isSpecificHand: allHands.length === 1 && isSpecificHand(trimmed),
    hands: allHands,
    comboCount: allHands.length
  };
}

export function getRandomHandFromRange(hands: Card[][], excludeCards: Set<string>): Card[] | null {
  const available = hands.filter(hand => 
    hand.every(card => !excludeCards.has(cardKey(card)))
  );
  
  if (available.length === 0) return null;
  
  const idx = Math.floor(Math.random() * available.length);
  return available[idx];
}

export function filterHandsByExcluded(hands: Card[][], excludeCards: Set<string>): Card[][] {
  return hands.filter(hand => 
    hand.every(card => !excludeCards.has(cardKey(card)))
  );
}
