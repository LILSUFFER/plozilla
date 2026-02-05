// Fast equity calculator - 30k samples

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

const SAMPLES = 10000;

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
  const vp = players.filter(p => p.cards.length >= 2 && p.cards.length <= 5);
  if (vp.length < 2) return { results: [], totalTrials: 0, isExhaustive: true };
  
  const np = vp.length;
  const pR: number[][] = [], pS: number[][] = [];
  const used = new Set<string>();
  
  for (const p of vp) {
    const r: number[] = [], s: number[] = [];
    for (const c of p.cards) {
      r.push(RANK_VALUES[c.rank]); s.push(SUIT_MAP[c.suit]);
      used.add(`${c.rank}${c.suit}`);
    }
    pR.push(r); pS.push(s);
  }
  
  const bR: number[] = [], bS: number[] = [];
  for (const c of board) {
    bR.push(RANK_VALUES[c.rank]); bS.push(SUIT_MAP[c.suit]);
    used.add(`${c.rank}${c.suit}`);
  }
  
  const dR: number[] = [], dS: number[] = [];
  for (const r of ['2','3','4','5','6','7','8','9','T','J','Q','K','A'])
    for (const s of ['c','d','h','s'])
      if (!used.has(`${r}${s}`)) { dR.push(RANK_VALUES[r]); dS.push(SUIT_MAP[s]); }
  
  const cn = 5 - board.length, dl = dR.length;
  const wins = new Uint32Array(np), ties = new Uint32Array(np);
  
  const evalOmaha = (pIdx: number, fR: number[], fS: number[]): number => {
    const hr = pR[pIdx], hs = pS[pIdx], hl = hr.length;
    let best = 0;
    for (let hi = 0; hi < 10; hi++) {
      const [h0, h1] = H2[hi];
      if (h0 >= hl || h1 >= hl) continue;
      for (let bi = 0; bi < 10; bi++) {
        const [b0, b1, b2] = B3[bi];
        const sc = eval5(hr[h0], hr[h1], fR[b0], fR[b1], fR[b2],
                         hs[h0], hs[h1], fS[b0], fS[b1], fS[b2]);
        if (sc > best) best = sc;
      }
    }
    return best;
  };
  
  const scores = new Uint32Array(np);
  const indices = Array.from({ length: dl }, (_, i) => i);
  const fR = [...bR], fS = [...bS];
  for (let i = 0; i < cn; i++) { fR.push(0); fS.push(0); }
  
  for (let trial = 0; trial < SAMPLES; trial++) {
    // Partial Fisher-Yates
    for (let i = 0; i < cn; i++) {
      const j = i + Math.floor(Math.random() * (dl - i));
      const t = indices[i]; indices[i] = indices[j]; indices[j] = t;
    }
    for (let i = 0; i < cn; i++) {
      fR[board.length + i] = dR[indices[i]];
      fS[board.length + i] = dS[indices[i]];
    }
    
    for (let p = 0; p < np; p++) scores[p] = evalOmaha(p, fR, fS);
    
    let mx = 0;
    for (let p = 0; p < np; p++) if (scores[p] > mx) mx = scores[p];
    let wc = 0;
    for (let p = 0; p < np; p++) if (scores[p] === mx) wc++;
    for (let p = 0; p < np; p++) 
      if (scores[p] === mx) { if (wc === 1) wins[p]++; else ties[p]++; }
    
    if (trial % 5000 === 0) 
      self.postMessage({ type: 'progress', progress: trial / SAMPLES });
  }
  
  return {
    results: vp.map((p, i) => ({
      playerId: p.id, wins: wins[i], ties: ties[i], total: SAMPLES,
      equity: ((wins[i] + ties[i] / 2) / SAMPLES) * 100
    })),
    totalTrials: SAMPLES,
    isExhaustive: false
  };
}

self.onmessage = (e: MessageEvent) => {
  const { players, board } = e.data;
  const result = calculateEquity(players, board);
  self.postMessage({ type: 'result', result });
};
