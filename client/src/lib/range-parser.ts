import type { Card } from './poker-evaluator';

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;
const SUITS = ['s', 'h', 'd', 'c'] as const;
const RANK_ORDER: Record<string, number> = {
  'A': 14, 'K': 13, 'Q': 12, 'J': 11, 'T': 10,
  '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2
};

const HAND_SIZE = 5;
const DECK_SIZE = 52;

type Suit = 's' | 'h' | 'd' | 'c';
type Rank = typeof RANKS[number];

export interface RangeResult {
  isRange: boolean;
  isSpecificHand: boolean;
  hands: Card[][];
  comboCount: number;
  pattern?: string;
  error?: string;
}

function createCard(rank: string, suit: string): Card {
  return { rank, suit } as Card;
}

function cardKey(card: Card): string {
  return `${card.rank}${card.suit}`;
}

function factorial(n: number): number {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

function combinations(n: number, k: number): number {
  if (k > n || k < 0) return 0;
  if (k === 0 || k === n) return 1;
  if (k > n - k) k = n - k;
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = result * (n - i) / (i + 1);
  }
  return Math.round(result);
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

const BUILT_IN_MACROS: Record<string, string> = {
  '$s': ':xx',
  '$o': ':xy',
  '$ds': ':xxyy',
  '$ss': ':xxyz',
  '$np': '!RR',
  '$op': ':RRON',
  '$tp': ':RROO',
  '$nt': '!RRR',
  '$B': '[AKQJT]',
  '$M': '[T987]',
  '$Z': '[65432]',
  '$L': '[A2345678]',
  '$N': '[KQJ9]',
  '$F': '[KQJ]',
  '$R': '[AKQJT]',
  '$W': '[A2345]',
  '$0g': 'AKQJ-',
  '$1g': 'AKQ9-,AKJ9-,AQJ9-',
  '$2g': 'AKQ8-,AKT8-,AJT8-',
};

function expandMacros(input: string): string {
  let result = input;
  const macroKeys = Object.keys(BUILT_IN_MACROS).sort((a, b) => b.length - a.length);
  for (const macro of macroKeys) {
    const escaped = macro.replace(/\$/g, '\\$');
    result = result.replace(new RegExp(escaped, 'gi'), BUILT_IN_MACROS[macro]);
  }
  return result;
}

function expandRankBrackets(input: string): string[] {
  const bracketMatch = input.match(/\[([A-Z0-9,\-]+)\]/i);
  if (!bracketMatch) return [input];
  
  const content = bracketMatch[1].toUpperCase();
  const ranks: string[] = [];
  
  if (content.includes('-') && !content.includes(',')) {
    const parts = content.split('-');
    if (parts.length === 2 && parts[0].length === 1 && parts[1].length === 1) {
      const startIdx = RANKS.indexOf(parts[0] as Rank);
      const endIdx = RANKS.indexOf(parts[1] as Rank);
      if (startIdx !== -1 && endIdx !== -1) {
        const from = Math.min(startIdx, endIdx);
        const to = Math.max(startIdx, endIdx);
        for (let i = from; i <= to; i++) {
          ranks.push(RANKS[i]);
        }
      }
    }
  } else {
    const items = content.split(',');
    for (const item of items) {
      if (item.includes('-')) {
        const parts = item.split('-');
        if (parts.length === 2) {
          const startIdx = RANKS.indexOf(parts[0] as Rank);
          const endIdx = RANKS.indexOf(parts[1] as Rank);
          if (startIdx !== -1 && endIdx !== -1) {
            const from = Math.min(startIdx, endIdx);
            const to = Math.max(startIdx, endIdx);
            for (let i = from; i <= to; i++) {
              ranks.push(RANKS[i]);
            }
          }
        }
      } else if (RANK_ORDER[item]) {
        ranks.push(item);
      }
    }
  }
  
  if (ranks.length === 0) return [input];
  
  const results: string[] = [];
  for (const rank of ranks) {
    results.push(input.replace(bracketMatch[0], rank));
  }
  return results;
}

function expandAllBrackets(input: string): string[] {
  let current = [input];
  let hasChanges = true;
  
  while (hasChanges) {
    hasChanges = false;
    const next: string[] = [];
    for (const str of current) {
      if (str.includes('[')) {
        const expanded = expandRankBrackets(str);
        if (expanded.length > 1 || expanded[0] !== str) {
          hasChanges = true;
          next.push(...expanded);
        } else {
          next.push(str);
        }
      } else {
        next.push(str);
      }
    }
    current = next;
  }
  
  return current;
}

function expandRankSpan(pattern: string): string[] {
  const rundownMatch = pattern.match(/^([AKQJT98765432]{4})-([AKQJT98765432]{4})$/i);
  if (rundownMatch) {
    const [, start, end] = rundownMatch;
    const startRanks = start.toUpperCase().split('');
    const endRanks = end.toUpperCase().split('');
    
    const startHighIdx = RANKS.indexOf(startRanks[0] as Rank);
    const endHighIdx = RANKS.indexOf(endRanks[0] as Rank);
    
    if (startHighIdx === -1 || endHighIdx === -1) return [pattern];
    
    const results: string[] = [];
    const from = Math.min(startHighIdx, endHighIdx);
    const to = Math.max(startHighIdx, endHighIdx);
    
    for (let i = from; i <= to; i++) {
      if (i + 3 < RANKS.length) {
        results.push(RANKS[i] + RANKS[i+1] + RANKS[i+2] + RANKS[i+3]);
      }
    }
    return results.length > 0 ? results : [pattern];
  }
  
  const descendingMatch = pattern.match(/^([AKQJT98765432]{4})-$/i);
  if (descendingMatch) {
    const start = descendingMatch[1].toUpperCase();
    const startHighIdx = RANKS.indexOf(start[0] as Rank);
    
    const results: string[] = [];
    for (let i = startHighIdx; i + 3 < RANKS.length; i++) {
      results.push(RANKS[i] + RANKS[i+1] + RANKS[i+2] + RANKS[i+3]);
    }
    return results.length > 0 ? results : [pattern];
  }
  
  const ascendingMatch = pattern.match(/^([AKQJT98765432]{2,4})\+$/i);
  if (ascendingMatch) {
    const base = ascendingMatch[1].toUpperCase();
    
    if (base.length === 2 && base[0] === base[1]) {
      const startIdx = RANKS.indexOf(base[0] as Rank);
      const results: string[] = [];
      for (let i = 0; i <= startIdx; i++) {
        results.push(RANKS[i] + RANKS[i]);
      }
      return results;
    }
    
    if (base.length === 2) {
      const highRank = base[0];
      const lowRankIdx = RANKS.indexOf(base[1] as Rank);
      const highRankIdx = RANKS.indexOf(highRank as Rank);
      
      const results: string[] = [];
      for (let i = highRankIdx + 1; i <= lowRankIdx; i++) {
        results.push(highRank + RANKS[i]);
      }
      return results.length > 0 ? results : [pattern];
    }
    
    if (base.length === 4) {
      const startHighIdx = RANKS.indexOf(base[0] as Rank);
      const results: string[] = [];
      for (let i = 0; i <= startHighIdx && i + 3 < RANKS.length; i++) {
        results.push(RANKS[i] + RANKS[i+1] + RANKS[i+2] + RANKS[i+3]);
      }
      return results.length > 0 ? results : [pattern];
    }
  }
  
  const pairDescMatch = pattern.match(/^([AKQJT98765432])([AKQJT98765432])([AKQJT98765432])-$/i);
  if (pairDescMatch) {
    const [, r1, r2, r3] = pairDescMatch;
    if (r1.toUpperCase() === r2.toUpperCase()) {
      const startIdx = RANKS.indexOf(r1.toUpperCase() as Rank);
      const results: string[] = [];
      for (let i = startIdx; i < RANKS.length - 1; i++) {
        const sideIdx = RANKS.indexOf(r3.toUpperCase() as Rank) + (i - startIdx);
        if (sideIdx < RANKS.length) {
          results.push(RANKS[i] + RANKS[i] + RANKS[sideIdx]);
        }
      }
      return results.length > 0 ? results : [pattern];
    }
  }
  
  return [pattern];
}

interface PatternConstraint {
  fixedCards: Card[];
  rankRequirements: Map<string, number>;
  suitVariables: Map<string, string>;
  noPairRanks: Set<string>;
  hasSuitConstraint: boolean;
  suitPattern: string;
  isNegation: boolean;
  negatedPattern?: string;
}

function parsePatternToConstraint(pattern: string): PatternConstraint {
  const result: PatternConstraint = {
    fixedCards: [],
    rankRequirements: new Map(),
    suitVariables: new Map(),
    noPairRanks: new Set(),
    hasSuitConstraint: false,
    suitPattern: '',
    isNegation: false,
  };
  
  const bangIdx = pattern.indexOf('!');
  let mainPattern = pattern;
  if (bangIdx !== -1 && bangIdx > 0) {
    mainPattern = pattern.substring(0, bangIdx);
    result.isNegation = true;
    result.negatedPattern = pattern.substring(bangIdx + 1);
  }
  
  const colonIdx = mainPattern.indexOf(':');
  let handPart = mainPattern;
  let constraintPart = '';
  if (colonIdx !== -1) {
    handPart = mainPattern.substring(0, colonIdx);
    constraintPart = mainPattern.substring(colonIdx + 1);
    result.hasSuitConstraint = true;
    result.suitPattern = constraintPart;
  }
  
  let i = 0;
  const rankVarCounts: Map<string, number> = new Map();
  
  while (i < handPart.length) {
    const char = handPart[i].toUpperCase();
    
    if (char === '{') {
      const closeIdx = handPart.indexOf('}', i);
      if (closeIdx !== -1) {
        const noPairContent = handPart.substring(i + 1, closeIdx);
        for (const c of noPairContent) {
          if (RANK_ORDER[c.toUpperCase()]) {
            result.noPairRanks.add(c.toUpperCase());
          }
        }
        i = closeIdx + 1;
        continue;
      }
    }
    
    if (RANK_ORDER[char]) {
      const nextChar = handPart[i + 1]?.toLowerCase();
      
      if (nextChar && SUITS.includes(nextChar as Suit)) {
        result.fixedCards.push(createCard(char, nextChar));
        i += 2;
      } else if (nextChar && 'xyzw'.includes(nextChar)) {
        const count = result.rankRequirements.get(char) || 0;
        result.rankRequirements.set(char, count + 1);
        result.suitVariables.set(`${char}${count}`, nextChar);
        i += 2;
      } else {
        const count = result.rankRequirements.get(char) || 0;
        result.rankRequirements.set(char, count + 1);
        i++;
      }
    } else if ('RNOGHIJKLMPQUVWXYZ'.includes(char) && !RANK_ORDER[char]) {
      const count = rankVarCounts.get(char) || 0;
      rankVarCounts.set(char, count + 1);
      i++;
      
      const nextChar = handPart[i]?.toLowerCase();
      if (nextChar && 'xyzw'.includes(nextChar)) {
        i++;
      }
    } else if (char === '*') {
      i++;
    } else if ('xyzw'.includes(handPart[i].toLowerCase())) {
      result.hasSuitConstraint = true;
      result.suitPattern += handPart[i].toLowerCase();
      i++;
    } else {
      i++;
    }
  }
  
  return result;
}

function countHandsWithConstraint(constraint: PatternConstraint): number {
  const fixedCount = constraint.fixedCards.length;
  
  if (fixedCount === HAND_SIZE) {
    return 1;
  }
  
  if (constraint.rankRequirements.size > 0) {
    let baseCombos = countHandsWithAtLeastRanks(constraint.rankRequirements, HAND_SIZE - fixedCount);
    
    if (fixedCount > 0) {
      const usedCards = new Set(constraint.fixedCards.map(c => cardKey(c)));
      const fixedRanks = constraint.fixedCards.map(c => c.rank);
      for (const rank of fixedRanks) {
        if (constraint.rankRequirements.has(rank)) {
          baseCombos = Math.floor(baseCombos * 3 / 4);
        }
      }
    }
    
    if (constraint.hasSuitConstraint && constraint.suitPattern) {
      const pattern = constraint.suitPattern.toLowerCase();
      
      if (pattern === 'xx' || pattern.match(/^x+$/)) {
        baseCombos = Math.floor(baseCombos / 4);
      } else if (pattern === 'xxyy') {
        baseCombos = Math.floor(baseCombos * 0.055);
      } else if (pattern === 'xxyz') {
        baseCombos = Math.floor(baseCombos * 0.35);
      } else if (pattern === 'xy') {
        baseCombos = Math.floor(baseCombos * 3 / 4);
      }
    }
    
    return Math.max(0, baseCombos);
  }
  
  if (fixedCount > 0) {
    const remaining = HAND_SIZE - fixedCount;
    const usedCards = new Set(constraint.fixedCards.map(c => cardKey(c)));
    let availableCards = DECK_SIZE - usedCards.size;
    return combinations(availableCards, remaining);
  }
  
  return combinations(DECK_SIZE, HAND_SIZE);
}

function countHandsWithAtLeastRanks(rankCounts: Map<string, number>, handSize: number = HAND_SIZE): number {
  const ranks = Array.from(rankCounts.keys());
  const minCounts = Array.from(rankCounts.values());
  
  function countRecursive(idx: number, current: Map<string, number>, usedSlots: number): number {
    if (idx === ranks.length) {
      const remaining = handSize - usedSlots;
      if (remaining < 0) return 0;
      
      let combos = 1;
      const currentEntries = Array.from(current.entries());
      for (let i = 0; i < currentEntries.length; i++) {
        const [, count] = currentEntries[i];
        combos *= combinations(4, count);
      }
      
      const usedRanks = new Set(Array.from(current.keys()));
      
      if (remaining > 0) {
        let fillCards = 0;
        for (const r of RANKS) {
          if (!usedRanks.has(r)) {
            fillCards += 4;
          }
        }
        combos *= combinations(fillCards, remaining);
      }
      
      return combos;
    }
    
    const rank = ranks[idx];
    const minCount = minCounts[idx];
    let sum = 0;
    
    for (let count = minCount; count <= Math.min(4, handSize - usedSlots); count++) {
      const newCurrent = new Map(current);
      newCurrent.set(rank, count);
      sum += countRecursive(idx + 1, newCurrent, usedSlots + count);
    }
    
    return sum;
  }
  
  return countRecursive(0, new Map(), 0);
}

function countPLO5Pattern(pattern: string): number {
  const expanded = expandMacros(pattern);
  
  const colonIdx = expanded.indexOf(':');
  const bangIdx = expanded.indexOf('!');
  
  let basePart = expanded;
  let constraintPart = '';
  let negationPart = '';
  
  if (bangIdx !== -1 && (colonIdx === -1 || bangIdx < colonIdx)) {
    basePart = expanded.substring(0, bangIdx);
    negationPart = expanded.substring(bangIdx + 1);
  } else if (colonIdx !== -1) {
    basePart = expanded.substring(0, colonIdx);
    const rest = expanded.substring(colonIdx + 1);
    if (rest.includes('!')) {
      const restBangIdx = rest.indexOf('!');
      constraintPart = rest.substring(0, restBangIdx);
      negationPart = rest.substring(restBangIdx + 1);
    } else {
      constraintPart = rest;
    }
  }
  
  const constraint = parsePatternToConstraint(basePart + (constraintPart ? ':' + constraintPart : ''));
  let count = countHandsWithConstraint(constraint);
  
  if (negationPart) {
    const negConstraint = parsePatternToConstraint(basePart + negationPart);
    const negCount = countHandsWithConstraint(negConstraint);
    count = Math.max(0, count - negCount);
  }
  
  return count;
}

function generateSampleFromConstraint(
  constraint: PatternConstraint,
  excludeCards: Set<string>
): Card[] | null {
  // For simple rank requirements without suit constraints, use rejection sampling
  // for correct probability distribution
  if (constraint.rankRequirements.size > 0 && 
      constraint.fixedCards.length === 0 && 
      !constraint.hasSuitConstraint &&
      constraint.noPairRanks.size === 0) {
    return generateWithRejectionSampling(constraint.rankRequirements, excludeCards);
  }
  
  const hand: Card[] = [];
  const used = new Set(Array.from(excludeCards));
  
  for (const card of constraint.fixedCards) {
    if (used.has(cardKey(card))) return null;
    hand.push(card);
    used.add(cardKey(card));
  }
  
  const suitAssignments: Map<string, Suit> = new Map();
  
  if (constraint.hasSuitConstraint && constraint.suitPattern) {
    const pattern = constraint.suitPattern.toLowerCase();
    const vars = Array.from(new Set(pattern.split('')));
    const shuffledSuits = [...SUITS].sort(() => Math.random() - 0.5);
    vars.forEach((v, i) => {
      if (i < shuffledSuits.length) {
        suitAssignments.set(v, shuffledSuits[i]);
      }
    });
  }
  
  const reqEntries = Array.from(constraint.rankRequirements.entries());
  for (let i = 0; i < reqEntries.length; i++) {
    const [rank, count] = reqEntries[i];
    const availableSuits = SUITS.filter(s => !used.has(`${rank}${s}`));
    if (availableSuits.length < count) return null;
    
    let selectedSuits: Suit[];
    
    if (constraint.suitVariables.size > 0) {
      selectedSuits = [];
      for (let j = 0; j < count; j++) {
        const varName = constraint.suitVariables.get(`${rank}${j}`);
        if (varName && suitAssignments.has(varName)) {
          const assignedSuit = suitAssignments.get(varName)!;
          if (!used.has(`${rank}${assignedSuit}`) && !selectedSuits.includes(assignedSuit)) {
            selectedSuits.push(assignedSuit);
          }
        }
      }
      while (selectedSuits.length < count) {
        const remaining = availableSuits.filter(s => !selectedSuits.includes(s));
        if (remaining.length === 0) return null;
        selectedSuits.push(remaining[Math.floor(Math.random() * remaining.length)]);
      }
    } else {
      const shuffled = [...availableSuits].sort(() => Math.random() - 0.5);
      selectedSuits = shuffled.slice(0, count);
    }
    
    for (const suit of selectedSuits) {
      const card = createCard(rank, suit);
      hand.push(card);
      used.add(cardKey(card));
    }
  }
  
  const availableCards: Card[] = [];
  for (const rank of RANKS) {
    if (!constraint.noPairRanks.has(rank)) {
      for (const suit of SUITS) {
        const key = `${rank}${suit}`;
        if (!used.has(key)) {
          availableCards.push(createCard(rank, suit));
        }
      }
    }
  }
  
  while (hand.length < HAND_SIZE && availableCards.length > 0) {
    const idx = Math.floor(Math.random() * availableCards.length);
    hand.push(availableCards.splice(idx, 1)[0]);
  }
  
  return hand.length === HAND_SIZE ? hand : null;
}

// Direct generation for simple rank patterns with proper uniform distribution
// For "AA" we need uniform sampling over all hands with 2+ aces
function generateWithRejectionSampling(
  rankRequirements: Map<string, number>,
  excludeCards: Set<string>
): Card[] | null {
  const hand: Card[] = [];
  const used = new Set(excludeCards);
  
  // Get all requirement entries
  const reqEntries = Array.from(rankRequirements.entries());
  
  // Build lists of available cards for each rank and non-required ranks
  const availableByRank = new Map<string, Card[]>();
  const nonRequiredCards: Card[] = [];
  const requiredRanks = new Set(reqEntries.map(e => e[0]));
  
  for (const rank of RANKS) {
    const cards: Card[] = [];
    for (const suit of SUITS) {
      const key = `${rank}${suit}`;
      if (!used.has(key)) {
        const card = createCard(rank, suit);
        cards.push(card);
        if (!requiredRanks.has(rank)) {
          nonRequiredCards.push(card);
        }
      }
    }
    availableByRank.set(rank, cards);
  }
  
  // For each required rank, check we have enough available
  for (const [rank, minCount] of reqEntries) {
    const available = availableByRank.get(rank) || [];
    if (available.length < minCount) return null;
  }
  
  // Calculate weights for each possible count of required cards
  // For single rank (AA), weights are: C(4,2)*C(48,3), C(4,3)*C(48,2), C(4,4)*C(48,1)
  if (reqEntries.length === 1) {
    const [rank, minCount] = reqEntries[0];
    const availableRankCards = availableByRank.get(rank) || [];
    const numRankAvail = availableRankCards.length;
    const numOther = nonRequiredCards.length;
    
    // Calculate weights for each possible count
    const weights: number[] = [];
    const counts: number[] = [];
    
    for (let count = minCount; count <= Math.min(numRankAvail, HAND_SIZE); count++) {
      const otherNeeded = HAND_SIZE - count;
      if (otherNeeded > numOther) continue;
      
      const weight = combinations(numRankAvail, count) * combinations(numOther, otherNeeded);
      if (weight > 0) {
        weights.push(weight);
        counts.push(count);
      }
    }
    
    if (weights.length === 0) return null;
    
    // Weighted random selection of how many rank cards to include
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let rand = Math.random() * totalWeight;
    let selectedCount = counts[0];
    
    for (let i = 0; i < weights.length; i++) {
      rand -= weights[i];
      if (rand <= 0) {
        selectedCount = counts[i];
        break;
      }
    }
    
    // Fisher-Yates shuffle for the rank cards and pick selectedCount
    const shuffledRank = [...availableRankCards];
    for (let i = shuffledRank.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledRank[i], shuffledRank[j]] = [shuffledRank[j], shuffledRank[i]];
    }
    for (let i = 0; i < selectedCount; i++) {
      hand.push(shuffledRank[i]);
      used.add(cardKey(shuffledRank[i]));
    }
    
    // Shuffle non-required cards and pick remaining
    const shuffledOther = [...nonRequiredCards];
    for (let i = shuffledOther.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledOther[i], shuffledOther[j]] = [shuffledOther[j], shuffledOther[i]];
    }
    const otherNeeded = HAND_SIZE - hand.length;
    for (let i = 0; i < otherNeeded && i < shuffledOther.length; i++) {
      hand.push(shuffledOther[i]);
    }
  } else {
    // For multiple rank requirements, use simpler approach
    for (const [rank, minCount] of reqEntries) {
      const availableRankCards = availableByRank.get(rank) || [];
      const shuffled = [...availableRankCards].sort(() => Math.random() - 0.5);
      for (let i = 0; i < minCount; i++) {
        hand.push(shuffled[i]);
        used.add(cardKey(shuffled[i]));
      }
    }
    
    // Fill remaining from non-required cards
    const shuffledOther = nonRequiredCards.filter(c => !used.has(cardKey(c)));
    shuffledOther.sort(() => Math.random() - 0.5);
    while (hand.length < HAND_SIZE && shuffledOther.length > 0) {
      hand.push(shuffledOther.shift()!);
    }
  }
  
  return hand.length === HAND_SIZE ? hand : null;
}

