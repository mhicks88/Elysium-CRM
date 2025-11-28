# Leads module

The leads module provides authenticated access to list, view, and update leads while respecting organization scoping. It also wires the existing pre-call compliance check so agents can validate outreach readiness directly from a lead.

## API endpoints

All endpoints require authentication and restrict results to the caller's `organizationId` from the JWT context.

### `GET /api/leads`

Query parameters:
- `page` (number, optional, default `1`)
- `pageSize` (number, optional, default `25`, capped at `100`)
- `search` (string, optional; partial match on first name, last name, email, or phone)
- `status` (`LeadStatus` or `ALL`)

Response: `LeadListResponseDto` containing paged `LeadListItemDto` items.

### `GET /api/leads/:id`

Fetch a single lead scoped to the caller's organization.

Response: `LeadDetailDto`.

### `PUT /api/leads/:id`

Accepts `UpdateLeadRequestDto` to edit key contact fields, permissions, assignee, and status (or toggle `doNotContact`). Returns the updated `LeadDetailDto`.

## DTOs

Defined in `packages/shared-types`:
- `LeadStatus`
- `LeadListItemDto`
- `LeadListResponseDto`
- `LeadDetailDto`
- `UpdateLeadRequestDto`

## Frontend structure

Pages under `apps/web/src/routes`:
- `/leads` lists leads with search, status filtering, and pagination.
- `/leads/:id` shows lead details, allows edits, and embeds the pre-call compliance panel.

Compliance integration: the detail page calls `/api/compliance/pre-call-check` via the shared `runPreCallCheck` helper, using the current lead ID and a selectable purpose.

## Running locally

```
npm install
cd apps/api
npx prisma generate
cd ../..
npm run dev
```

Login with `admin@example.com` / `Password123!` and navigate to:
- `/leads` to browse leads
- `/leads/:id` to edit a lead and run the embedded compliance check
