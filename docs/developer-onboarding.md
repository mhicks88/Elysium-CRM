# Developer Onboarding

Welcome to Elysium-CRM. This guide outlines how to set up the project for local development.

## Prerequisites
- Node.js 20+
- npm
- Docker (for running the full stack locally)

## Install dependencies
- Run `npm install` at the repository root to install workspace dependencies.

## Environment configuration
- Copy `.env.example` to `.env` at the repo root and fill in values for `DATABASE_URL`, `JWT_SECRET`, and dialer secrets.

## Database and Prisma
From `apps/api`:
- Generate client: `npx prisma generate`
- Run migrations: `npx prisma migrate dev --name init`
- Seed data: `npx prisma db seed`

## Running the stack (development)
- API: `npm run dev --workspace apps/api`
- Web: `npm run dev --workspace apps/web`

## Running with Docker
From repo root:
- Build images: `docker compose -f infra/docker-compose.yml build`
- Start services: `docker compose -f infra/docker-compose.yml up`

## Tests
- Placeholder: `npm test` (tests will be added incrementally in Phase 1)

## Manual steps required
- Clone the repository and change directories: `git clone https://github.com/mhicks88/Elysium-CRM.git && cd Elysium-CRM`
- Create and populate `.env` from `.env.example`.
- Start Postgres (local install or `docker compose -f infra/docker-compose.yml up db`).
- Run Prisma commands from `apps/api`:
  - `npx prisma generate`
  - `npx prisma migrate dev --name init`
  - `npx prisma db seed`
- Install dependencies at the repo root: `npm install`.
- Start dev servers:
  - `npm run dev --workspace apps/api`
  - `npm run dev --workspace apps/web`
- Build and run Docker stack: `docker compose -f infra/docker-compose.yml build && docker compose -f infra/docker-compose.yml up`
- Configure dialer webhook at your vendor: target `https://<api-host>/api/dialer/webhook?integrationId=<id>` with secret `DIALER_WEBHOOK_SECRET`.
- Replace placeholder compliance script text with CMS/carrier-approved language after legal review.
