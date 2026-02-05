# Poker Hand Evaluator

## Overview

A browser-based 5-card poker hand evaluator that provides exact mathematical rankings for all 2,598,960 possible poker hands. The application allows users to evaluate individual hands, compare hands against each other, and calculate equity between multiple players. Built as a full-stack TypeScript application with a React frontend and Express backend.

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
- **Poker Evaluator** (`client/src/lib/poker-evaluator.ts`): Pure JavaScript implementation for hand evaluation with no Monte Carlo simulation - uses exact combinatorial mathematics
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
├── client/           # React frontend
│   └── src/
│       ├── components/   # UI components (PlayingCard, HandDisplay, etc.)
│       ├── lib/          # Core logic (poker-evaluator, equity-calculator)
│       └── pages/        # Route components
├── server/           # Express backend
├── shared/           # Shared types and schema
└── script/           # Build scripts
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