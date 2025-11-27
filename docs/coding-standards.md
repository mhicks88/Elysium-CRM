# Coding Standards

## TypeScript
- Use strict typing; avoid `any`.
- Favor small, composable functions with clear domain names.
- Keep imports relative within a module and avoid deep barrel imports when unclear.

## Naming
- Use descriptive names aligned to Medicare compliance concepts (e.g., `preCallCheck`, `scopeOfAppointment`).
- Enums are `SCREAMING_SNAKE_CASE` values; interfaces and types are `PascalCase`.

## Error handling
- Return structured JSON errors: `{ error: { code, message, details? } }`.
- Avoid leaking sensitive details in messages.

## Logging
- Emit JSON logs (one line per event) with level, message, and relevant metadata.

## Adding a new module
1. Define Prisma models in `apps/api/prisma/schema.prisma`.
2. Generate client and run migrations.
3. Add DTOs and enums to `packages/shared-types` if shared.
4. Implement services and routes under `apps/api/src/modules/<module>`.
5. Add frontend routes and components in `apps/web/src/routes` and `apps/web/src/components`.
6. Document behavior in `docs/architecture.md` or a module-specific doc.