function parseRangeToken(token: string): { hands: Card[][], count: number, pattern: string } {
  const trimmed = token.trim();
  if (!trimmed) return { hands: [], count: 0, pattern: '' };
  
  if (isSpecificHand(trimmed)) {
    const cards = parseSpecificCards(trimmed);
    if (cards) {
      if (cards.length === HAND_SIZE) {
        return { hands: [cards], count: 1, pattern: trimmed };
      }
      const remaining = HAND_SIZE - cards.length;
      const usedCards = new Set(cards.map(cardKey));
      let availableCount = DECK_SIZE - usedCards.size;
      const count = combinations(availableCount, remaining);
      return { hands: [cards], count, pattern: trimmed };
    }
  }
  
  if (trimmed === '*' || trimmed.toLowerCase() === 'random') {
    return { hands: [], count: combinations(DECK_SIZE, HAND_SIZE), pattern: '*' };
  }
  
  const percentMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*%(?:\s*-\s*(\d+(?:\.\d+)?)\s*%)?(?:6h)?$/i);
  if (percentMatch) {
    const startPct = parseFloat(percentMatch[1]);
    const endPct = percentMatch[2] ? parseFloat(percentMatch[2]) : startPct;
    const totalHands = combinations(DECK_SIZE, HAND_SIZE);
    const count = Math.floor(totalHands * (endPct - (percentMatch[2] ? startPct : 0)) / 100);
    return { hands: [], count, pattern: trimmed };
  }
  
  const weightMatch = trimmed.match(/@(\d+)$/);
  let basePattern = trimmed;
  let weight = 100;
  if (weightMatch) {
    weight = parseInt(weightMatch[1]);
    basePattern = trimmed.substring(0, trimmed.lastIndexOf('@'));
  }
  
  const expanded = expandMacros(basePattern);
  const bracketExpanded = expandAllBrackets(expanded);
  
  let totalCount = 0;
  const allHands: Card[][] = [];
  
  for (const pattern of bracketExpanded) {
    const spanExpanded = expandRankSpan(pattern);
    
    for (const finalPattern of spanExpanded) {
      const count = countPLO5Pattern(finalPattern);
      totalCount += count;
      
      const constraint = parsePatternToConstraint(expandMacros(finalPattern));
      const numSamples = Math.min(2000, count);
      for (let i = 0; i < numSamples; i++) {
        const sample = generateSampleFromConstraint(constraint, new Set());
        if (sample) allHands.push(sample);
      }
    }
  }
  
  if (weight !== 100) {
    totalCount = Math.floor(totalCount * weight / 100);
  }
  
  return { hands: allHands, count: totalCount, pattern: trimmed };
}

