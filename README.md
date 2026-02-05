# Poker Hand Evaluator

A browser-based 5-card poker hand evaluator with exact mathematical rankings matching ProPokerTools Oracle behavior.

## Features

- **Exact Hand Evaluation**: Pure JavaScript evaluator with no Monte Carlo simulation
- **Complete Rankings**: Correctly ranks all 2,598,960 possible 5-card hands
- **Hand Comparison**: Compare any two hands to determine the winner
- **Multiple Input Methods**: Visual card picker or text notation (e.g., "Ah Ks Qd Jc Tc")
- **Random Hand Generator**: Generate random hands for testing
- **Dark/Light Mode**: Toggle between themes
- **Mobile Responsive**: Works on all device sizes

## Hand Rankings

From best to worst:

| Rank | Hand | Count | Probability |
|------|------|-------|-------------|
| 1 | Royal Flush | 4 | 0.000154% |
| 2 | Straight Flush | 36 | 0.00139% |
| 3 | Four of a Kind | 624 | 0.0240% |
| 4 | Full House | 3,744 | 0.1441% |
| 5 | Flush | 5,108 | 0.1965% |
| 6 | Straight | 10,200 | 0.3925% |
| 7 | Three of a Kind | 54,912 | 2.1128% |
| 8 | Two Pair | 123,552 | 4.7539% |
| 9 | One Pair | 1,098,240 | 42.2569% |
| 10 | High Card | 1,302,540 | 50.1177% |

**Total: 2,598,960 hands** (52 choose 5)

## Mathematical Accuracy

This evaluator uses exact combinatorial mathematics:

### Hand Evaluation Algorithm

1. **Category Detection**: Identify the hand category (Royal Flush, Straight Flush, etc.)
2. **Kicker Analysis**: Extract relevant kicker cards for tiebreaking
3. **Rank Calculation**: Compute exact rank among all 2,598,960 hands
4. **Percentile**: Calculate what percentage of hands this hand beats

### Ranking Logic

Within each category, hands are ranked by:

- **Straights/Flushes**: High card determines rank (Ace-high beats King-high)
- **Four of a Kind**: Quad rank, then kicker
- **Full House**: Trips rank, then pair rank
- **Flush**: Lexicographic comparison of all 5 cards
- **Three of a Kind**: Trips rank, then kickers
- **Two Pair**: High pair, low pair, then kicker
- **One Pair**: Pair rank, then kickers
- **High Card**: Lexicographic comparison of all 5 cards

### Special Cases

- **Wheel Straight (A-2-3-4-5)**: Ace plays low, ranks below 6-high straight
- **Ace-High Straight (A-K-Q-J-T)**: Ace plays high, highest straight

## Card Notation

- **Ranks**: 2, 3, 4, 5, 6, 7, 8, 9, T (10), J, Q, K, A
- **Suits**: c (clubs ♣), d (diamonds ♦), h (hearts ♥), s (spades ♠)

Examples:
- `Ah` = Ace of Hearts
- `Tc` = Ten of Clubs
- `Ks` = King of Spades

## Tech Stack

- **Frontend**: React + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Build**: Vite
- **Poker Logic**: Pure JavaScript (no external libraries)

## Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5000`

## API

The poker evaluator is available as a pure JavaScript module:

```typescript
import { 
  parseHand, 
  evaluateHand, 
  compareHands, 
  generateRandomHand 
} from '@/lib/poker-evaluator';

// Parse a hand from text
const hand = parseHand('Ah Ks Qd Jc Tc');

// Evaluate the hand
const result = evaluateHand(hand);
console.log(result.category);    // "Straight"
console.log(result.handRank);    // Exact rank (1 = best)
console.log(result.percentile);  // Percentage of hands beaten

// Compare two hands
const comparison = compareHands(hand1, hand2);
// Returns: positive if hand1 wins, negative if hand2 wins, 0 if tie

// Generate random hand
const randomHand = generateRandomHand();
```

## License

MIT
