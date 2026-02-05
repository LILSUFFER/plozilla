// Optimized equity calculator - correct and reasonably fast

interface Card { rank: string; suit: string; }
interface PlayerInput { id: number; cards: Card[]; input: string; }
interface EquityResult { playerId: number; wins: number; ties: number; total: number; equity: number; }
interface CalculationResult { results: EquityResult[]; totalTrials: number; isExhaustive: boolean; }

const RANK_VALUES: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};
const SUIT_MAP: Record<string, number> = { 'c': 0, 'd': 1, 'h': 2, 's': 3 };

const H2 = [[0,1],[0,2],[0,3],[0,4],[1,2],[1,3],[1,4],[2,3],[2,4],[3,4]];
const B3 = [[0,1,2],[0,1,3],[0,1,4],[0,2,3],[0,2,4],[0,3,4],[1,2,3],[1,2,4],[1,3,4],[2,3,4]];

function eval5(r0: number, r1: number, r2: number, r3: number, r4: number,
               s0: number, s1: number, s2: number, s3: number, s4: number): number {
  const counts = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
  counts[r0]++; counts[r1]++; counts[r2]++; counts[r3]++; counts[r4]++;
  
  let quads = -1, trips = -1;
  const pairs: number[] = [];
  const singles: number[] = [];
  
  for (let r = 14; r >= 2; r--) {
    if (counts[r] === 4) quads = r;
    else if (counts[r] === 3) trips = r;
    else if (counts[r] === 2) pairs.push(r);
    else if (counts[r] === 1) singles.push(r);
  }
  
  const isFlush = s0 === s1 && s1 === s2 && s2 === s3 && s3 === s4;
  const sorted = [r0, r1, r2, r3, r4].sort((a, b) => b - a);
  
  let straightHigh: number | null = null;
  if (sorted[0] - sorted[4] === 4 && 
      sorted[0] - sorted[1] === 1 && sorted[1] - sorted[2] === 1 && 
      sorted[2] - sorted[3] === 1 && sorted[3] - sorted[4] === 1) {
    straightHigh = sorted[0];
  } else if (sorted[0] === 14 && sorted[1] === 5 && sorted[2] === 4 && 
             sorted[3] === 3 && sorted[4] === 2) {
    straightHigh = 5;
  }
  
  const BASE = 1000000;
  
  if (isFlush && straightHigh !== null) {
    return (straightHigh === 14 ? 9 : 8) * BASE + straightHigh;
  }
  if (quads >= 0) {
    const kicker = singles.length > 0 ? singles[0] : pairs[0];
    return 7 * BASE + quads * 15 + kicker;
  }
  if (trips >= 0 && pairs.length > 0) {
    return 6 * BASE + trips * 15 + pairs[0];
  }
  if (isFlush) {
    return 5 * BASE + sorted[0] * 50625 + sorted[1] * 3375 + sorted[2] * 225 + sorted[3] * 15 + sorted[4];
  }
  if (straightHigh !== null) {
    return 4 * BASE + straightHigh;
  }
  if (trips >= 0) {
    return 3 * BASE + trips * 225 + singles[0] * 15 + singles[1];
  }
  if (pairs.length >= 2) {
    const kicker = singles.length > 0 ? singles[0] : 0;
    return 2 * BASE + pairs[0] * 225 + pairs[1] * 15 + kicker;
  }
  if (pairs.length === 1) {
    return 1 * BASE + pairs[0] * 3375 + singles[0] * 225 + singles[1] * 15 + singles[2];
  }
  return sorted[0] * 50625 + sorted[1] * 3375 + sorted[2] * 225 + sorted[3] * 15 + sorted[4];
}

