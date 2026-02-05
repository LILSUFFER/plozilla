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
  const trimmed = cardsStr.trim();
  
  // First try splitting by whitespace
  const parts = trimmed.split(/\s+/);
  
  for (const part of parts) {
    // If part is longer than 3 chars, it might be concatenated cards (e.g., "AsKdQsJhTh")
    if (part.length > 3) {
      // Try to extract cards from concatenated string
      const extracted = extractConcatenatedCards(part);
      cards.push(...extracted);
    } else {
      const card = parseCard(part);
      if (card) cards.push(card);
    }
  }
  
  return cards;
}

function extractConcatenatedCards(str: string): Card[] {
  const cards: Card[] = [];
  let i = 0;
  
  while (i < str.length) {
    // Check for "10x" format (3 chars)
    if (i + 2 < str.length && str.substring(i, i + 2) === '10') {
      const card = parseCard(str.substring(i, i + 3));
      if (card) {
        cards.push(card);
        i += 3;
        continue;
      }
    }
    
    // Standard 2-char card format
    if (i + 1 < str.length) {
      const card = parseCard(str.substring(i, i + 2));
      if (card) {
        cards.push(card);
        i += 2;
        continue;
      }
    }
    
    // Skip unrecognized character
    i++;
  }
  
  return cards;
}

export function parseHandHistory(text: string): ParsedHandHistory | null {
  const result: ParsedHandHistory = {
    heroHand: null,
    players: [],
    board: { flop: null, turn: null, river: null },
    availableStreets: []
  };
  
  // Format 1: PokerStars style - "Dealt to Hero [cards]"
  const heroMatch1 = text.match(/Dealt to Hero \[([^\]]+)\]/i);
  if (heroMatch1) {
    result.heroHand = parseCards(heroMatch1[1]);
  }
  
  // Format 2: DriveHUD style - "Dealt to Hero: cards"
  if (!result.heroHand) {
    const heroMatch2 = text.match(/Dealt to Hero:\s*([^\n]+)/i);
    if (heroMatch2) {
      result.heroHand = parseCards(heroMatch2[1]);
    }
  }
  
  // Format 1: PokerStars style - "player: shows [cards]"
  const showdownMatches1 = Array.from(text.matchAll(/([^\n:]+): (?:shows?|showed?) \[([^\]]+)\]/gi));
  for (const match of showdownMatches1) {
    const playerName = match[1].trim();
    const hand = parseCards(match[2]);
    if (hand.length === 5 && playerName.toLowerCase() !== 'hero') {
      result.players.push({ name: playerName, hand, isHero: false });
    }
  }
  
  // Format 2: DriveHUD style - "PLAYER shows: cards" (no brackets)
  const showdownMatches2 = Array.from(text.matchAll(/^(\w+) shows:\s*([^\n]+)/gim));
  for (const match of showdownMatches2) {
    const playerName = match[1].trim();
    const hand = parseCards(match[2]);
    if (hand.length === 5 && playerName.toLowerCase() !== 'hero') {
      // Check if this player is already added
      const exists = result.players.some(p => p.name === playerName);
      if (!exists) {
        result.players.push({ name: playerName, hand, isHero: false });
      }
    }
  }
  
  if (result.heroHand && result.heroHand.length === 5) {
    result.players.unshift({ name: 'Hero', hand: result.heroHand, isHero: true });
  }
  
  // Format 1: PokerStars style - "*** FLOP *** [cards]"
  const flopMatch1 = text.match(/\*\*\* FLOP \*\*\* \[([^\]]+)\]/);
  if (flopMatch1) {
    const flopCards = parseCards(flopMatch1[1]);
    if (flopCards.length === 3) {
      result.board.flop = flopCards;
    }
  }
  
  // Format 2: DriveHUD style - "Flop (BBs): cards"
  if (!result.board.flop) {
    const flopMatch2 = text.match(/^Flop[^:]*:\s*([^\n]+)/im);
    if (flopMatch2) {
      const flopCards = parseCards(flopMatch2[1]);
      if (flopCards.length >= 3) {
        result.board.flop = flopCards.slice(0, 3);
      }
    }
  }
  
  // Format 1: PokerStars style - "*** TURN *** [flop] [turn]"
  const turnMatch1 = text.match(/\*\*\* TURN \*\*\* \[[^\]]+\] \[([^\]]+)\]/);
  if (turnMatch1) {
    const turnCard = parseCard(turnMatch1[1].trim());
    if (turnCard) {
      result.board.turn = turnCard;
    }
  }
  
  // Format 2: DriveHUD style - "Turn (BBs): flop cards + turn card"
  if (!result.board.turn) {
    const turnMatch2 = text.match(/^Turn[^:]*:\s*([^\n]+)/im);
    if (turnMatch2) {
      const turnCards = parseCards(turnMatch2[1]);
      if (turnCards.length >= 4) {
        result.board.flop = turnCards.slice(0, 3);
        result.board.turn = turnCards[3];
      }
    }
  }
  
  // Format 1: PokerStars style - "*** RIVER *** [flop + turn] [river]"
  const riverMatch1 = text.match(/\*\*\* RIVER \*\*\* \[[^\]]+\] \[([^\]]+)\]/);
  if (riverMatch1) {
    const riverCard = parseCard(riverMatch1[1].trim());
    if (riverCard) {
      result.board.river = riverCard;
    }
  }
  
  // Format 2: DriveHUD style - "River (BBs): all 5 board cards"
  if (!result.board.river) {
    const riverMatch2 = text.match(/^River[^:]*:\s*([^\n]+)/im);
    if (riverMatch2) {
      const riverCards = parseCards(riverMatch2[1]);
      if (riverCards.length >= 5) {
        result.board.flop = riverCards.slice(0, 3);
        result.board.turn = riverCards[3];
        result.board.river = riverCards[4];
      }
    }
  }
  
  if (result.players.length >= 1 || result.heroHand) {
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
