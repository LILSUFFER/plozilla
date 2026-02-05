// Parallel equity calculation worker

const binomial: number[][] = [];
for (let n = 0; n <= 52; n++) {
  binomial[n] = [1];
  for (let k = 1; k <= Math.min(n, 5); k++) {
    binomial[n][k] = (binomial[n-1]?.[k-1] || 0) + (binomial[n-1]?.[k] || 0);
  }
}

let handRanks: Uint32Array | null = null;

const H2: [number, number][] = [[0,1],[0,2],[0,3],[0,4],[1,2],[1,3],[1,4],[2,3],[2,4],[3,4]];
const B3: [number, number, number][] = [[0,1,2],[0,1,3],[0,1,4],[0,2,3],[0,2,4],[0,3,4],[1,2,3],[1,2,4],[1,3,4],[2,3,4]];

function getIdx(c0: number, c1: number, c2: number, c3: number, c4: number): number {
  let a = c0, b = c1, c = c2, d = c3, e = c4, t: number;
  if (a > b) { t = a; a = b; b = t; }
  if (c > d) { t = c; c = d; d = t; }
  if (a > c) { t = a; a = c; c = t; }
  if (b > d) { t = b; b = d; d = t; }
  if (b > c) { t = b; b = c; c = t; }
  if (a > b) { t = a; a = b; b = t; }
  if (c > d) { t = c; c = d; d = t; }
  if (d > e) { t = d; d = e; e = t; }
  if (c > d) { t = c; c = d; d = t; }
  if (b > c) { t = b; b = c; c = t; }
  if (c > d) { t = c; c = d; d = t; }
  return binomial[a][1] + binomial[b][2] + binomial[c][3] + binomial[d][4] + binomial[e][5];
}

function evalBest(hand: number[], board: number[]): number {
  if (!handRanks) return 0;
  let best = 0;
  const hLen = hand.length;
  for (let hi = 0; hi < 10; hi++) {
    const [h0, h1] = H2[hi];
    if (h0 >= hLen || h1 >= hLen) continue;
    for (let bi = 0; bi < 10; bi++) {
      const [b0, b1, b2] = B3[bi];
      const idx = getIdx(hand[h0], hand[h1], board[b0], board[b1], board[b2]);
      const rank = handRanks[idx];
      if (rank > best) best = rank;
    }
  }
  return best;
}