function calculateEquity(players: PlayerInput[], board: Card[]): CalculationResult {
  const validPlayers = players.filter(p => p.cards.length >= 2 && p.cards.length <= 5);
  if (validPlayers.length < 2) return { results: [], totalTrials: 0, isExhaustive: true };
  
  const numPlayers = validPlayers.length;
  const playerRanks: number[][] = [];
  const playerSuits: number[][] = [];
  const used = new Set<string>();
  
  for (const p of validPlayers) {
    const r: number[] = [], s: number[] = [];
    for (const c of p.cards) {
      r.push(RANK_VALUES[c.rank]);
      s.push(SUIT_MAP[c.suit]);
      used.add(`${c.rank}${c.suit}`);
    }
    playerRanks.push(r);
    playerSuits.push(s);
  }
  
  const boardR: number[] = [], boardS: number[] = [];
  for (const c of board) {
    boardR.push(RANK_VALUES[c.rank]);
    boardS.push(SUIT_MAP[c.suit]);
    used.add(`${c.rank}${c.suit}`);
  }
  
  const RANKS = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
  const SUITS = ['c','d','h','s'];
  const deckR: number[] = [], deckS: number[] = [];
  for (const r of RANKS) for (const s of SUITS) 
    if (!used.has(`${r}${s}`)) { deckR.push(RANK_VALUES[r]); deckS.push(SUIT_MAP[s]); }
  
  const cardsNeeded = 5 - board.length;
  const deckLen = deckR.length;
  
  let totalTrials = 1;
  if (cardsNeeded > 0) {
    let num = 1;
    for (let i = 0; i < cardsNeeded; i++) num *= (deckLen - i);
    for (let i = 2; i <= cardsNeeded; i++) num /= i;
    totalTrials = Math.round(num);
  }
  
  const wins = new Array(numPlayers).fill(0);
  const ties = new Array(numPlayers).fill(0);
  let processed = 0;
  const progressInterval = Math.max(1, Math.floor(totalTrials / 20));
  
  const evalOmaha = (pIdx: number, br: number[], bs: number[]): number => {
    const hr = playerRanks[pIdx], hs = playerSuits[pIdx], hLen = hr.length;
    let best = 0;
    for (let hi = 0; hi < 10; hi++) {
      const [h0, h1] = H2[hi];
      if (h0 >= hLen || h1 >= hLen) continue;
      for (let bi = 0; bi < 10; bi++) {
        const [b0, b1, b2] = B3[bi];
        const sc = eval5(hr[h0], hr[h1], br[b0], br[b1], br[b2],
                         hs[h0], hs[h1], bs[b0], bs[b1], bs[b2]);
        if (sc > best) best = sc;
      }
    }
    return best;
  };
  
  const scores = new Array(numPlayers);
  
  const updateWinners = () => {
    let mx = 0;
    for (let p = 0; p < numPlayers; p++) if (scores[p] > mx) mx = scores[p];
    let wc = 0;
    for (let p = 0; p < numPlayers; p++) if (scores[p] === mx) wc++;
    for (let p = 0; p < numPlayers; p++) 
      if (scores[p] === mx) { if (wc === 1) wins[p]++; else ties[p]++; }
  };
  
  if (cardsNeeded === 0) {
    for (let p = 0; p < numPlayers; p++) scores[p] = evalOmaha(p, boardR, boardS);
    updateWinners();
    processed = 1;
  } else if (cardsNeeded === 2) {
    const fR = [...boardR, 0, 0], fS = [...boardS, 0, 0];
    for (let i = 0; i < deckLen - 1; i++) {
      fR[3] = deckR[i]; fS[3] = deckS[i];
      for (let j = i + 1; j < deckLen; j++) {
        fR[4] = deckR[j]; fS[4] = deckS[j];
        for (let p = 0; p < numPlayers; p++) scores[p] = evalOmaha(p, fR, fS);
        updateWinners();
        if (++processed % progressInterval === 0) 
          self.postMessage({ type: 'progress', progress: processed / totalTrials });
      }
    }
  } else if (cardsNeeded === 5) {
    const fR = [0,0,0,0,0], fS = [0,0,0,0,0];
    for (let a = 0; a < deckLen - 4; a++) {
      fR[0] = deckR[a]; fS[0] = deckS[a];
      for (let b = a + 1; b < deckLen - 3; b++) {
        fR[1] = deckR[b]; fS[1] = deckS[b];
        for (let c = b + 1; c < deckLen - 2; c++) {
          fR[2] = deckR[c]; fS[2] = deckS[c];
          for (let d = c + 1; d < deckLen - 1; d++) {
            fR[3] = deckR[d]; fS[3] = deckS[d];
            for (let e = d + 1; e < deckLen; e++) {
              fR[4] = deckR[e]; fS[4] = deckS[e];
              for (let p = 0; p < numPlayers; p++) scores[p] = evalOmaha(p, fR, fS);
              updateWinners();
              if (++processed % progressInterval === 0) 
                self.postMessage({ type: 'progress', progress: processed / totalTrials });
            }
          }
        }
      }
    }
  } else {
    const idx: number[] = []; for (let i = 0; i < cardsNeeded; i++) idx.push(i);
    const fR = [...boardR], fS = [...boardS];
    for (let i = 0; i < cardsNeeded; i++) { fR.push(0); fS.push(0); }
    while (true) {
      for (let i = 0; i < cardsNeeded; i++) {
        fR[board.length + i] = deckR[idx[i]];
        fS[board.length + i] = deckS[idx[i]];
      }
      for (let p = 0; p < numPlayers; p++) scores[p] = evalOmaha(p, fR, fS);
      updateWinners();
      if (++processed % progressInterval === 0) 
        self.postMessage({ type: 'progress', progress: processed / totalTrials });
      let i = cardsNeeded - 1;
      while (i >= 0 && idx[i] === deckLen - cardsNeeded + i) i--;
      if (i < 0) break;
      idx[i]++;
      for (let j = i + 1; j < cardsNeeded; j++) idx[j] = idx[j - 1] + 1;
    }
  }
  
  return {
    results: validPlayers.map((p, i) => ({
      playerId: p.id,
      wins: wins[i],
      ties: ties[i],
      total: processed,
      equity: processed > 0 ? ((wins[i] + ties[i] / 2) / processed) * 100 : 0
    })),
    totalTrials,
    isExhaustive: true
  };
}

self.onmessage = (e: MessageEvent) => {
  const { players, board } = e.data;
  const result = calculateEquity(players, board);
  self.postMessage({ type: 'result', result });
};
