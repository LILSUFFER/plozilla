import { type Card, type Rank, type Suit, RANKS, SUITS, evaluateHand, type HandResult } from './poker-evaluator';

export function parseCardsConcat(input: string): Card[] | null {
  const cleaned = input.trim().replace(/\s+/g, '');
  if (cleaned.length === 0) return [];
  
  const cards: Card[] = [];
  const seen = new Set<string>();
  
  let i = 0;
  while (i < cleaned.length) {
    let rank: string;
    let suit: string;
    
    if (cleaned[i] === '1' && cleaned[i + 1] === '0' && i + 2 < cleaned.length) {
      rank = 'T';
      suit = cleaned[i + 2].toLowerCase();
      i += 3;
    } else {
      rank = cleaned[i].toUpperCase();
      suit = cleaned[i + 1]?.toLowerCase() || '';
      i += 2;
    }
    
    if (!RANKS.includes(rank as Rank)) return null;
    if (!SUITS.includes(suit as Suit)) return null;
    
    const key = `${rank}${suit}`;
    if (seen.has(key)) return null;
    seen.add(key);
    
    cards.push({ rank: rank as Rank, suit: suit as Suit });
  }
  
  return cards;
}

export function cardsToConcat(cards: Card[]): string {
  return cards.map(c => `${c.rank}${c.suit}`).join('');
}

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  
  const result: T[][] = [];
  
  function backtrack(start: number, current: T[]) {
    if (current.length === k) {
      result.push([...current]);
      return;
    }
    for (let i = start; i <= arr.length - (k - current.length); i++) {
      current.push(arr[i]);
      backtrack(i + 1, current);
      current.pop();
    }
  }
  
  backtrack(0, []);
  return result;
}

export function evaluateOmahaHand(holeCards: Card[], boardCards: Card[]): HandResult | null {
  if (holeCards.length < 2 || boardCards.length < 3) return null;
  
  const holeCombs = combinations(holeCards, 2);
  const boardCombs = combinations(boardCards, 3);
  
  let bestResult: HandResult | null = null;
  
  for (const hole2 of holeCombs) {
    for (const board3 of boardCombs) {
      const hand = [...hole2, ...board3];
      try {
        const result = evaluateHand(hand);
        if (!bestResult || result.handRank > bestResult.handRank) {
          bestResult = result;
        }
      } catch {
        continue;
      }
    }
  }
  
  return bestResult;
}

export interface PlayerInput {
  id: number;
  cards: Card[];
  input: string;
}

export interface EquityResult {
  playerId: number;
  wins: number;
  ties: number;
  total: number;
  equity: number;
  bestHand?: HandResult;
}

export interface CalculationResult {
  results: EquityResult[];
  totalTrials: number;
  isExhaustive: boolean;
}

function getUsedCards(players: PlayerInput[], board: Card[]): Set<string> {
  const used = new Set<string>();
  for (const card of board) {
    used.add(`${card.rank}${card.suit}`);
  }
  for (const player of players) {
    for (const card of player.cards) {
      used.add(`${card.rank}${card.suit}`);
    }
  }
  return used;
}

function getRemainingDeck(usedCards: Set<string>): Card[] {
  const deck: Card[] = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      const key = `${rank}${suit}`;
      if (!usedCards.has(key)) {
        deck.push({ rank, suit });
      }
    }
  }
  return deck;
}