export function parseRange(input: string): RangeResult {
  const trimmed = input.trim();
  
  if (!trimmed) {
    return { isRange: false, isSpecificHand: false, hands: [], comboCount: 0 };
  }
  
  if (isSpecificHand(trimmed)) {
    const cards = parseSpecificCards(trimmed);
    if (cards && cards.length === HAND_SIZE) {
      return {
        isRange: false,
        isSpecificHand: true,
        hands: [cards],
        comboCount: 1
      };
    }
    if (cards && cards.length > 0 && cards.length < HAND_SIZE) {
      const remaining = HAND_SIZE - cards.length;
      const usedCards = new Set(cards.map(cardKey));
      let availableCount = DECK_SIZE - usedCards.size;
      const count = combinations(availableCount, remaining);
      return {
        isRange: true,
        isSpecificHand: false,
        hands: [cards],
        comboCount: count
      };
    }
  }
  
  const tokens = trimmed.split(',').map(t => t.trim()).filter(Boolean);
  let totalCount = 0;
  const allHands: Card[][] = [];
  
  for (const token of tokens) {
    const result = parseRangeToken(token);
    totalCount += result.count;
    allHands.push(...result.hands);
  }
  
  if (totalCount === 0 && tokens.length > 0) {
    const testConstraint = parsePatternToConstraint(expandMacros(tokens[0]));
    if (testConstraint.rankRequirements.size > 0 || testConstraint.fixedCards.length > 0) {
      totalCount = countHandsWithAtLeastRanks(testConstraint.rankRequirements);
    }
  }
  
  if (totalCount === 0 && tokens.length > 0) {
    return {
      isRange: true,
      isSpecificHand: false,
      hands: [],
      comboCount: 0,
      error: `Unknown range syntax: ${trimmed}`
    };
  }
  
  return {
    isRange: totalCount > 1,
    isSpecificHand: totalCount === 1 && isSpecificHand(trimmed),
    hands: allHands,
    comboCount: totalCount,
    pattern: trimmed
  };
}

