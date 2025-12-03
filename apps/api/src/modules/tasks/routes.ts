// apps/api/src/modules/tasks/routes.ts

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
import {
  createTaskForLead,
  deleteTaskForLead,
  listTasksForLead,
  updateTaskForLead,
  type ApiTaskStatus,
} from "./service";
import { recordAuditEvent } from "../audit/service";

export const tasksRouter = Router();

/**
 * GET /api/tasks/:leadId
 * List tasks for a given lead.
 *
 * Any authenticated user can read tasks; mutations are role-restricted.
 */
tasksRouter.get(
  "/:leadId",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { leadId } = req.params;

      if (!leadId) {
        res.status(400).json({ error: "leadId is required" });
        return;
      }

      const tasks = await listTasksForLead(leadId);

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
 * Roles: ADMIN, AGENT, MANAGER
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
 * Roles: ADMIN, AGENT, MANAGER
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
 * Roles: ADMIN, AGENT, MANAGER
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

