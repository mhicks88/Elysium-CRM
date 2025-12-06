// apps/api/src/modules/tasks/service.ts
//
// DB-backed Tasks service using Prisma Task model.

import { prisma } from "../../db/client";

/**
 * API-level task status used by the UI.
 * We map this to/from the Prisma enum TaskStatus:
 * - "DONE" <-> "COMPLETED"
 */
export type ApiTaskStatus = "OPEN" | "IN_PROGRESS" | "DONE" | "CANCELLED";

type DbTaskStatus = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface Task {
  id: string;
  leadId: string;
  organizationId: string;
  assignedToUserId: string;
  title: string;
  description: string | null;
  status: ApiTaskStatus;
  dueAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Map API status to DB enum status.
 */
function mapApiStatusToDb(status: ApiTaskStatus | undefined): DbTaskStatus {
  if (!status) return "OPEN";
  if (status === "DONE") return "COMPLETED";
  return status;
}

/**
 * Map DB enum status to API status.
 */
function mapDbStatusToApi(status: DbTaskStatus): ApiTaskStatus {
  if (status === "COMPLETED") return "DONE";
  return status;
}

/**
 * Convert Prisma Task to API Task shape.
 */
function mapDbTaskToApi(db: any): Task {
  return {
    id: db.id,
    leadId: db.leadId,
    organizationId: db.organizationId,
    assignedToUserId: db.assignedToUserId,
    title: db.title,
    description: db.description ?? null,
    status: mapDbStatusToApi(db.status),
    dueAt: db.dueAt ?? null,
    createdAt: db.createdAt,
    updatedAt: db.updatedAt,
  };
}

/**
 * List tasks for a given lead, scoped by organization.
 */
export async function listTasksForLead(params: {
  organizationId: string;
  leadId: string;
}): Promise<Task[]> {
  const { organizationId, leadId } = params;

  const rows = await prisma.task.findMany({
    where: {
      organizationId,
      leadId,
    },
    orderBy: { createdAt: "desc" },
  });

  return rows.map(mapDbTaskToApi);
}

/**
 * List tasks for a set of assignees (or entire org if assigneeIds is null).
 * Used for global "My/Team Tasks" views.
 */
export async function listTasksForAssignees(params: {
  organizationId: string;
  assigneeIds: string[] | null;
  status?: ApiTaskStatus | "ALL";
  limit?: number;
  overdueOnly?: boolean;
}): Promise<Task[]> {
  const {
    organizationId,
    assigneeIds,
    status,
    limit = 50,
    overdueOnly = false,
  } = params;

  const where: any = {
    organizationId,
  };

  if (assigneeIds) {
    where.assignedToUserId = { in: assigneeIds };
  }

  if (status && status !== "ALL") {
    const dbStatus = mapApiStatusToDb(status);
    where.status = dbStatus;
  }

  if (overdueOnly) {
    const now = new Date();
    where.dueAt = {
      not: null,
      lte: now,
    };
    // Also exclude DONE/CANCELLED when showing overdue
    where.status = {
      in: ["OPEN", "IN_PROGRESS"],
    };
  }

  const rows = await prisma.task.findMany({
    where,
    orderBy: [
      { dueAt: "asc" },
      { createdAt: "desc" },
    ],
    take: limit,
  });

  return rows.map(mapDbTaskToApi);
}

/**
 * Create a new task for a lead.
 *
 * We derive:
 * - organizationId from the route
 * - type = OTHER
 * - priority = MEDIUM
 */
export async function createTaskForLead(params: {
  organizationId: string;
  leadId: string;
  assignedToUserId: string;
  title: string;
  description?: string | null;
  status?: ApiTaskStatus;
  dueAt?: Date | null;
}): Promise<Task> {
  const {
    organizationId,
    leadId,
    assignedToUserId,
    title,
    description,
    status,
    dueAt,
  } = params;

  const dbStatus = mapApiStatusToDb(status);

  const created = await prisma.task.create({
    data: {
      organizationId,
      leadId,
      assignedToUserId,
      title,
      description: description ?? "",
      status: dbStatus,
      type: "OTHER",
      priority: "MEDIUM",
      dueAt: dueAt ?? null,
    },
  });

  return mapDbTaskToApi(created);
}

/**
 * Update an existing task for a lead.
 */
export async function updateTaskForLead(params: {
  organizationId: string;
  leadId: string;
  taskId: string;
  title?: string;
  description?: string | null;
  assignedToUserId?: string | null;
  status?: ApiTaskStatus;
  dueAt?: Date | null;
}): Promise<Task | null> {
  const {
    organizationId,
    leadId,
    taskId,
    title,
    description,
    assignedToUserId,
    status,
    dueAt,
  } = params;

  const existing = await prisma.task.findFirst({
    where: {
      id: taskId,
      leadId,
      organizationId,
    },
  });

  if (!existing) {
    return null;
  }

  const dbStatus = status ? mapApiStatusToDb(status) : existing.status;

  const updated = await prisma.task.update({
    where: { id: existing.id },
    data: {
      title: title ?? existing.title,
      description:
        description !== undefined ? description ?? "" : existing.description,
      assignedToUserId:
        assignedToUserId !== undefined
          ? assignedToUserId ?? existing.assignedToUserId
          : existing.assignedToUserId,
      status: dbStatus,
      dueAt: dueAt !== undefined ? dueAt ?? null : existing.dueAt,
    },
  });

  return mapDbTaskToApi(updated);
}

/**
 * Delete a task for a lead.
 */
export async function deleteTaskForLead(params: {
  organizationId: string;
  leadId: string;
  taskId: string;
}): Promise<boolean> {
  const { organizationId, leadId, taskId } = params;

  const existing = await prisma.task.findFirst({
    where: {
      id: taskId,
      leadId,
      organizationId,
    },
  });

  if (!existing) {
    return false;
  }

  await prisma.task.delete({
    where: { id: existing.id },
  });

  return true;
}

