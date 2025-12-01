// apps/api/src/modules/audit/service.ts

import {
  addAuditEvent,
  getAuditEventsByLead,
  type AuditEvent,
  type AuditEventType,
} from "./store";

export { AuditEvent, AuditEventType };

export async function recordAuditEvent(params: {
  userId: string | null;
  leadId: string | null;
  eventType: AuditEventType;
  eventData?: Record<string, unknown>;
}): Promise<AuditEvent> {
  const { userId, leadId, eventType, eventData = {} } = params;
  return addAuditEvent({
    userId,
    leadId,
    eventType,
    eventData,
  });
}

export async function getAuditEventsForLead(
  leadId: string
): Promise<AuditEvent[]> {
  return getAuditEventsByLead(leadId);
}

