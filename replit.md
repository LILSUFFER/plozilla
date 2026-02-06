# Plozilla - 5-Card Omaha Equity Calculator

## Overview

A browser-based 5-Card Omaha equity calculator similar to ProPokerTools Oracle. The calculator supports board input in valid poker states (Preflop: 0, Flop: 3, Turn: 4, River: 5 cards), multiple player hands (5 cards each), concatenated card notation (e.g., "7s6hJdQc8c"), and performs exhaustive equity calculations with accurate Omaha hand evaluation (exactly 2 hole cards + 3 board cards). Built as a client-side React TypeScript application.

## Recent Changes (Feb 2026)
- **Canonical Hand Rankings v4 — Offline/Online Separation** (Feb 2026): ProPokerTools-style ranking with suit canonicalization
  - Strict offline/online architecture: ZERO equity calculations at runtime
  - **Offline precompute**: `scripts/precompute_canonical_rankings_v4.ts` (run via `npm run precompute:rankings`)
    - Enumerates 134,459 canonical hands (suit canonicalization: 24 suit permutations, pick lex-smallest)
    - 10,000 Monte Carlo trials per canonical hand using WASM evaluator
    - Outputs `public/plo5_rankings_v4.json.gz` (static deployable file)
    - Each record: hand_key, card0-4, combo_count, equity, rank, percentile
  - **Runtime server**: pure file-based lookup only (`server/rankings-cache.ts`)
    - Loads from `public/plo5_rankings_v4.json.gz` on startup
    - Zero simulation/calculation code in server — `calculationCalls` always 0
    - If file missing, returns clear error ("Run: npm run precompute:rankings"), never seeds
  - API: `/api/rankings` (paginated with search), `/api/rankings/status`, `/api/rankings/lookup`
  - Frontend shows 134K canonical hands with combo count column
  - Each canonical hand shows: rank, cards (canonical suits), combos (4-24), equity %, percentile
- **Rankings Search with ProPokerTools Syntax**: Full range syntax for search
  - Parser in `client/src/lib/rankings-search.ts`
  - Supports: exclusions (!), ascending/descending ranges (+/-), comma-separated OR, suit filters (ds/ss/$ds/$ss), rank macros ($B, $M, $Z, etc.), $np (no pairs), brackets ([A-K]), percentile filtering
  - Examples: AA, AA!KK, KK+, TT+ds, AA,KK, 20%, 5%-10%
- **EN/RU Bilingual Support**: Full internationalization with language switching
  - React Context-based i18n system (`client/src/lib/i18n.tsx`)
  - `useTranslation` hook for all components, `I18nProvider` wraps entire app
  - LanguageToggle component in all page headers (shows "RU" when English, "EN" when Russian)
  - localStorage persistence of language preference (`plozilla-lang`)
  - All pages fully translated: Landing, AppPage, TableEvPage, LearnPage
  - All components translated: EquityCalculator, TableEvAnalyzer (including info dialog)
  - Translation keys use template `{n}` placeholders replaced with `.replace('{n}', value)`
- **SaaS Architecture**: Restructured as authenticated web application
  - Landing page at / (public) with GTOWizard-style design
  - Equity calculator at /app (requires authentication)
  - Table EV Analyzer at /app (Table EV tab) - calculates expected value based on table composition
  - Google OAuth integration (passport-google-oauth20)
  - PostgreSQL session storage with user profiles
  - User avatar and logout functionality in app header
  - Configured for plozilla.com domain
- **Table EV Analyzer**: Calculate EV based on fish at table
  - 6-max table visualization with clickable seats
  - Player types: Hero, Reg, Fish, Empty
  - Position coefficients (BTN 1.5x, CO 1.1x, etc.)
  - VPIP sliders for fish players
  - Formula: (fishLoss - tableRake) / N_regs * positionCoef - heroRake
- **Board Validation**: Only valid poker states allowed (0, 3, 4, or 5 cards)
  - Preflop: 0 cards, Flop: 3 cards, Turn: 4 cards, River: 5 cards
  - Invalid states (1-2 cards) show error message and disable calculation
  - Label shows valid options: "(Preflop: 0 | Flop: 3 | Turn: 4 | River: 5)"
- **Range Equity Calculations**: Monte Carlo with 600,000 target samples
  - Direct weighted sampling for efficient hand generation
  - Independent sampling with conflict rejection for unbiased joint distribution
  - ~100 seconds for AA vs JJ preflop (3.6x faster than previous version)
  - Expected accuracy: within ~0.8% of ProPokerTools Oracle reference values
  - Progress bar shows real-time calculation percentage
- **Hand History Import**: Paste hand histories from clipboard with street selection
  - Parser supports PLO-5 formats with space-separated or concatenated cards
  - Extracts hero hand, showdown hands, and board cards at each street
  - Street selection dialog to choose preflop/flop/turn/river for analysis
  - Handles "Dealt to Hero [cards]", "shows [cards]", and board markers
