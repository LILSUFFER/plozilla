# Poker Tools - 5-Card Omaha Equity Calculator

## Overview

A browser-based 5-Card Omaha equity calculator similar to ProPokerTools Oracle. The calculator supports board input (0-5 cards), multiple player hands (5 cards each), concatenated card notation (e.g., "7s6hJdQc8c"), and performs exhaustive equity calculations with accurate Omaha hand evaluation (exactly 2 hole cards + 3 board cards). Built as a client-side React TypeScript application.

## Recent Changes (Feb 2026)
- Implemented WebAssembly (AssemblyScript) poker hand evaluator for improved performance
- Dynamic trial selection like ProPokerTools Oracle:
  - Turn/River: Exhaustive enumeration of all runouts (exact results, ~7ms)
  - Flop/Preflop: Monte Carlo sampling with up to 100k trials (~2-3s)
- WASM module with compact lookup tables for flush/straight detection
- Results accurate within 0.5% of ProPokerTools Oracle
- UI shows "runouts (exact)" for exhaustive, "trials" for Monte Carlo
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