// Worker code for parallel equity calculation

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

function getHandIndex(c0: number, c1: number, c2: number, c3: number, c4: number): number {
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

const H2_0 = [0,0,0,0,1,1,1,2,2,3];
const H2_1 = [1,2,3,4,2,3,4,3,4,4];
const B3_0 = [0,0,0,0,0,0,1,1,1,2];
const B3_1 = [1,1,1,2,2,3,2,2,3,3];
const B3_2 = [2,3,4,3,4,4,3,4,4,4];

function evalBest5(h0: number, h1: number, h2: number, h3: number, h4: number, b0: number, b1: number, b2: number, b3: number, b4: number): number {
  if (!handRanks) return 0;
  const h = [h0, h1, h2, h3, h4];
  const b = [b0, b1, b2, b3, b4];
  let best = 0;
  for (let hi = 0; hi < 10; hi++) {
    const hc0 = h[H2_0[hi]], hc1 = h[H2_1[hi]];
    for (let bi = 0; bi < 10; bi++) {
      const idx = getHandIndex(hc0, hc1, b[B3_0[bi]], b[B3_1[bi]], b[B3_2[bi]]);
      const rank = handRanks[idx];
      if (rank > best) best = rank;
    }
  }
  return best;
}

function evalBest(hand: number[], board: number[]): number {
  if (!handRanks) return 0;
  let best = 0;
  const hLen = hand.length;
  const b0 = board[0], b1 = board[1], b2 = board[2], b3 = board[3], b4 = board[4];
  
  for (let hi = 0; hi < 10; hi++) {
    const i0 = H2_0[hi], i1 = H2_1[hi];
    if (i0 >= hLen || i1 >= hLen) continue;
    const hc0 = hand[i0], hc1 = hand[i1];
    for (let bi = 0; bi < 10; bi++) {
      const idx = getHandIndex(hc0, hc1, board[B3_0[bi]], board[B3_1[bi]], board[B3_2[bi]]);
      const rank = handRanks[idx];
      if (rank > best) best = rank;
    }
  }
  return best;
}

function calculateRange(
  playerHands: number[][],
  boardCards: number[],
  deck: number[],
  cardsNeeded: number,
  startIdx: number,
  endIdx: number
): { wins: number[], ties: number[], runouts: number } {
  const np = playerHands.length;
  const wins = new Array(np).fill(0);
  const ties = new Array(np).fill(0);
  const scores = new Array(np);
  let runouts = 0;
  const dl = deck.length;

  if (cardsNeeded === 5) {
    let idx = 0;
    for (let c0 = 0; c0 < dl - 4 && idx < endIdx; c0++) {
      for (let c1 = c0 + 1; c1 < dl - 3 && idx < endIdx; c1++) {
        for (let c2 = c1 + 1; c2 < dl - 2 && idx < endIdx; c2++) {
          for (let c3 = c2 + 1; c3 < dl - 1 && idx < endIdx; c3++) {
            for (let c4 = c3 + 1; c4 < dl && idx < endIdx; c4++) {
              if (idx >= startIdx) {
                const board = [deck[c0], deck[c1], deck[c2], deck[c3], deck[c4]];
                let maxScore = 0;
                for (let p = 0; p < np; p++) {
                  scores[p] = evalBest(playerHands[p], board);
                  if (scores[p] > maxScore) maxScore = scores[p];
                }
                let winCount = 0;
                for (let p = 0; p < np; p++) if (scores[p] === maxScore) winCount++;
                for (let p = 0; p < np; p++) {
                  if (scores[p] === maxScore) {
                    if (winCount === 1) wins[p]++; else ties[p]++;
                  }
                }
                runouts++;
              }
              idx++;
            }
          }
        }
      }
    }
  } else if (cardsNeeded === 4) {
    let idx = 0;
    for (let c0 = 0; c0 < dl - 3 && idx < endIdx; c0++) {
      for (let c1 = c0 + 1; c1 < dl - 2 && idx < endIdx; c1++) {
        for (let c2 = c1 + 1; c2 < dl - 1 && idx < endIdx; c2++) {
          for (let c3 = c2 + 1; c3 < dl && idx < endIdx; c3++) {
            if (idx >= startIdx) {
              const board = [...boardCards, deck[c0], deck[c1], deck[c2], deck[c3]];
              let maxScore = 0;
              for (let p = 0; p < np; p++) {
                scores[p] = evalBest(playerHands[p], board);
                if (scores[p] > maxScore) maxScore = scores[p];
              }
              let winCount = 0;
              for (let p = 0; p < np; p++) if (scores[p] === maxScore) winCount++;
              for (let p = 0; p < np; p++) {
                if (scores[p] === maxScore) {
                  if (winCount === 1) wins[p]++; else ties[p]++;
                }
              }
              runouts++;
            }
            idx++;
          }
        }
      }
    }
  } else if (cardsNeeded === 3) {
    let idx = 0;
    for (let c0 = 0; c0 < dl - 2 && idx < endIdx; c0++) {
      for (let c1 = c0 + 1; c1 < dl - 1 && idx < endIdx; c1++) {
        for (let c2 = c1 + 1; c2 < dl && idx < endIdx; c2++) {
          if (idx >= startIdx) {
            const board = [...boardCards, deck[c0], deck[c1], deck[c2]];
            let maxScore = 0;
            for (let p = 0; p < np; p++) {
              scores[p] = evalBest(playerHands[p], board);
              if (scores[p] > maxScore) maxScore = scores[p];
            }
            let winCount = 0;
            for (let p = 0; p < np; p++) if (scores[p] === maxScore) winCount++;
            for (let p = 0; p < np; p++) {
              if (scores[p] === maxScore) {
                if (winCount === 1) wins[p]++; else ties[p]++;
              }
            }
            runouts++;
          }
          idx++;
        }
      }
    }
  } else if (cardsNeeded === 2) {
    let idx = 0;
    for (let c0 = 0; c0 < dl - 1 && idx < endIdx; c0++) {
      for (let c1 = c0 + 1; c1 < dl && idx < endIdx; c1++) {
        if (idx >= startIdx) {
          const board = [...boardCards, deck[c0], deck[c1]];
          let maxScore = 0;
          for (let p = 0; p < np; p++) {
            scores[p] = evalBest(playerHands[p], board);
            if (scores[p] > maxScore) maxScore = scores[p];
          }
          let winCount = 0;
          for (let p = 0; p < np; p++) if (scores[p] === maxScore) winCount++;
          for (let p = 0; p < np; p++) {
            if (scores[p] === maxScore) {
              if (winCount === 1) wins[p]++; else ties[p]++;
            }
          }
          runouts++;
        }
        idx++;
      }
    }
  } else if (cardsNeeded === 1) {
    for (let c0 = startIdx; c0 < Math.min(endIdx, dl); c0++) {
      const board = [...boardCards, deck[c0]];
      let maxScore = 0;
      for (let p = 0; p < np; p++) {
        scores[p] = evalBest(playerHands[p], board);
        if (scores[p] > maxScore) maxScore = scores[p];
      }
      let winCount = 0;
      for (let p = 0; p < np; p++) if (scores[p] === maxScore) winCount++;
      for (let p = 0; p < np; p++) {
        if (scores[p] === maxScore) {
          if (winCount === 1) wins[p]++; else ties[p]++;
        }
      }
      runouts++;
    }
  } else if (cardsNeeded === 0 && startIdx === 0) {
    let maxScore = 0;
    for (let p = 0; p < np; p++) {
      scores[p] = evalBest(playerHands[p], boardCards);
      if (scores[p] > maxScore) maxScore = scores[p];
    }
    let winCount = 0;
    for (let p = 0; p < np; p++) if (scores[p] === maxScore) winCount++;
    for (let p = 0; p < np; p++) {
      if (scores[p] === maxScore) {
        if (winCount === 1) wins[p]++; else ties[p]++;
      }
    }
    runouts = 1;
  }

  return { wins, ties, runouts };
}

self.onmessage = (e: MessageEvent) => {
  const msg = e.data;
  if (msg.type === 'init' && msg.tableBuffer) {
    handRanks = new Uint32Array(msg.tableBuffer);
    self.postMessage({ type: 'ready' });
  } else if (msg.type === 'calculate') {
    const result = calculateRange(
      msg.playerHands,
      msg.boardCards,
      msg.deck,
      msg.cardsNeeded,
      msg.startIdx,
      msg.endIdx
    );
    self.postMessage({ type: 'result', ...result });
  }
};
