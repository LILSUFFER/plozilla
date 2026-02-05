# Poker Tools - 5-Card Omaha Equity Calculator

A browser-based poker equity calculator for 5-card Omaha Hi with exact mathematical evaluation.

## Features

- **5-Card Omaha Equity Calculator**: Calculate equity percentages for multiple players
- **Exhaustive Calculation**: Enumerates all possible remaining board cards
- **Multiple Input Formats**: Concatenated (6sKh7hKdAc) or spaced (6s Kh 7h Kd Ac)
- **Hand Evaluator**: Evaluate single 5-card poker hands
- **Hand Comparison**: Compare two hands head-to-head
- **Dark/Light Mode**: Toggle between themes
- **Mobile Responsive**: Works on all device sizes

## 5-Card Omaha Rules

In 5-card Omaha:
- Each player receives **5 hole cards**
- Must use **exactly 2** hole cards
- Must use **exactly 3** board cards
- Makes the best possible 5-card poker hand

## Usage

### Equity Calculator

1. Enter board cards (0-5): `Th5d7c` 
2. Enter player hands (2+ cards each): `6sKh7hKdAc`
3. Click "Calculate Equity"
4. View results with win/tie percentages

### Card Notation

- **Ranks**: 2-9, T (10), J, Q, K, A
- **Suits**: c (clubs), d (diamonds), h (hearts), s (spades)

Examples:
- `6sKh7hKdAc` = 6♠ K♥ 7♥ K♦ A♣
- `Th5d7c` = 10♥ 5♦ 7♣
- `10h5d7c` = Same as above (10 notation supported)

## Hand Rankings

| Rank | Hand | Count |
|------|------|-------|
| 1 | Royal Flush | 4 |
| 2 | Straight Flush | 36 |
| 3 | Four of a Kind | 624 |
| 4 | Full House | 3,744 |
| 5 | Flush | 5,108 |
| 6 | Straight | 10,200 |
| 7 | Three of a Kind | 54,912 |
| 8 | Two Pair | 123,552 |
| 9 | One Pair | 1,098,240 |
| 10 | High Card | 1,302,540 |

**Total: 2,598,960 possible 5-card hands**

## Tech Stack

- **Frontend**: React + TypeScript + Tailwind CSS
- **UI Components**: shadcn/ui
- **Build**: Vite
- **Poker Logic**: Pure JavaScript (no external libraries)

## Setup

```bash
npm install
npm run dev
```

The app runs at `http://localhost:5000`

## Equity Calculation

The calculator uses exhaustive enumeration:
1. Given player hands and partial board
2. Enumerate all possible remaining board cards
3. For each complete board, evaluate each player's best Omaha hand
4. Count wins, ties, and calculate equity percentages

Equity = (Wins + Ties/2) / Total Trials × 100%

## License

MIT
