// apps/api/src/modules/tasks/routes.ts
//
// Task routes with org + role-aware scoping.
//
// Roles (API/JWT):
//  - ADMIN
//  - MANAGER
//  - DIRECTOR
//  - AGENT
//  - COMPLIANCE_OFFICER
//  - VIEW_ONLY
//
// Visibility for GET /api/tasks:
//  - ADMIN / COMPLIANCE_OFFICER / VIEW_ONLY: org-wide tasks (assigneeIds = null)
//  - DIRECTOR: self + managers + agents under them
//  - MANAGER: self + agents they manage
//  - AGENT: self only
//
// Write permissions (create/update/delete):
//  - ADMIN / MANAGER / AGENT
//  - DIRECTOR is currently read-only in tasks (can still see via role scoping)
//  - COMPLIANCE_OFFICER / VIEW_ONLY are read-only for tasks.

import {
  Router,
  type Response,
  type NextFunction,
} from "express";
import {
  requireAuth,
  requireRole,
  Roles,
  type AuthenticatedRequest,
} from "../../middleware/auth";
import { prisma } from "../../db/client";
import {
  createTaskForLead,
  deleteTaskForLead,
  listTasksForLead,
  listTasksForAssignees,
  updateTaskForLead,
  type ApiTaskStatus,
} from "./service";
import { recordAuditEvent } from "../audit/service";
import { sendEmail } from "../../lib/emailService";

export const tasksRouter = Router();

/**
 * Compute assignee userIds for a given user + role, using the same
 * semantics as leads and calls:
 *  - AGENT: self only
 *  - MANAGER: self + agents they manage
 *  - DIRECTOR: self + managers + agents under them
 *  - ADMIN / COMPLIANCE_OFFICER / VIEW_ONLY: org-wide (null)
 */
async function getAssigneeIdsForUserRole(params: {
  organizationId: string;
  userId: string;
  role: Roles;
}): Promise<string[] | null> {
  const { organizationId, userId, role } = params;

  if (
    role === Roles.ADMIN ||
    role === Roles.COMPLIANCE_OFFICER ||
    role === Roles.VIEW_ONLY
  ) {
    return null; // org-wide
  }

  if (role === Roles.AGENT) {
    return [userId];
  }

  if (role === Roles.MANAGER) {
    const agents = await prisma.user.findMany({
      where: {
        organizationId,
        managerId: userId,
      },
      select: { id: true },
    });
    return [userId, ...agents.map((a) => a.id)];
  }

  if (role === Roles.DIRECTOR) {
    const managers = await prisma.user.findMany({
      where: {
        organizationId,
        directorId: userId,
      },
      select: { id: true },
    });
    const managerIds = managers.map((m) => m.id);

    const agents = await prisma.user.findMany({
      where: {
        organizationId,
        managerId: {
          in: managerIds.length > 0 ? managerIds : ["__none__"],
        },
      },
      select: { id: true },
    });
    const agentIds = agents.map((a) => a.id);

    return [userId, ...managerIds, ...agentIds];
  }

  // Fallback: restrict to self
  return [userId];
}

/**
 * GET /api/tasks
 *
 * List tasks for the current user, scoped by role/team.
 *
 * Query params:
 *  - status: OPEN | IN_PROGRESS | DONE | CANCELLED | ALL (optional)
 *  - overdueOnly: "true" | "false" (optional, default false)
 *  - limit: number (optional, default 50, max 200)
 */
