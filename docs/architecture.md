# Architecture Overview

Elysium-CRM is a TypeScript monorepo with clear separation between API, web, and shared packages. The backend is an Express application using Prisma with PostgreSQL. The frontend is a React 18 + Vite SPA. Docker and docker-compose orchestrate API, web, and database services.

## Monorepo layout
- `apps/api`: Express server, Prisma ORM, compliance and dialer modules
- `apps/web`: React SPA using React Router
- `packages/shared-types`: Shared enums and DTOs
- `packages/shared-utils`: Common helpers
- `infra`: docker-compose stack
- `docs`: architecture, domain model, roadmap, onboarding, and regulatory mapping

## Backend modules (high level)
- Auth module for JWT login and role enforcement
- Leads module with tasks and notes
- Dialer module with adapter pattern for generic HTTP dialers
- Calls module capturing call sessions and events
- Compliance module with pre-call checks, SOA, scripts, and disclosures
- Enrollment module with verification tracking
- Audit module for event logging

## Frontend routes
- `/login` authentication screen
- `/` dashboard
- `/leads` and `/leads/:id`
- `/calls` and `/calls/:id`
- `/tasks`
- `/compliance`
- `/admin`

## Dialer adapter pattern
Adapters encapsulate vendor-specific behavior. The initial `GenericHttpDialerAdapter` is driven by integration settings (endpoints, webhook secrets, payload paths). Routes use the adapter to initiate outbound calls and process webhooks without baking vendor logic into domain code.

## How to extend
- Add new domain modules by creating Prisma models, service layer logic, API routes, and front-end screens.
- Introduce additional dialer vendors by implementing new adapters that satisfy the dialer interface.
- Expand compliance rules by adding new pre-call checks and updating compliance state transitions.
