# Gift Circle

Gift Circle is a collaborative space for hosting and joining gift exchange circles. Hosts spin up rooms, share the access code, and participants join to coordinate offers and desires in real time.

## Getting Started

### Prerequisites

- Node.js 20+
- npm (ships with Node.js)

### Installation

```bash
npm install
```

### Database

We use Prisma with SQLite for local development (`DATABASE_URL="file:./dev.db"` in `.env`).  
Generate the local client and sync the schema before running the app:

```bash
npm run prisma:generate
npm run prisma:push
```

If you need to generate the Postgres client (used for production/Vercel) locally, run:

```bash
npm run prisma:generate:prod
```

### Development servers

- Custom Node + Socket.IO stack (mirrors legacy local experience):
  ```bash
  npm run dev
  ```
  This spins up `server/index.ts` and is handy when you need to debug the combined HTTP + Socket.IO runtime.

- Next.js dev server (matches the Vercel runtime):
  ```bash
  npm run dev:next
  ```
  Use this mode when you want parity with production hosting.

Both commands serve the app at `http://localhost:3000`.

### Production build

To test a production build locally:

```bash
npm run build
npm run start
```

`npm run build` automatically regenerates the Prisma client using the Postgres schema so the bundle matches production.

If you need the legacy combined server in production mode, use `npm run start:custom`.

### Linting

```bash
npm run lint
```

## Project Structure Highlights

- `src/app` – App Router routes and UI components
- `src/app/api` – Route handlers for server actions
- `src/lib` – Shared client/server utilities (e.g., Prisma client, room helpers)
- `prisma/schema.prisma` – Data model definitions
- `notes/` – Product requirements and planning docs

## Deployment Guide (Vercel)

1. **Create/Link the project**
   ```bash
   vercel login
   vercel link
   ```
2. **Provision a Postgres database** from the Vercel dashboard (Storage → Postgres) and copy the connection string.
3. **Configure environment variables** in the Vercel project:
   - `DATABASE_URL` – the Postgres URL from step 2
   - `IDENTITY_SECRET` – a long random string used for signing identity cookies
   - `NEXT_PUBLIC_APP_ORIGIN` – your production URL (e.g. `https://your-project.vercel.app`)
4. **Prime the production database schema** (locally) before deploying new models:
   ```bash
   DATABASE_URL="postgres://..." npm run prisma:migrate:prod
   ```
5. **Deploy**
   ```bash
   vercel --prod
   ```

After deployment, verify realtime updates by opening two browser tabs on the production site, joining the same room, and confirming that roster/offer changes sync instantly. PDF exports remain available during the Decisions round via `/api/rooms/[code]/export`.