tasksRouter.get(
  "/",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const orgId = user.organizationId;
      const userId = user.id;
      const role = user.role;

      const statusParam =
        typeof req.query.status === "string"
          ? req.query.status
          : undefined;
      const overdueOnlyParam = req.query.overdueOnly === "true";
      const limitParam =
        typeof req.query.limit === "string"
          ? parseInt(req.query.limit, 10)
          : undefined;

      let status: ApiTaskStatus | "ALL" | undefined;
      if (
        statusParam === "OPEN" ||
        statusParam === "IN_PROGRESS" ||
        statusParam === "DONE" ||
        statusParam === "CANCELLED"
      ) {
        status = statusParam;
      } else if (statusParam === "ALL") {
        status = "ALL";
      }

      let limit = 50;
      if (
        typeof limitParam === "number" &&
        !Number.isNaN(limitParam) &&
        limitParam > 0 &&
        limitParam <= 200
      ) {
        limit = limitParam;
      }

      const assigneeIds = await getAssigneeIdsForUserRole({
        organizationId: orgId,
        userId,
        role,
      });

      const tasks = await listTasksForAssignees({
        organizationId: orgId,
        assigneeIds,
        status,
        limit,
        overdueOnly: overdueOnlyParam,
      });

      res.json({
        tasks: tasks.map((t) => ({
          id: t.id,
          leadId: t.leadId,
          organizationId: t.organizationId,
          title: t.title,
          description: t.description,
          assignedToUserId: t.assignedToUserId,
          status: t.status,
          dueAt: t.dueAt ? t.dueAt.toISOString() : null,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
        })),
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/tasks/:leadId
 * List tasks for a given lead, scoped by organization.
 *
 * Any authenticated user in the org can read tasks for that lead.
 */
tasksRouter.get(
  "/:leadId",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const orgId = user.organizationId;
      const { leadId } = req.params;

      if (!leadId) {
        res.status(400).json({ error: "leadId is required" });
        return;
      }

      // Ensure the lead belongs to this org (defensive)
      const lead = await prisma.lead.findFirst({
        where: {
          id: leadId,
          organizationId: orgId,
        },
      });

      if (!lead) {
        res.status(404).json({ error: "Lead not found" });
        return;
      }

      const tasks = await listTasksForLead({
        organizationId: orgId,
        leadId,
      });

      res.json(
        tasks.map((t) => ({
          id: t.id,
          leadId: t.leadId,
          title: t.title,
          description: t.description,
          assignedToUserId: t.assignedToUserId,
          status: t.status,
          dueAt: t.dueAt ? t.dueAt.toISOString() : null,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
        }))
      );
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/tasks/:leadId
 * Create a new task for the lead.
 *
 * Allowed roles: ADMIN, AGENT, MANAGER
 *
 * Body: { title: string; description?: string; assignedToUserId?: string; status?: ApiTaskStatus; dueAt?: string }
 */
tasksRouter.post(
  "/:leadId",
  requireAuth,
  requireRole(Roles.ADMIN, Roles.AGENT, Roles.MANAGER),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { leadId } = req.params;
      const { title, description, assignedToUserId, status, dueAt } =
        req.body ?? {};

      if (!leadId) {
        res.status(400).json({ error: "leadId is required" });
        return;
      }

      if (!title || typeof title !== "string") {
        res.status(400).json({ error: "Task title is required" });
        return;
      }

      const user = req.user!;
      const organizationId: string = user.organizationId;
      const userId: string = user.id;

      // Ensure the lead belongs to this org
      const lead = await prisma.lead.findFirst({
        where: {
          id: leadId,
          organizationId,
        },
      });

      if (!lead) {
        res.status(404).json({ error: "Lead not found" });
        return;
      }

      let dueAtDate: Date | null = null;
      if (dueAt) {
        const parsed = new Date(dueAt);
        if (!Number.isNaN(parsed.getTime())) {
          dueAtDate = parsed;
        }
      }

      const apiStatus: ApiTaskStatus | undefined = status;

      const created = await createTaskForLead({
        organizationId,
        leadId,
        assignedToUserId: assignedToUserId ?? userId,
        title,
        description: description ?? null,
        status: apiStatus,
        dueAt: dueAtDate,
      });

      // If the task is assigned to a user, send an email notification.
      // In development, this is logged via the emailService console implementation.
      if (created.assignedToUserId) {
        const assignee = await prisma.user.findFirst({
          where: {
            id: created.assignedToUserId,
            organizationId,
          },
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        });

        if (assignee?.email) {
          const assigneeName =
            [assignee.firstName, assignee.lastName]
              .filter(Boolean)
              .join(" ") || assignee.email;

          const dueText = created.dueAt
            ? `\nDue at: ${created.dueAt.toISOString()}`
            : "";

          await sendEmail({
            to: assignee.email,
            subject: `New task assigned: ${created.title}`,
            text:
              `Hi ${assigneeName},\n\n` +
              `You have been assigned a new task in Elysium CRM.\n\n` +
              `Title: ${created.title}\n` +
              `Lead ID: ${created.leadId}${dueText}\n\n` +
              `Please log in to Elysium CRM to view details and update the status.\n`,
          });
        }
      }

      // Audit event
      await recordAuditEvent({
        userId,
        leadId,
        eventType: "TASK_CREATED",
        eventData: {
          taskId: created.id,
          title: created.title,
          status: created.status,
          dueAt: created.dueAt ? created.dueAt.toISOString() : null,
        },
      });

      res.status(201).json({
        id: created.id,
        leadId: created.leadId,
        title: created.title,
        description: created.description,
        assignedToUserId: created.assignedToUserId,
        status: created.status,
        dueAt: created.dueAt ? created.dueAt.toISOString() : null,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/tasks/:leadId/:taskId
 * Update an existing task.
 *
 * Allowed roles: ADMIN, AGENT, MANAGER
 */
tasksRouter.patch(
  "/:leadId/:taskId",
  requireAuth,
  requireRole(Roles.ADMIN, Roles.AGENT, Roles.MANAGER),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { leadId, taskId } = req.params;
      const { title, description, assignedToUserId, status, dueAt } =
        req.body ?? {};

      if (!leadId || !taskId) {
        res
          .status(400)
          .json({ error: "leadId and taskId are required" });
        return;
      }

      const user = req.user!;
      const organizationId: string = user.organizationId;

      // Ensure the lead belongs to this org
      const lead = await prisma.lead.findFirst({
        where: {
          id: leadId,
          organizationId,
        },
      });

      if (!lead) {
        res.status(404).json({ error: "Lead not found" });
        return;
      }

      let dueAtDate: Date | null | undefined = undefined;
      if (dueAt === null) {
        dueAtDate = null;
      } else if (typeof dueAt === "string") {
        const parsed = new Date(dueAt);
        if (!Number.isNaN(parsed.getTime())) {
          dueAtDate = parsed;
        }
      }

      const apiStatus: ApiTaskStatus | undefined = status;

      const updated = await updateTaskForLead({
        organizationId,
        leadId,
        taskId,
        title,
        description,
        assignedToUserId,
        status: apiStatus,
        dueAt: dueAtDate,
      });

      if (!updated) {
        res.status(404).json({ error: "Task not found" });
        return;
      }

      // Audit event
      await recordAuditEvent({
        userId: user.id,
        leadId,
        eventType: "TASK_UPDATED",
        eventData: {
          taskId: updated.id,
          title: updated.title,
          status: updated.status,
          dueAt: updated.dueAt ? updated.dueAt.toISOString() : null,
        },
      });

      res.json({
        id: updated.id,
        leadId: updated.leadId,
        title: updated.title,
        description: updated.description,
        assignedToUserId: updated.assignedToUserId,
        status: updated.status,
        dueAt: updated.dueAt ? updated.dueAt.toISOString() : null,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/tasks/:leadId/:taskId
 * Delete a task.
 *
 * Allowed roles: ADMIN, AGENT, MANAGER
 */
tasksRouter.delete(
  "/:leadId/:taskId",
  requireAuth,
  requireRole(Roles.ADMIN, Roles.AGENT, Roles.MANAGER),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { leadId, taskId } = req.params;

      if (!leadId || !taskId) {
        res
          .status(400)
          .json({ error: "leadId and taskId are required" });
        return;
      }

      const user = req.user!;
      const organizationId: string = user.organizationId;

      // Ensure the lead belongs to this org
      const lead = await prisma.lead.findFirst({
        where: {
          id: leadId,
          organizationId,
        },
      });

      if (!lead) {
        res.status(404).json({ error: "Lead not found" });
        return;
      }

      const deleted = await deleteTaskForLead({
        organizationId,
        leadId,
        taskId,
      });

      if (!deleted) {
        res.status(404).json({ error: "Task not found" });
        return;
      }

      // Audit event
      await recordAuditEvent({
        userId: user.id,
        leadId,
        eventType: "TASK_DELETED",
        eventData: {
          taskId,
        },
      });

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

