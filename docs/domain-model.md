# Domain Model

## Core entities
- **Organization**: owns users, leads, integrations, scripts, calls, and audits.
- **User**: members of an organization with roles (ADMIN, MANAGER, AGENT, COMPLIANCE, READ_ONLY).
- **Lead**: beneficiary record with permission flags, contact details, and assigned agent.
- **LeadContactPreferenceChange**: history of permission updates.
- **Task**: work items tied to a lead.
- **Note**: append-only notes linked to leads and authors.

## Dialer and calls
- **DialerIntegration**: configuration for a generic HTTP dialer.
- **CallSession**: lifecycle of a call with compliance state tracking.
- **CallEvent**: dialer or system events tied to a call.

## Compliance
- **PreCallCheck**: recorded evaluations for permission to contact and related rules.
- **ScopeOfAppointment**: captures SOA status, method, and expiration.
- **Script** and **ScriptStep**: define disclosures and required steps.
- **DeliveredDisclosure**: records completion of script steps during a call.

## Enrollment
- **Enrollment**: plan selection tied to a lead and optionally a call.
- **EnrollmentVerification**: outcome tracking for outbound enrollment verification.

## Audit
- **AuditEvent**: immutable log of domain actions keyed by entity and actor.

## Relationships overview
- Organization has many Users, Leads, Tasks, Notes, CallSessions, Scripts, Enrollments, and AuditEvents.
- Leads link to Users (assignee), Tasks, Notes, CallSessions, SOAs, and Enrollments.
- CallSessions connect Leads, Agents, DialerIntegration, PreCallChecks, Disclosures, and Enrollment.
- Scripts contain ScriptSteps; DeliveredDisclosures join scripts, steps, calls, leads, and agents.