export function getRandomHandFromRange(hands: Card[][], excludeCards: Set<string>): Card[] | null {
  if (hands.length === 0) return null;
  
  const baseHand = hands[Math.floor(Math.random() * hands.length)];
  
  const result: Card[] = [];
  const used = new Set(Array.from(excludeCards));
  
  for (const card of baseHand) {
    if (used.has(cardKey(card))) {
      return null;
    }
    result.push(card);
    used.add(cardKey(card));
  }
  
  const available: Card[] = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      const key = `${rank}${suit}`;
      if (!used.has(key)) {
        available.push(createCard(rank, suit));
      }
    }
  }
  
  while (result.length < HAND_SIZE && available.length > 0) {
    const idx = Math.floor(Math.random() * available.length);
    result.push(available.splice(idx, 1)[0]);
  }
  
  return result.length === HAND_SIZE ? result : null;
}

export function generateRandomHandFromPattern(
  pattern: string,
  excludeCards: Set<string>
): Card[] | null {
  const expanded = expandMacros(pattern);
  const constraint = parsePatternToConstraint(expanded);
  return generateSampleFromConstraint(constraint, excludeCards);
}

export function filterHandsByExcluded(hands: Card[][], excludeCards: Set<string>): Card[][] {
  return hands.filter(hand => 
    hand.every(card => !excludeCards.has(cardKey(card)))
  );
}

export function countPLO5Hands(pattern: string): number {
  return countPLO5Pattern(pattern);
}
