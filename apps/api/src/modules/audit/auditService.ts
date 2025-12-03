// apps/api/src/modules/audit/auditService.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export type AuditEntityType =
  | "LEAD"
  | "ENROLLMENT"
  | "TASK"
  | "COMPLIANCE"
  | "CALL_SESSION"
  | "SCRIPT"
  | string;

export interface RecordAuditEventInput {
  organizationId: string;
  entityType: AuditEntityType;
  entityId: string;
  eventType: string;
  actorUserId?: string | null;
  metadata?: unknown;
}

/**
 * Persist a single audit event to the database.
 * Use this instead of any in-memory audit logging.
 */
export async function recordAuditEvent(input: RecordAuditEventInput) {
  const { organizationId, entityType, entityId, eventType, actorUserId, metadata } = input;

  await prisma.auditEvent.create({
    data: {
      organizationId,
      entityType,
      entityId,
      eventType,
      actorUserId: actorUserId ?? null,
      metadata: (metadata ?? {}) as any,
    },
  });
}

/**
 * Fetch audit events for a given lead.
 * This is intended to back the AuditLogPanel in the UI.
 */
export async function getAuditEventsForLead(params: {
  organizationId: string;
  leadId: string;
  limit?: number;
  cursor?: string | null;
}) {
  const { organizationId, leadId, limit = 100, cursor } = params;

  const events = await prisma.auditEvent.findMany({
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

  const nextCursor = events.length === limit ? events[events.length - 1].id : null;

  return {
    events,
    nextCursor,
  };
}

/**
 * Generic fetcher if you want audit history for other entity types
 * (enrollment, tasks, etc.) later.
 */
export async function getAuditEventsForEntity(params: {
  organizationId: string;
  entityType: AuditEntityType;
  entityId: string;
  limit?: number;
  cursor?: string | null;
}) {
  const { organizationId, entityType, entityId, limit = 100, cursor } = params;

  const events = await prisma.auditEvent.findMany({
    where: {
      organizationId,
      entityType,
      entityId,
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

  const nextCursor = events.length === limit ? events[events.length - 1].id : null;

  return {
    events,
    nextCursor,
  };
}

