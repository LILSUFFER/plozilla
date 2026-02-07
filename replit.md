# Plozilla - 5-Card Omaha Equity Calculator

## Overview

Plozilla is a browser-based 5-Card Omaha equity calculator, similar to ProPokerTools Oracle, designed to provide accurate poker equity calculations. It supports various poker states (preflop, flop, turn, river), multiple player hands using concatenated card notation, and performs exhaustive equity calculations with precise Omaha hand evaluation (exactly 2 hole cards + 3 board cards). Built as a client-side React TypeScript application, Plozilla aims to offer a robust and user-friendly tool for poker enthusiasts, leveraging a high-performance native Rust engine for hand rankings.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack React Query for server state, React useState for local state
- **Styling**: Tailwind CSS with CSS variables (dark/light mode support)
- **UI Components**: shadcn/ui built on Radix UI primitives
- **Build Tool**: Vite

### Backend Architecture
- **Framework**: Express 5 with TypeScript
- **Runtime**: Node.js with tsx
- **API Pattern**: RESTful API (`/api` prefix)
- **Static Serving**: Express static middleware for React app

### Core Domain Logic
- **Native Rust Engine**: `engine-rust/` provides a high-performance PLO5 ranking engine (`plo5_ranker`) for precomputing and calculating equity, utilizing a Two Plus Two lookup table. This engine supports various commands for precomputation, equity calculation, accuracy validation, and range analysis. It uses a custom binary format for storing hand data and employs a deterministic Common Random Numbers (CRN) mode for stable, reproducible rankings.
- **WASM Evaluator**: AssemblyScript poker hand evaluator (`assembly/index.ts`) compiled to WebAssembly for Monte Carlo simulations.
- **WASM Integration**: Manages loading and providing JavaScript fallback for the WASM module.
- **Poker Evaluator**: JavaScript implementation for hand evaluation (fallback).
- **Equity Calculator**: Handles equity/win probability calculations.
- **Category Classification System**: Classifies hands into structural categories (pair types, suited types, rundown types) for improved search and filtering.
- **Rankings Search**: Implements ProPokerTools syntax for advanced hand range searching, including exclusions, suit filters, rank macros, and percentile filtering.
- **Hand History Import**: Parses hand histories from the clipboard, extracting hero hands, showdown hands, and board cards for analysis at different streets.
- **Table EV Analyzer**: Calculates expected value based on table composition (player types, positions, VPIP).
- **Board Validation**: Ensures only valid poker states (0, 3, 4, or 5 cards) are used for calculations.
- **Range Equity Calculations**: Utilizes Monte Carlo sampling for efficient, unbiased hand generation.
- **IndexedDB Caching**: Caches 2-player preflop results with suit canonicalization for instant lookups.
- **Two Plus Two Lookup Table**: 10MB precomputed hand ranks for O(1) evaluation.

### Data Storage
- **ORM**: Drizzle ORM for PostgreSQL.
- **Schema**: Defined in `shared/schema.ts` (currently basic users table).
- **Storage Pattern**: Repository pattern with `IStorage` interface, with an in-memory implementation (`MemStorage`) as default.

### Build System
- **Client Build**: Vite bundles React app to `dist/public`.
- **Server Build**: esbuild bundles server code to `dist/index.cjs`.
- **Development**: Hot module replacement via Vite dev server proxied through Express.

### Project Structure
- `assembly/`: AssemblyScript source for WASM.
- `client/`: React frontend with components, core logic, and pages.
- `server/`: Express backend.
- `shared/`: Shared types and schema.
- `engine-rust/`: Native Rust ranking engine.

## External Dependencies

### Database
- **PostgreSQL**
- **Drizzle Kit** (for migrations)

### UI Component Libraries
- **Radix UI**
- **shadcn/ui**

### Key NPM Packages
- **@tanstack/react-query**
- **drizzle-orm** / **drizzle-zod**
- **class-variance-authority**
- **lucide-react**
- **wouter**
- **passport-google-oauth20** (for Google OAuth)

### Development Tools
- **Vite**
- **tsx**
- **esbuild**