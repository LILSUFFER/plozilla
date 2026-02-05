// Generate Two Plus Two style lookup table for 5-card poker hands
// Output: ~10MB binary file with rank for each of 2,598,960 unique 5-card hands

const fs = require('fs');
const path = require('path');

// Hand rankings (higher = better)
const HIGH_CARD = 0;
const ONE_PAIR = 1;
const TWO_PAIR = 2;
const THREE_OF_A_KIND = 3;
const STRAIGHT = 4;
const FLUSH = 5;
const FULL_HOUSE = 6;
const FOUR_OF_A_KIND = 7;
const STRAIGHT_FLUSH = 8;

// Straight bitmasks (A-5 through T-A)
const STRAIGHTS = [
  0x100F, 0x001F, 0x003E, 0x007C, 0x00F8,
  0x01F0, 0x03E0, 0x07C0, 0x0F80, 0x1F00
];

// Precompute binomial coefficients C(n, k)
const binomial = new Array(53).fill(0).map(() => new Array(6).fill(0));
for (let n = 0; n <= 52; n++) {
  binomial[n][0] = 1;
  for (let k = 1; k <= Math.min(n, 5); k++) {
    binomial[n][k] = binomial[n-1][k-1] + binomial[n-1][k];
  }
}

// Get combinatorial index for sorted cards c0 < c1 < c2 < c3 < c4
function getIndex(c0, c1, c2, c3, c4) {
  return binomial[c0][1] + binomial[c1][2] + binomial[c2][3] + binomial[c3][4] + binomial[c4][5];
}