- **Full ProPokerTools Range Syntax Support**: Complete Generic Syntax implementation
  - **Hand counting**: AA = 108,336 hands (all 5-card hands with at least 2 aces)
  - **Suit variables**: x, y, z, w for suited patterns (AxAyxy = double-suited aces)
  - **Rank variables**: R, O, N for patterns (RRON = one pair hand)
  - **Wildcards**: * for any card
  - **Combining**: comma (OR), colon (AND), bang (NOT) operators
  - **Rank spans**: KQJT-T987, KK+, T8+, 664-
  - **Rank brackets**: [A-J], [2,3,4], [A,2,3,4,5]
  - **No-pair constraint**: curly braces {AKQJ} for unpaired cards
  - **Built-in macros**: $ds (double-suited), $ss (single-suited), $np (no pairs), $B (big), $M (middle), $Z (small), $L (low), $W (wheel), $R (broadway), $F (face), $0g/$1g/$2g (gap rundowns)
  - **Weighted ranges**: AA@10, KK@8 for frequency weighting
  - **Percent ranges**: 15%, 5%-10% (approximate counts)
  - Uses Monte Carlo sampling for range calculations
  - UI shows "X combos" badge for ranges
- **IndexedDB Caching with Suit Canonicalization**: 2-player preflop results are cached
  - First calculation: ~4-5s for 850,668 runouts
  - Cached lookups: ~10-15ms (instant)
  - Suit canonicalization: hands like AsKs vs 2c3c share cache with AhKh vs 2d3d
  - UI shows green "Cached" badge for cached results
- **Two Plus Two Lookup Table**: 10MB precomputed hand ranks for O(1) evaluation
- WebAssembly (AssemblyScript) poker hand evaluator
- Exhaustive enumeration for specific hands (like ProPokerTools Oracle):
  - Preflop (no board): 850,668 runouts
  - Flop: ~741 runouts in ~6ms
  - Turn/River: few dozen runouts in <1ms
- WASM optimizations:
  - Correct Bose-Nelson 5-element sorting network for combinatorial indexing
  - Global static arrays to avoid allocations in hot loops
  - @inline decorators on critical functions
- **Fixed WASM sorting network bug** (Feb 2026): The getIdx function's sorting network was incorrect (11 comparisons, produced unsorted output for certain inputs). Replaced with correct Bose-Nelson network (9 comparisons). This was causing wrong equity calculations for specific hands.
- Results match ProPokerTools Oracle exactly (52.128% vs 52.128%)
- UI shows "X runouts (exact)" for all calculations
- Added visible timing display showing calculation time
- Fixed parseCardsConcat to correctly handle "10" notation (10h = Ten of hearts)
- Improved player hand validation (2-5 cards per player)

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state, React useState for local state
- **Styling**: Tailwind CSS with CSS variables for theming (dark/light mode support)
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Framework**: Express 5 with TypeScript
- **Runtime**: Node.js with tsx for TypeScript execution
- **API Pattern**: RESTful API with `/api` prefix for all endpoints
- **Static Serving**: Express static middleware serves the built React app in production

### Core Domain Logic
- **WASM Evaluator** (`assembly/index.ts`): AssemblyScript poker hand evaluator compiled to WebAssembly, handles full Monte Carlo simulation
- **WASM Integration** (`client/src/lib/wasm-equity.ts`, `client/src/lib/wasm-loader.ts`): Loads WASM module and provides JavaScript fallback
- **Poker Evaluator** (`client/src/lib/poker-evaluator.ts`): JavaScript implementation for hand evaluation (used as fallback)
- **Equity Calculator** (`client/src/lib/equity-calculator.ts`): Calculates equity/win probability between multiple player hands

### Data Storage
- **ORM**: Drizzle ORM configured for PostgreSQL
- **Schema**: Located in `shared/schema.ts` - currently contains a basic users table
- **Storage Pattern**: Repository pattern with `IStorage` interface in `server/storage.ts`, with in-memory implementation (`MemStorage`) as default

### Build System
- **Client Build**: Vite bundles React app to `dist/public`
- **Server Build**: esbuild bundles server code to `dist/index.cjs`
- **Development**: Hot module replacement via Vite dev server proxied through Express

### Project Structure
```
├── assembly/         # AssemblyScript source for WASM
│   └── index.ts      # Hand evaluator and Monte Carlo loop
├── client/           # React frontend
│   ├── public/
│   │   └── evaluator.wasm  # Compiled WASM module (8.7KB)
│   └── src/
│       ├── components/   # UI components (PlayingCard, EquityCalculator, etc.)
│       ├── lib/          # Core logic (wasm-equity, poker-evaluator)
│       └── pages/        # Route components
├── server/           # Express backend
├── shared/           # Shared types and schema
└── asconfig.json     # AssemblyScript compiler config
```

## External Dependencies

### Database
- **PostgreSQL**: Configured via `DATABASE_URL` environment variable
- **Drizzle Kit**: Database migrations stored in `/migrations`

### UI Component Libraries
- **Radix UI**: Headless UI primitives (dialog, popover, tabs, etc.)
- **shadcn/ui**: Pre-built component styles on top of Radix

### Key NPM Packages
- **@tanstack/react-query**: Data fetching and caching
- **drizzle-orm** / **drizzle-zod**: Database ORM with Zod schema validation
- **class-variance-authority**: Component variant styling
- **lucide-react**: Icon library
- **wouter**: Lightweight routing

### Development Tools
- **Vite**: Frontend build tool with HMR
- **tsx**: TypeScript execution for Node.js
- **esbuild**: Fast bundling for production server build