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

We use Prisma with SQLite for local development. The default `DATABASE_URL` in `.env` points at `./dev.db`.

Update the database schema and generate the Prisma client:

```bash
npm run prisma:push
```

### Development server

```bash
npm run dev
```

Visit `http://localhost:3000` to access the app.

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

## Next Steps

Refer to `notes/pr-plan.txt` for the prioritized PR roadmap, including upcoming work on realtime updates, offer/claim flows, and PDF exports.