// Popcount
function popcount(x) {
  x = x - ((x >> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
  x = (x + (x >> 4)) & 0x0F0F0F0F;
  return (x * 0x01010101) >> 24;
}

// Evaluate 5 cards, returns score (higher = better)
function eval5(c0, c1, c2, c3, c4) {
  const r0 = c0 >> 2, r1 = c1 >> 2, r2 = c2 >> 2, r3 = c3 >> 2, r4 = c4 >> 2;
  const s0 = c0 & 3, s1 = c1 & 3, s2 = c2 & 3, s3 = c3 & 3, s4 = c4 & 3;
  
  const isFlush = s0 === s1 && s1 === s2 && s2 === s3 && s3 === s4;
  const bits = (1 << r0) | (1 << r1) | (1 << r2) | (1 << r3) | (1 << r4);
  const numUnique = popcount(bits);
  
  // Check for straight
  let straightHi = -1;
  for (let i = 9; i >= 0; i--) {
    if (bits === STRAIGHTS[i]) { straightHi = i; break; }
  }
  
  if (isFlush && straightHi >= 0) {
    return (STRAIGHT_FLUSH << 20) | straightHi;
  }
  
  // Sort ranks descending
  let ranks = [r0, r1, r2, r3, r4].sort((a, b) => b - a);
  let s = ranks;
  
  if (numUnique === 5) {
    if (isFlush) {
      return (FLUSH << 20) | (s[0] << 16) | (s[1] << 12) | (s[2] << 8) | (s[3] << 4) | s[4];
    }
    if (straightHi >= 0) {
      return (STRAIGHT << 20) | straightHi;
    }
    return (HIGH_CARD << 20) | (s[0] << 16) | (s[1] << 12) | (s[2] << 8) | (s[3] << 4) | s[4];
  }
  
  if (numUnique === 4) {
    // One pair
    let pairRank, k1, k2, k3;
    if (s[0] === s[1]) { pairRank = s[0]; k1 = s[2]; k2 = s[3]; k3 = s[4]; }
    else if (s[1] === s[2]) { pairRank = s[1]; k1 = s[0]; k2 = s[3]; k3 = s[4]; }
    else if (s[2] === s[3]) { pairRank = s[2]; k1 = s[0]; k2 = s[1]; k3 = s[4]; }
    else { pairRank = s[3]; k1 = s[0]; k2 = s[1]; k3 = s[2]; }
    return (ONE_PAIR << 20) | (pairRank << 16) | (k1 << 12) | (k2 << 8) | (k3 << 4);
  }
  
  if (numUnique === 3) {
    // Two pair or trips
    if (s[0] === s[1] && s[2] === s[3]) {
      return (TWO_PAIR << 20) | (s[0] << 16) | (s[2] << 12) | (s[4] << 8);
    }
    if (s[1] === s[2] && s[3] === s[4]) {
      return (TWO_PAIR << 20) | (s[1] << 16) | (s[3] << 12) | (s[0] << 8);
    }
    if (s[0] === s[1] && s[3] === s[4]) {
      return (TWO_PAIR << 20) | (s[0] << 16) | (s[3] << 12) | (s[2] << 8);
    }
    // Trips
    if (s[0] === s[1] && s[1] === s[2]) {
      return (THREE_OF_A_KIND << 20) | (s[0] << 16) | (s[3] << 12) | (s[4] << 8);
    }
    if (s[1] === s[2] && s[2] === s[3]) {
      return (THREE_OF_A_KIND << 20) | (s[1] << 16) | (s[0] << 12) | (s[4] << 8);
    }
    return (THREE_OF_A_KIND << 20) | (s[2] << 16) | (s[0] << 12) | (s[1] << 8);
  }
  
  // numUnique === 2: Full house or quads
  if (s[0] === s[1] && s[1] === s[2] && s[2] === s[3]) {
    return (FOUR_OF_A_KIND << 20) | (s[0] << 16) | (s[4] << 12);
  }
  if (s[1] === s[2] && s[2] === s[3] && s[3] === s[4]) {
    return (FOUR_OF_A_KIND << 20) | (s[1] << 16) | (s[0] << 12);
  }
  // Full house
  if (s[0] === s[1] && s[1] === s[2]) {
    return (FULL_HOUSE << 20) | (s[0] << 16) | (s[3] << 12);
  }
  return (FULL_HOUSE << 20) | (s[2] << 16) | (s[0] << 12);
}

console.log('Generating lookup table for 2,598,960 hands...');

const TABLE_SIZE = 2598960;
const buffer = Buffer.alloc(TABLE_SIZE * 4); // 4 bytes per entry

let count = 0;
let lastPercent = -1;

// Iterate all C(52,5) combinations
for (let c0 = 0; c0 < 48; c0++) {
  for (let c1 = c0 + 1; c1 < 49; c1++) {
    for (let c2 = c1 + 1; c2 < 50; c2++) {
      for (let c3 = c2 + 1; c3 < 51; c3++) {
        for (let c4 = c3 + 1; c4 < 52; c4++) {
          const idx = getIndex(c0, c1, c2, c3, c4);
          const rank = eval5(c0, c1, c2, c3, c4);
          buffer.writeUInt32LE(rank, idx * 4);
          count++;
          
          const percent = Math.floor(count / TABLE_SIZE * 100);
          if (percent !== lastPercent) {
            process.stdout.write(`\r${percent}%`);
            lastPercent = percent;
          }
        }
      }
    }
  }
}

console.log(`\nGenerated ${count} entries`);

// Write to file
const outPath = path.join(__dirname, '..', 'client', 'public', 'hand-ranks.bin');
fs.writeFileSync(outPath, buffer);
console.log(`Wrote ${buffer.length} bytes to ${outPath}`);

// Also create a smaller test to verify correctness
console.log('\nVerifying a few hands:');
// Royal flush: Ah Kh Qh Jh Th = cards 50,49,48,47,46 (all hearts)
const royalIdx = getIndex(46, 47, 48, 49, 50);
console.log(`Royal flush index: ${royalIdx}, rank: ${buffer.readUInt32LE(royalIdx * 4).toString(16)}`);

// Pair of aces with K Q J: Ac Ad Kh Qh Jh = 48,49,44,40,36
const pairIdx = getIndex(36, 40, 44, 48, 49);
console.log(`Pair of aces index: ${pairIdx}, rank: ${buffer.readUInt32LE(pairIdx * 4).toString(16)}`);