export function calculateEquity(
  players: PlayerInput[],
  board: Card[],
  onProgress?: (progress: number) => void
): CalculationResult {
  const validPlayers = players.filter(p => p.cards.length >= 2 && p.cards.length <= 5);
  if (validPlayers.length < 2) {
    return { results: [], totalTrials: 0, isExhaustive: true };
  }
  
  const usedCards = getUsedCards(validPlayers, board);
  const remainingDeck = getRemainingDeck(usedCards);
  const cardsNeeded = 5 - board.length;
  
  const results: Map<number, { wins: number; ties: number; total: number }> = new Map();
  for (const player of validPlayers) {
    results.set(player.id, { wins: 0, ties: 0, total: 0 });
  }
  
  const boardCompletions = cardsNeeded > 0 
    ? combinations(remainingDeck, cardsNeeded) 
    : [[]];
  
  const totalTrials = boardCompletions.length;
  let processed = 0;
  
  for (const completion of boardCompletions) {
    const fullBoard = [...board, ...completion];
    
    const playerResults: { playerId: number; result: HandResult | null }[] = [];
    
    for (const player of validPlayers) {
      const result = evaluateOmahaHand(player.cards, fullBoard);
      playerResults.push({ playerId: player.id, result });
    }
    
    const validResults = playerResults.filter(p => p.result !== null);
    if (validResults.length === 0) continue;
    
    const bestRank = Math.max(...validResults.map(p => p.result!.handRank));
    const winners = validResults.filter(p => p.result!.handRank === bestRank);
    
    for (const player of validPlayers) {
      const stats = results.get(player.id)!;
      stats.total++;
      
      const playerResult = playerResults.find(p => p.playerId === player.id);
      if (playerResult?.result) {
        if (playerResult.result.handRank === bestRank) {
          if (winners.length === 1) {
            stats.wins++;
          } else {
            stats.ties++;
          }
        }
      }
    }
    
    processed++;
    if (onProgress && processed % 100 === 0) {
      onProgress(processed / totalTrials);
    }
  }
  
  const equityResults: EquityResult[] = validPlayers.map(player => {
    const stats = results.get(player.id)!;
    const equity = stats.total > 0 
      ? ((stats.wins + stats.ties / 2) / stats.total) * 100 
      : 0;
    
    const bestHand = board.length === 5 
      ? evaluateOmahaHand(player.cards, board) ?? undefined
      : undefined;
    
    return {
      playerId: player.id,
      wins: stats.wins,
      ties: stats.ties,
      total: stats.total,
      equity,
      bestHand
    };
  });
  
  return {
    results: equityResults,
    totalTrials,
    isExhaustive: true
  };
}

export function calculateEquityAsync(
  players: PlayerInput[],
  board: Card[],
  onProgress?: (progress: number) => void
): Promise<CalculationResult> {
  return new Promise((resolve) => {
    const validPlayers = players.filter(p => p.cards.length >= 2 && p.cards.length <= 5);
    if (validPlayers.length < 2) {
      resolve({ results: [], totalTrials: 0, isExhaustive: true });
      return;
    }
    
    const usedCards = getUsedCards(validPlayers, board);
    const remainingDeck = getRemainingDeck(usedCards);
    const cardsNeeded = 5 - board.length;
    
    const results: Map<number, { wins: number; ties: number; total: number }> = new Map();
    for (const player of validPlayers) {
      results.set(player.id, { wins: 0, ties: 0, total: 0 });
    }
    
    const boardCompletions = cardsNeeded > 0 
      ? combinations(remainingDeck, cardsNeeded) 
      : [[]];
    
    const totalTrials = boardCompletions.length;
    let processed = 0;
    const BATCH_SIZE = 1000;
    
    function processBatch() {
      const batchEnd = Math.min(processed + BATCH_SIZE, totalTrials);
      
      for (let i = processed; i < batchEnd; i++) {
        const completion = boardCompletions[i];
        const fullBoard = [...board, ...completion];
        
        const playerResults: { playerId: number; result: HandResult | null }[] = [];
        
        for (const player of validPlayers) {
          const result = evaluateOmahaHand(player.cards, fullBoard);
          playerResults.push({ playerId: player.id, result });
        }
        
        const validResults = playerResults.filter(p => p.result !== null);
        if (validResults.length === 0) continue;
        
        const bestRank = Math.max(...validResults.map(p => p.result!.handRank));
        const winners = validResults.filter(p => p.result!.handRank === bestRank);
        
        for (const player of validPlayers) {
          const stats = results.get(player.id)!;
          stats.total++;
          
          const playerResult = playerResults.find(p => p.playerId === player.id);
          if (playerResult?.result) {
            if (playerResult.result.handRank === bestRank) {
              if (winners.length === 1) {
                stats.wins++;
              } else {
                stats.ties++;
              }
            }
          }
        }
      }
      
      processed = batchEnd;
      
      if (onProgress) {
        onProgress(processed / totalTrials);
      }
      
      if (processed < totalTrials) {
        setTimeout(processBatch, 0);
      } else {
        const equityResults: EquityResult[] = validPlayers.map(player => {
          const stats = results.get(player.id)!;
          const equity = stats.total > 0 
            ? ((stats.wins + stats.ties / 2) / stats.total) * 100 
            : 0;
          
          const bestHand = board.length === 5 
            ? evaluateOmahaHand(player.cards, board) ?? undefined
            : undefined;
          
          return {
            playerId: player.id,
            wins: stats.wins,
            ties: stats.ties,
            total: stats.total,
            equity,
            bestHand
          };
        });
        
        resolve({
          results: equityResults,
          totalTrials,
          isExhaustive: true
        });
      }
    }
    
    setTimeout(processBatch, 0);
  });
}