function calcRange(
  hands: number[][],
  bCards: number[],
  deck: number[],
  cn: number,
  start: number,
  end: number
): { wins: number[], ties: number[], count: number } {
  const np = hands.length;
  const wins = new Array(np).fill(0);
  const ties = new Array(np).fill(0);
  const scores = new Array(np);
  let count = 0;
  const dl = deck.length;

  if (cn === 5) {
    let idx = 0;
    for (let c0 = 0; c0 < dl - 4 && idx < end; c0++) {
      for (let c1 = c0 + 1; c1 < dl - 3 && idx < end; c1++) {
        for (let c2 = c1 + 1; c2 < dl - 2 && idx < end; c2++) {
          for (let c3 = c2 + 1; c3 < dl - 1 && idx < end; c3++) {
            for (let c4 = c3 + 1; c4 < dl && idx < end; c4++) {
              if (idx >= start) {
                const b = [deck[c0], deck[c1], deck[c2], deck[c3], deck[c4]];
                let mx = 0;
                for (let p = 0; p < np; p++) { scores[p] = evalBest(hands[p], b); if (scores[p] > mx) mx = scores[p]; }
                let wc = 0; for (let p = 0; p < np; p++) if (scores[p] === mx) wc++;
                for (let p = 0; p < np; p++) if (scores[p] === mx) { if (wc === 1) wins[p]++; else ties[p]++; }
                count++;
              }
              idx++;
            }
          }
        }
      }
    }
  } else if (cn === 4) {
    let idx = 0;
    for (let c0 = 0; c0 < dl - 3 && idx < end; c0++) {
      for (let c1 = c0 + 1; c1 < dl - 2 && idx < end; c1++) {
        for (let c2 = c1 + 1; c2 < dl - 1 && idx < end; c2++) {
          for (let c3 = c2 + 1; c3 < dl && idx < end; c3++) {
            if (idx >= start) {
              const b = [...bCards, deck[c0], deck[c1], deck[c2], deck[c3]];
              let mx = 0;
              for (let p = 0; p < np; p++) { scores[p] = evalBest(hands[p], b); if (scores[p] > mx) mx = scores[p]; }
              let wc = 0; for (let p = 0; p < np; p++) if (scores[p] === mx) wc++;
              for (let p = 0; p < np; p++) if (scores[p] === mx) { if (wc === 1) wins[p]++; else ties[p]++; }
              count++;
            }
            idx++;
          }
        }
      }
    }
  } else if (cn === 3) {
    let idx = 0;
    for (let c0 = 0; c0 < dl - 2 && idx < end; c0++) {
      for (let c1 = c0 + 1; c1 < dl - 1 && idx < end; c1++) {
        for (let c2 = c1 + 1; c2 < dl && idx < end; c2++) {
          if (idx >= start) {
            const b = [...bCards, deck[c0], deck[c1], deck[c2]];
            let mx = 0;
            for (let p = 0; p < np; p++) { scores[p] = evalBest(hands[p], b); if (scores[p] > mx) mx = scores[p]; }
            let wc = 0; for (let p = 0; p < np; p++) if (scores[p] === mx) wc++;
            for (let p = 0; p < np; p++) if (scores[p] === mx) { if (wc === 1) wins[p]++; else ties[p]++; }
            count++;
          }
          idx++;
        }
      }
    }
  } else if (cn === 2) {
    let idx = 0;
    for (let c0 = 0; c0 < dl - 1 && idx < end; c0++) {
      for (let c1 = c0 + 1; c1 < dl && idx < end; c1++) {
        if (idx >= start) {
          const b = [...bCards, deck[c0], deck[c1]];
          let mx = 0;
          for (let p = 0; p < np; p++) { scores[p] = evalBest(hands[p], b); if (scores[p] > mx) mx = scores[p]; }
          let wc = 0; for (let p = 0; p < np; p++) if (scores[p] === mx) wc++;
          for (let p = 0; p < np; p++) if (scores[p] === mx) { if (wc === 1) wins[p]++; else ties[p]++; }
          count++;
        }
        idx++;
      }
    }
  } else if (cn === 1) {
    for (let c0 = start; c0 < Math.min(end, dl); c0++) {
      const b = [...bCards, deck[c0]];
      let mx = 0;
      for (let p = 0; p < np; p++) { scores[p] = evalBest(hands[p], b); if (scores[p] > mx) mx = scores[p]; }
      let wc = 0; for (let p = 0; p < np; p++) if (scores[p] === mx) wc++;
      for (let p = 0; p < np; p++) if (scores[p] === mx) { if (wc === 1) wins[p]++; else ties[p]++; }
      count++;
    }
  } else if (cn === 0 && start === 0) {
    let mx = 0;
    for (let p = 0; p < np; p++) { scores[p] = evalBest(hands[p], bCards); if (scores[p] > mx) mx = scores[p]; }
    let wc = 0; for (let p = 0; p < np; p++) if (scores[p] === mx) wc++;
    for (let p = 0; p < np; p++) if (scores[p] === mx) { if (wc === 1) wins[p]++; else ties[p]++; }
    count = 1;
  }
  return { wins, ties, count };
}

self.onmessage = (e: MessageEvent) => {
  const msg = e.data;
  if (msg.type === 'init') {
    handRanks = new Uint32Array(msg.buffer);
    self.postMessage({ type: 'ready' });
  } else if (msg.type === 'calc') {
    const r = calcRange(msg.hands, msg.board, msg.deck, msg.cn, msg.start, msg.end);
    self.postMessage({ type: 'done', ...r });
  }
};
