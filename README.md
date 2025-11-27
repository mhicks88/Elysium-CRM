# Elysium-CRM

Elysium-CRM is a compliance-first CRM for Medicare and health insurance call centers. It is dialer-agnostic, focused on Medicare Communications and Marketing Guidelines alignment, and built as a TypeScript monorepo spanning API, web, and shared packages.

## Tech stack
- Node.js 20+, Express, PostgreSQL, Prisma
- React 18 + Vite
- TypeScript in strict mode
- Dockerized services with docker-compose

## Repository layout
- `apps/api` – Express API, Prisma schema, compliance services
- `apps/web` – React frontend
- `packages/shared-types` – shared enums and DTOs
- `packages/shared-utils` – shared helpers
- `infra` – docker-compose stack
- `docs` – architecture, domain model, roadmap, onboarding, regulatory mapping

## Getting started (developer quickstart)
1. Install Node.js 20+ and npm.
2. Run `npm install` at the repo root to install workspace dependencies.
3. Copy `.env.example` to `.env` and fill values.
4. Start Postgres (see manual steps below for docker-compose).
5. Generate Prisma client and run migrations: `npx prisma generate` and `npx prisma migrate dev --name init` from `apps/api`.
6. Seed demo data: `npx prisma db seed` from `apps/api`.
7. Run API dev server: `npm run dev --workspace apps/api`.
8. Run web dev server: `npm run dev --workspace apps/web`.

## Seed credentials
The seed script creates a demo organization with users:
- Admin: `admin@example.com` / `Password123!`
- Agent: `agent@example.com` / `Password123!`

## Manual steps (must be done by a human)
- Clone the repository: `git clone https://github.com/mhicks88/Elysium-CRM.git && cd Elysium-CRM`.
- Install dependencies: `npm install` at the repository root.
- Create `.env` from `.env.example` and set `DATABASE_URL`, `JWT_SECRET`, and dialer secrets.
- Start Postgres (via local install or `docker compose up db` from `infra`).
- From `apps/api`, run:
  - `npx prisma generate`
  - `npx prisma migrate dev --name init`
  - `npx prisma db seed`
- Start dev servers:
  - API: `npm run dev --workspace apps/api`
  - Web: `npm run dev --workspace apps/web`
- Build and run Docker stack from repo root:
  - `docker compose -f infra/docker-compose.yml build`
  - `docker compose -f infra/docker-compose.yml up`
- Configure dialer webhooks with your vendor:
  - Set webhook target to `https://<api-host>/api/dialer/webhook?integrationId=<id>`
  - Use the `DIALER_WEBHOOK_SECRET` defined in `.env`
  - Send call lifecycle events (start, ringing, connected, disconnected, recording URL)
- Populate compliance scripts and disclosures with CMS/carrier-approved language (placeholder text is provided; ensure legal review before production use).

## License
MIT
