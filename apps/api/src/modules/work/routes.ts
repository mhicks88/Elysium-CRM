// apps/api/src/modules/work/routes.ts
//
// Work queue / "next best lead" endpoint.
// GET /api/work/next-lead
//
// Picks a high-priority lead for the current user based on:
//  - Role/assignment scope (same as leads/calls)
//  - Status (ignores DNC and clearly dead states)
//  - Permission to contact phone (prefers leads with permission)
//  - Recency of createdAt
//  - Simple status-based weighting

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

export const workRouter = Router();

/**
 * Compute a simple lead "score" for prioritization.
 *
 * Factors:
 *  - Status (NEW/CONTACT_ATTEMPTED/CONTACTED/IN_DISCUSSION higher; ENROLLED lower; DNC strongly negative)
 *  - Recency of createdAt (newer = higher)
 *  - Permission to contact phone (no permission → penalty)
 */
function computeLeadScore(lead: {
  status: string;
  createdAt: Date;
  permissionToContactPhone: boolean;
}): number {
  let score = 0;

  const status = lead.status;

  const statusBase: Record<string, number> = {
    NEW: 50,
    CONTACT_ATTEMPTED: 45,
    CONTACTED: 40,
    SOA_REQUIRED: 35,
    SOA_COMPLETED: 30,
    IN_DISCUSSION: 40,
    ENROLLED: 5,
    NOT_INTERESTED: -10,
    DO_NOT_CONTACT: -100,
  };

  score += statusBase[status] ?? 0;

  const now = new Date();
  const ageMs = now.getTime() - lead.createdAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  if (ageDays <= 1) {
    score += 30;
  } else if (ageDays <= 3) {
    score += 20;
  } else if (ageDays <= 7) {
    score += 10;
  } else if (ageDays > 30) {
    score -= 10;
  }

  if (!lead.permissionToContactPhone) {
    score -= 40;
  }

  return score;
}

/**
 * Same semantics as leads/calls:
 *  - ADMIN / COMPLIANCE / READ_ONLY: org-wide (null)
 *  - AGENT: self
 *  - MANAGER: self + agents
 *  - DIRECTOR: self + managers + agents
 */
async function getAllowedAssigneeIdsForUser(params: {
  organizationId: string;
  userId: string;
  role: string;
}): Promise<string[] | null> {
  const { organizationId, userId, role } = params;

  if (role === "ADMIN" || role === "COMPLIANCE" || role === "READ_ONLY") {
    return null;
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

  return [userId];
}

/**
 * GET /api/work/next-lead
 *
 * Returns a single "best next lead" for the current user, or null if none.
 *
 * Response:
 *  {
 *    lead: { ...lead fields..., score },
 *    reasoning: {
 *      score,
 *      openTasksCount,
 *      lastCallAt,
 *      lastCallStatus
 *    }
 *  }
 */
workRouter.get(
  "/next-lead",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const orgId = user.organizationId;
      const userId = user.id;
      const role = String(user.role ?? "");

      const allowedAssignees = await getAllowedAssigneeIdsForUser({
        organizationId: orgId,
        userId,
        role,
      });

      // Candidate lead filter:
      //  - Same org
      //  - Not DNC
      //  - In one of the "active" statuses
      //  - Has a phone (we'll still let the compliance system be the gatekeeper)
      const activeStatuses = [
        "NEW",
        "CONTACT_ATTEMPTED",
        "CONTACTED",
        "SOA_REQUIRED",
        "SOA_COMPLETED",
        "IN_DISCUSSION",
      ];

      const where: any = {
        organizationId: orgId,
        status: {
          in: activeStatuses as any,
        },
        NOT: {
          status: "DO_NOT_CONTACT",
        },
        phonePrimary: {
          not: null,
        },
      };

      if (allowedAssignees) {
        where.assignedToUserId = { in: allowedAssignees };
      }

      // Pull a reasonable batch and score in memory.
      const candidates = await prisma.lead.findMany({
        where,
        orderBy: {
          updatedAt: "asc",
        },
        take: 200,
      });

      if (candidates.length === 0) {
        res.json({ lead: null, reasoning: null });
        return;
      }

      const scored = candidates.map((lead) => ({
        lead,
        score: computeLeadScore({
          status: lead.status,
          createdAt: lead.createdAt,
          permissionToContactPhone: lead.permissionToContactPhone,
        }),
      }));

      scored.sort((a, b) => b.score - a.score);
      const best = scored[0];

      // Enrich with tasks + last call context for the chosen lead
      const [openTasksCount, lastCall] = await Promise.all([
        prisma.task.count({
          where: {
            organizationId: orgId,
            leadId: best.lead.id,
            status: {
              in: ["OPEN", "IN_PROGRESS"] as any,
            },
          },
        }),
        prisma.callSession.findFirst({
          where: {
            organizationId: orgId,
            leadId: best.lead.id,
          },
          orderBy: {
            startedAt: "desc",
          },
        }),
      ]);

      const reasoning = {
        score: best.score,
        openTasksCount,
        lastCallAt: lastCall ? lastCall.startedAt.toISOString() : null,
        lastCallStatus: lastCall ? lastCall.status : null,
      };

      const leadPayload = {
        id: best.lead.id,
        firstName: best.lead.firstName,
        lastName: best.lead.lastName,
        email: best.lead.email,
        phone: best.lead.phonePrimary,
        state: best.lead.state,
        status: best.lead.status,
        createdAt: best.lead.createdAt.toISOString(),
        updatedAt: best.lead.updatedAt.toISOString(),
        permissionToContactPhone: best.lead.permissionToContactPhone,
        doNotContact: best.lead.status === "DO_NOT_CONTACT",
        assignedToUserId: best.lead.assignedToUserId,
        score: best.score,
      };

      res.json({
        lead: leadPayload,
        reasoning,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/work/queue
 *
 * Return a simple "work queue" for the current user, currently backed by
 * open / in-progress tasks scoped by role/team.
 *
 * Response:
 *  {
 *    items: [
 *      {
 *        id: string;
 *        type: "TASK";
 *        leadId: string;
 *        taskId: string;
 *        createdAt: string;
 *      },
 *      ...
 *    ]
 *  }
 */
workRouter.get(
  "/queue",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const orgId = user.organizationId;
      const userId = user.id;
      const role = String(user.role ?? "");

      const assigneeIds = await getAllowedAssigneeIdsForUser({
        organizationId: orgId,
        userId,
        role,
      });

      const where: any = {
        organizationId: orgId,
        status: {
          in: ["OPEN", "IN_PROGRESS"] as any,
        },
      };

      if (assigneeIds) {
        where.assignedToUserId = { in: assigneeIds };
      }

      const tasks = await prisma.task.findMany({
        where,
        orderBy: [
          // High priority first
          { priority: "desc" },
          // Then by due date if present
          { dueAt: "asc" },
          // Then by createdAt
          { createdAt: "asc" },
        ],
        take: 100,
      });

      const items = tasks.map((t) => ({
        id: t.id,
        type: "TASK" as const,
        leadId: t.leadId,
        taskId: t.id,
        createdAt: t.createdAt.toISOString(),
      }));

      res.json({ items });
    } catch (err) {
      next(err);
    }
  }
);

