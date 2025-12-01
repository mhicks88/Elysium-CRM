// apps/api/src/modules/audit/store.ts

import crypto from "crypto";

export type AuditEventType =
  | "LEAD_CREATED"
  | "LEAD_UPDATED"
  | "COMPLIANCE_CHECK"
  | "OTHER";

export interface AuditEvent {
  id: string;
  userId: string | null;
  leadId: string | null;
  eventType: AuditEventType;
  eventData: Record<string, unknown>;
  createdAt: Date;
}

// In-memory store for now. Swap to DB later.
const auditEvents: AuditEvent[] = [];

export function addAuditEvent(event: Omit<AuditEvent, "id" | "createdAt">) {
  const record: AuditEvent = {
    id: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex"),
    createdAt: new Date(),
    ...event,
  };

  auditEvents.push(record);
  return record;
}

export function getAuditEventsByLead(leadId: string): AuditEvent[] {
  return auditEvents
    .filter((e) => e.leadId === leadId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

