# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Note**: This project uses [bd (beads)](https://github.com/steveyegge/beads) for issue tracking. Use `bd` commands instead of markdown TODOs. See AGENTS.md for workflow details.

## Tech Stack

- **Framework:** Next.js 15.5 (App Router)
- **Language:** TypeScript 5
- **Database:** Prisma 6.17 (SQLite local, Postgres production)
- **Realtime:** Socket.IO 4.7
- **UI:** React 19, Tailwind CSS 3.4
- **Validation:** Zod
- **Testing:** Vitest, React Testing Library, Playwright

## Commands

```bash
# Development
npm run dev              # Custom server with Socket.IO (local realtime)
npm run dev:next         # Next.js only (matches Vercel runtime)

# Database (Prisma + SQLite locally, Postgres in prod)
npm run prisma:generate      # Generate SQLite client
npm run prisma:generate:prod # Generate Postgres client
npm run prisma:push          # Sync schema to local SQLite
npm run prisma:migrate:prod  # Deploy migrations to Postgres

# Testing
npm test                 # Run unit tests (Vitest)
npm run test:watch       # Watch mode
npm run test:e2e         # Playwright e2e tests (auto-starts dev server)

# Run a single test file
npx vitest run tests/unit/room-code.test.ts

# Build & Lint
npm run build            # Production build (uses Postgres schema)
npm run lint
```

## Architecture

**Gift Circle** is a Next.js 15 App Router application for collaborative gift exchanges. Users create/join rooms via access codes and coordinate offers (things to give) and desires (things wanted) in real time.

### Room Rounds Flow

Rooms progress through sequential phases: `WAITING` → `OFFERS` → `DESIRES` → `CONNECTIONS` → `DECISIONS`. The host advances rounds. Each phase gates specific actions (e.g., creating offers only in OFFERS round).

### Key Layers

- **API Routes** (`src/app/api/rooms/[code]/`): REST endpoints for room CRUD, offers, desires, claims, round advancement, PDF export
- **Realtime** (`src/server/realtime.ts`): Socket.IO server for presence tracking and live updates. Initialized by `server/index.ts` for local dev, or via `/api/socket` page route on Vercel
- **Room Context** (`src/app/rooms/[code]/room-context.tsx`): React context providing room state, socket connection, and optimistic updates to child pages
- **Prisma** (`src/lib/prisma.ts`): Database access. Two schemas exist: `prisma/schema.prisma` (SQLite/dev) and `prisma/schema.postgres.prisma` (production)

### Data Model

Core entities: `User`, `Room`, `RoomMembership`, `Offer`, `Desire`, `Claim`. A claim links a member to an offer or desire they want to fulfill. Claims have status workflow: `PENDING` → `ACCEPTED`/`DECLINED`/`WITHDRAWN`.

### Path Alias

`@/*` maps to `./src/*` (configured in tsconfig.json and vitest.config.ts)

### Testing

- Unit tests in `tests/unit/` use Vitest + React Testing Library
- E2E tests in `tests/e2e/` use Playwright
- Test setup: `tests/setup/vitest.setup.ts`

## Key Files

- `src/lib/room-types.ts` - Core TypeScript types shared across client/server
- `src/app/rooms/[code]/room-context.tsx` - Room state management and socket integration
- `src/server/realtime.ts` - Socket.IO server, presence tracking
- `src/lib/prisma.ts` - Database client singleton
- `server/index.ts` - Custom dev server entry point

## Architecture Decisions

- **Two Prisma schemas:** SQLite for fast local dev, Postgres for production. Always run `prisma:generate` (not `:prod`) locally.
- **Dual dev servers:** `npm run dev` uses custom server with integrated Socket.IO; `npm run dev:next` is pure Next.js matching Vercel runtime (no local realtime).
- **Round gating:** Business logic in `src/lib/room-*.ts` enforces which actions are allowed per round. API routes check these before mutations.
- **Optimistic updates:** Room context applies changes immediately, then reconciles with server responses.

## Off-Limits

- `prisma/migrations/` - Do not manually edit migration files
- `prisma/schema.postgres.prisma` - Keep in sync with `schema.prisma`; changes should be made to both
- `.env` files - Never commit; contains `DATABASE_URL` and `IDENTITY_SECRET`

## Current Progress

### Completed

- Realtime room roster with presence tracking
- Round progression system (WAITING → OFFERS → DESIRES → CONNECTIONS → DECISIONS)
- Offer/desire creation and management
- Claim workflow (create, accept, decline, withdraw)
- Connections round UI
- Decisions round with PDF export
- Vercel deployment with Postgres
