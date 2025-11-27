# Compliance Mapping (Skeleton)

## Beneficiary Contact & Permission to Contact
- Entities: Lead, LeadContactPreferenceChange, PreCallCheck
- Endpoints: `/api/compliance/pre-call-check`, `/api/leads`, `/api/leads/:id`

## Scope of Appointment
- Entities: ScopeOfAppointment, CallSession, AuditEvent
- Endpoints: `/api/compliance/soa`, `/api/calls/:id`

## Call Scripts & Disclosures
- Entities: Script, ScriptStep, DeliveredDisclosure
- Endpoints: `/api/compliance/scripts`, `/api/compliance/calls/:callId/disclosures`

## Outbound Enrollment Verification
- Entities: Enrollment, EnrollmentVerification
- Endpoints: `/api/leads/:leadId/enrollments`, `/api/enrollments/:id/verifications`

## Agent/Broker Oversight & Audit Log
- Entities: User, AuditEvent
- Endpoints: `/api/admin/users`, `/api/audit`
