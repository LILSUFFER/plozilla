import { type Card } from './poker-evaluator';

export interface ParsedHandHistory {
  heroHand: Card[] | null;
  players: { name: string; hand: Card[] | null; isHero: boolean }[];
  board: {
    flop: Card[] | null;
    turn: Card | null;
    river: Card | null;
  };
  availableStreets: ('preflop' | 'flop' | 'turn' | 'river')[];
}

function parseCard(cardStr: string): Card | null {
  const str = cardStr.trim();
  if (str.length < 2) return null;
  
  let rank: string;
  let suitChar: string;
  
  if (str.length === 3 && str.startsWith('10')) {
    rank = 'T';
    suitChar = str[2].toLowerCase();
  } else if (str.length === 2) {
    rank = str[0].toUpperCase();
    if (rank === '1') return null;
    if (rank === 'T' || rank === '1') rank = 'T';
    suitChar = str[1].toLowerCase();
  } else {
    return null;
  }
  
  const validRanks = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
  if (!validRanks.includes(rank)) return null;
  
  const suitMap: Record<string, 's' | 'h' | 'd' | 'c'> = {
    's': 's', 'h': 'h', 'd': 'd', 'c': 'c'
  };
  const suit = suitMap[suitChar];
  if (!suit) return null;
  
  return { rank, suit } as Card;
}

function parseCards(cardsStr: string): Card[] {
  const cards: Card[] = [];
  const parts = cardsStr.trim().split(/\s+/);
  
  for (const part of parts) {
    const card = parseCard(part);
    if (card) cards.push(card);
  }
  
  return cards;
}

export function parseHandHistory(text: string): ParsedHandHistory | null {
  const lines = text.split('\n').map(l => l.trim());
  
  const result: ParsedHandHistory = {
    heroHand: null,
    players: [],
    board: { flop: null, turn: null, river: null },
    availableStreets: []
  };
  
  const heroMatch = text.match(/Dealt to Hero \[([^\]]+)\]/);
  if (heroMatch) {
    result.heroHand = parseCards(heroMatch[1]);
  }
  
  const showdownMatches = Array.from(text.matchAll(/(\w+): shows \[([^\]]+)\]/g));
  for (const match of showdownMatches) {
    const playerName = match[1];
    const hand = parseCards(match[2]);
    if (hand.length === 5) {
      result.players.push({ name: playerName, hand, isHero: false });
    }
  }
  
  if (result.heroHand && result.heroHand.length === 5) {
    result.players.unshift({ name: 'Hero', hand: result.heroHand, isHero: true });
  }
  
  const flopMatch = text.match(/\*\*\* FLOP \*\*\* \[([^\]]+)\]/);
  if (flopMatch) {
    const flopCards = parseCards(flopMatch[1]);
    if (flopCards.length === 3) {
      result.board.flop = flopCards;
    }
  }
  
  const turnMatch = text.match(/\*\*\* TURN \*\*\* \[[^\]]+\] \[([^\]]+)\]/);
  if (turnMatch) {
    const turnCard = parseCard(turnMatch[1].trim());
    if (turnCard) {
      result.board.turn = turnCard;
    }
  }
  
  const riverMatch = text.match(/\*\*\* RIVER \*\*\* \[[^\]]+\] \[([^\]]+)\]/);
  if (riverMatch) {
    const riverCard = parseCard(riverMatch[1].trim());
    if (riverCard) {
      result.board.river = riverCard;
    }
  }
  
  if (result.players.length >= 2 || result.heroHand) {
    result.availableStreets.push('preflop');
    
    if (result.board.flop) {
      result.availableStreets.push('flop');
      
      if (result.board.turn) {
        result.availableStreets.push('turn');
        
        if (result.board.river) {
          result.availableStreets.push('river');
        }
      }
    }
  }
  
  if (result.players.length === 0 && !result.heroHand) {
    return null;
  }
  
  return result;
}

export function getStreetBoard(parsed: ParsedHandHistory, street: 'preflop' | 'flop' | 'turn' | 'river'): Card[] {
  switch (street) {
    case 'preflop':
      return [];
    case 'flop':
      return parsed.board.flop || [];
    case 'turn':
      if (parsed.board.flop && parsed.board.turn) {
        return [...parsed.board.flop, parsed.board.turn];
      }
      return [];
    case 'river':
      if (parsed.board.flop && parsed.board.turn && parsed.board.river) {
        return [...parsed.board.flop, parsed.board.turn, parsed.board.river];
      }
      return [];
  }
}

export function getStreetName(street: 'preflop' | 'flop' | 'turn' | 'river'): string {
  const names: Record<string, string> = {
    'preflop': 'Префлоп',
    'flop': 'Флоп',
    'turn': 'Тёрн',
    'river': 'Ривер'
  };
  return names[street] || street;
}
