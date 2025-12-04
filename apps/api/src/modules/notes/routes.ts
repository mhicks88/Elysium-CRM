// apps/api/src/modules/notes/routes.ts
//
// Internal notes per lead.
// GET /api/notes/:leadId   → list notes for a lead
// POST /api/notes/:leadId  → create a new internal note for a lead
//
// Visibility:
//  - Uses the same team-based semantics as leads.
//  - If you can see a lead, you can see its notes.
//  - Only non-READ_ONLY roles can create notes.

import {
  Router,
  type Response,
  type NextFunction,
} from "express";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../../middleware/auth";
import { prisma } from "../../db/client";

export const notesRouter = Router();

/**
 * Compute the list of userIds whose leads a given user is allowed to see,
 * based on their role and the manager/director hierarchy.
 *
 * Returns:
 *  - null → no restriction (org-wide)
 *  - string[] → restrict to leads where assignedToUserId IN that list
 */
async function getAllowedAssigneeIdsForUser(params: {
  organizationId: string;
  userId: string;
  role: string;
}): Promise<string[] | null> {
  const { organizationId, userId, role } = params;

  if (role === "ADMIN" || role === "COMPLIANCE" || role === "READ_ONLY") {
    return null; // org-wide
  }

  if (role === "AGENT") {
    return [userId];
  }

  if (role === "MANAGER") {
    const agents = await prisma.user.findMany({
      where: {
        organizationId,
        managerId: userId,
      },
      select: { id: true },
    });
    return [userId, ...agents.map((a) => a.id)];
  }

  if (role === "DIRECTOR") {
    // Managers under this director
    const managers = await prisma.user.findMany({
      where: {
        organizationId,
        directorId: userId,
      },
      select: { id: true },
    });
    const managerIds = managers.map((m) => m.id);

    // Agents under those managers
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
 * Ensure the given lead is visible to the current user under org + role scoping.
 * Returns the lead record if visible, otherwise null.
 */
async function getVisibleLeadForUser(params: {
  organizationId: string;
  userId: string;
  role: string;
  leadId: string;
}) {
  const { organizationId, userId, role, leadId } = params;

  const allowedAssignees = await getAllowedAssigneeIdsForUser({
    organizationId,
    userId,
    role,
  });

  const where: any = {
    id: leadId,
    organizationId,
  };

  if (allowedAssignees) {
    where.assignedToUserId = { in: allowedAssignees };
  }

  return prisma.lead.findFirst({ where });
}

/**
 * GET /api/notes/:leadId
 *
 * List internal (isInternal = true) notes for a given lead, newest first.
 */
notesRouter.get(
  "/:leadId",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const orgId = user.organizationId;
      const userId = user.id;
      const role = String(user.role ?? "");
      const { leadId } = req.params;

      if (!leadId) {
        res.status(400).json({ error: "leadId is required" });
        return;
      }

      const lead = await getVisibleLeadForUser({
        organizationId: orgId,
        userId,
        role,
        leadId,
      });

      if (!lead) {
        res.status(404).json({ error: "Lead not found or not visible" });
        return;
      }

      const notes = await prisma.note.findMany({
        where: {
          organizationId: orgId,
          leadId: leadId,
          isInternal: true,
          deletedAt: null,
        },
        orderBy: {
          createdAt: "desc",
        },
        include: {
          author: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        take: 50,
      });

      res.json({
        notes: notes.map((n) => ({
          id: n.id,
          leadId: n.leadId,
          body: n.body,
          createdAt: n.createdAt.toISOString(),
          authorUserId: n.authorUserId,
          authorName: n.author
            ? `${n.author.firstName} ${n.author.lastName}`
            : null,
          authorEmail: n.author?.email ?? null,
        })),
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/notes/:leadId
 *
 * Create a new internal note for a lead.
 * Allowed roles: everyone except READ_ONLY.
 */
notesRouter.post(
  "/:leadId",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const orgId = user.organizationId;
      const userId = user.id;
      const role = String(user.role ?? "");
      const { leadId } = req.params;
      const { body } = req.body ?? {};

      if (!leadId) {
        res.status(400).json({ error: "leadId is required" });
        return;
      }

      if (role === "READ_ONLY") {
        res.status(403).json({ error: "Not authorized to add notes" });
        return;
      }

      if (!body || typeof body !== "string" || !body.trim()) {
        res.status(400).json({ error: "Note body is required" });
        return;
      }

      const lead = await getVisibleLeadForUser({
        organizationId: orgId,
        userId,
        role,
        leadId,
      });

      if (!lead) {
        res.status(404).json({ error: "Lead not found or not visible" });
        return;
      }

      const note = await prisma.note.create({
        data: {
          organizationId: orgId,
          leadId: lead.id,
          authorUserId: userId,
          body: body.trim(),
          isInternal: true,
          createdAt: new Date(),
          deletedAt: null,
        },
        include: {
          author: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      res.status(201).json({
        id: note.id,
        leadId: note.leadId,
        body: note.body,
        createdAt: note.createdAt.toISOString(),
        authorUserId: note.authorUserId,
        authorName: note.author
          ? `${note.author.firstName} ${note.author.lastName}`
          : null,
        authorEmail: note.author?.email ?? null,
      });
    } catch (err) {
      next(err);
    }
  }
);

