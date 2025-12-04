// apps/api/src/modules/audit/service.ts
//
// DB-backed audit event service using Prisma.
// This replaces the old in-memory store implementation.

import { prisma } from "../../db/client";

/**
 * AuditEventType
 *
 * We keep this as a string type so existing callers that
 * use arbitrary eventType strings (e.g. "COMPLIANCE_CHECK")
 * continue to work without type errors.
 *
 * You can later tighten this to a union if you want stronger typing.
 */
export type AuditEventType = string;

/**
 * Shape returned to callers / API.
 * Mirrors the Prisma AuditEvent model but flattens relations.
 */
export interface AuditEvent {
  id: string;
  organizationId: string;
  entityType: string;
  entityId: string;
  eventType: string;
  actorUserId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

/**
 * Record an audit event in the database.
 *
 * CURRENTLY: This is lead-centric and infers organizationId
 * from the lead. Existing callers that pass leadId + userId
 * continue to work.
 *
 * Later, you can add overloads/helpers for non-lead entities
 * (tasks, enrollments, etc.) if needed.
 *
 * IMPORTANT: This is best-effort. If the audit write fails
 * (e.g. foreign key issues with actorUserId), we log the error
 * and return a synthetic event instead of throwing, so we
 * never break the main request flow.
 */
export async function recordAuditEvent(params: {
  userId: string | null;
  leadId: string | null;
  eventType: AuditEventType;
  eventData?: Record<string, unknown>;
}): Promise<AuditEvent> {
  const { userId, leadId, eventType, eventData = {} } = params;

  if (!leadId) {
    // For now we only support lead-centric audit events in this service.
    throw new Error(
      "recordAuditEvent currently requires a leadId (entityType=LEAD)"
    );
  }

  // Look up the lead to find its organization
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      organizationId: true,
    },
  });

  if (!lead) {
    throw new Error(`Lead not found for audit event (leadId=${leadId})`);
  }

  try {
    const created = await prisma.auditEvent.create({
      data: {
        organizationId: lead.organizationId,
        entityType: "LEAD",
        entityId: lead.id,
        eventType,
        actorUserId: userId,
        metadata: eventData as any,
      },
    });

    return {
      id: created.id,
      organizationId: created.organizationId,
      entityType: created.entityType,
      entityId: created.entityId,
      eventType: created.eventType,
      actorUserId: created.actorUserId,
      metadata: (created.metadata ?? {}) as Record<string, unknown>,
      createdAt: created.createdAt,
    };
  } catch (err: any) {
    // Best-effort audit: don't crash main request if logging fails
    console.error(
      "[audit] Failed to record audit event",
      {
        eventType,
        leadId: lead.id,
        organizationId: lead.organizationId,
        userId,
      },
      err
    );

    // Return a synthetic "failed" audit event so callers don't blow up
    return {
      id: "FAILED_AUDIT_WRITE",
      organizationId: lead.organizationId,
      entityType: "LEAD",
      entityId: lead.id,
      eventType,
      actorUserId: userId,
      metadata: {
        ...eventData,
        _auditError: "Failed to persist audit event",
      },
      createdAt: new Date(),
    };
  }
}

/**
 * Fetch audit events for a lead, ordered newest → oldest,
 * with simple cursor-based pagination support.
 *
 * This matches the usage in routes.ts, which passes:
 *   { organizationId, leadId, limit, cursor }
 */
export async function getAuditEventsForLead(params: {
  organizationId: string;
  leadId: string;
  limit?: number;
  cursor?: string | null;
}): Promise<{ events: AuditEvent[]; nextCursor: string | null }> {
  const { organizationId, leadId, limit = 100, cursor } = params;

  const rows = await prisma.auditEvent.findMany({
    where: {
      organizationId,
      entityType: "LEAD",
      entityId: leadId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
    skip: cursor ? 1 : 0,
    ...(cursor
      ? {
          cursor: { id: cursor },
        }
      : {}),
  });

  const events: AuditEvent[] = rows.map((row) => ({
    id: row.id,
    organizationId: row.organizationId,
    entityType: row.entityType,
    entityId: row.entityId,
    eventType: row.eventType,
    actorUserId: row.actorUserId,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt,
  }));

  const nextCursor = rows.length === limit ? rows[rows.length - 1].id : null;

  return {
    events,
    nextCursor,
  };
}

