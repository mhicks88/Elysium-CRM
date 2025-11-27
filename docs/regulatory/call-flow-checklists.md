# Call Flow Checklists (Skeleton)

## Pre-call checklist
- Run `/api/compliance/pre-call-check` for the lead and intended call purpose.
- Confirm permission to contact and absence of DNC status.
- Verify active Scope of Appointment for marketing/enrollment calls.

## In-call checklist
- Deliver required scripts and disclosures; record via `/api/compliance/calls/:callId/disclosures`.
- Track call events and compliance state transitions on the CallSession.

## Post-call checklist
- Record enrollment (if applicable) via `/api/leads/:leadId/enrollments`.
- Initiate outbound enrollment verification `/api/enrollments/:id/verifications`.
- Ensure AuditEvent entries exist for major actions.
