// apps/api/src/modules/leads/routes.ts
//
// Lead routes with org + role-aware scoping.
//
// Roles (API/JWT):
//  - ADMIN
//  - MANAGER
//  - DIRECTOR
//  - AGENT
//  - COMPLIANCE_OFFICER
//  - VIEW_ONLY
//
// Visibility:
//  - ADMIN / COMPLIANCE_OFFICER / VIEW_ONLY: org-wide leads
//  - DIRECTOR: leads for director + their managers + those managers' agents
//  - MANAGER: leads for manager + their agents
//  - AGENT: leads where assignedToUserId === current user
//
// Write permissions:
//  - CREATE lead (POST /api/leads): ADMIN / MANAGER / DIRECTOR / AGENT
//  - UPDATE lead (PUT /api/leads/:id):
//      * same as above, but only if the lead is visible under their scope
//  - IMPORT leads: ADMIN / MANAGER
//
// COMPLIANCE_OFFICER / VIEW_ONLY are read-only for leads.

import {
  Router,
  type Response,
  type NextFunction,
} from "express";
import multer from "multer";
import {
  requireAuth,
  requireRole,
  type AuthenticatedRequest,
  Roles,
} from "../../middleware/auth";
import { prisma } from "../../db/client";
import { recordAuditEvent } from "../audit/service";
import {
  importLeadsFromCsv,
  createLead as createLeadService,
} from "./service";
import type { CreateLeadRequestDto } from "@elysium-crm/shared-types";

export const leadsRouter = Router();

const upload = multer({ storage: multer.memoryStorage() });

function buildAssigneeDisplayName(
  user:
    | {
        id: string;
        firstName: string | null;
        lastName: string | null;
        email: string | null;
      }
    | null
    | undefined
): string | null {
  if (!user) return null;
  const fullName = [user.firstName, user.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (fullName) return fullName;
  if (user.email) return user.email;
  return user.id;
}

/**
 * Compute a simple lead "score" for prioritization.
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

  // Recency: newer leads get a bump
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

  // Permission penalty
  if (!lead.permissionToContactPhone) {
    score -= 40;
  }

  return score;
}

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
  role: Roles;
}): Promise<string[] | null> {
  const { organizationId, userId, role } = params;

  // Org-wide roles: ADMIN, COMPLIANCE_OFFICER, VIEW_ONLY
  if (
    role === Roles.ADMIN ||
    role === Roles.COMPLIANCE_OFFICER ||
    role === Roles.VIEW_ONLY
  ) {
    return null;
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
 * GET /api/leads
 *
 * List leads visible to the current user (org + role scoped).
 */
leadsRouter.get(
  "/",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const orgId = user.organizationId;
      const userId = user.id;
      const role = user.role;

      const { search, status } = req.query;
      const sortByParam =
        typeof req.query.sortBy === "string"
          ? req.query.sortBy
          : undefined;
      const sortOrderParam =
        req.query.sortOrder === "asc" ? "asc" : "desc";

      const allowedAssignees = await getAllowedAssigneeIdsForUser({
        organizationId: orgId,
        userId,
        role,
      });

      const where: any = {
        organizationId: orgId,
      };

      const allowedStatuses = [
        "NEW",
        "CONTACT_ATTEMPTED",
        "CONTACTED",
        "SOA_REQUIRED",
        "SOA_COMPLETED",
        "IN_DISCUSSION",
        "ENROLLED",
        "NOT_INTERESTED",
        "DO_NOT_CONTACT",
      ];

      if (
        typeof status === "string" &&
        allowedStatuses.includes(status)
      ) {
        where.status = status;
      }

      if (allowedAssignees) {
        where.assignedToUserId = { in: allowedAssignees };
      }

      if (typeof search === "string" && search.trim()) {
        const term = search.trim();
        where.OR = [
          { firstName: { contains: term, mode: "insensitive" } },
          { lastName: { contains: term, mode: "insensitive" } },
          { email: { contains: term, mode: "insensitive" } },
          { phonePrimary: { contains: term, mode: "insensitive" } },
          { state: { contains: term, mode: "insensitive" } },
          { assignedToUserId: { contains: term, mode: "insensitive" } },
        ];
      }

      const orderBy: any = {};

      if (sortByParam === "updatedAt") {
        orderBy.updatedAt = sortOrderParam;
      } else {
        // createdAt default for DB ordering; score will be sorted in-memory
        orderBy.createdAt = sortOrderParam;
      }

      const leads = await prisma.lead.findMany({
        where,
        orderBy,
        include: {
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      let payload = leads.map((l) => {
        const score = computeLeadScore({
          status: l.status,
          createdAt: l.createdAt,
          permissionToContactPhone: l.permissionToContactPhone,
        });

        const assignedToName = buildAssigneeDisplayName(
          l.assignedTo ?? null
        );

        return {
          id: l.id,
          firstName: l.firstName,
          lastName: l.lastName,
          email: l.email,
          phone: l.phonePrimary,
          state: l.state,
          status: l.status,
          createdAt: l.createdAt.toISOString(),
          updatedAt: l.updatedAt.toISOString(),
          permissionToContactPhone: l.permissionToContactPhone,
          doNotContact: l.status === "DO_NOT_CONTACT",
          assignedToUserId: l.assignedToUserId,
          assignedToName,
          score,
        };
      });

      // In-memory sort by score if requested (or default)
      if (!sortByParam || sortByParam === "score") {
        payload = payload.sort((a, b) =>
          sortOrderParam === "asc"
            ? a.score - b.score
            : b.score - a.score
        );
      }

      res.json(payload);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/leads/next
 */
leadsRouter.get(
  "/next",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const orgId = user.organizationId;
      const userId = user.id;
      const role = user.role;

      const allowedAssignees = await getAllowedAssigneeIdsForUser({
        organizationId: orgId,
        userId,
        role,
      });

      const candidateStatuses = [
        "NEW",
        "CONTACT_ATTEMPTED",
        "CONTACTED",
        "SOA_REQUIRED",
        "SOA_COMPLETED",
        "IN_DISCUSSION",
      ];

      const where: any = {
        organizationId: orgId,
        status: { in: candidateStatuses },
      };

      if (allowedAssignees) {
        where.assignedToUserId = { in: allowedAssignees };
      }

      // Pull a reasonable slice and then score in-memory
      const candidates = await prisma.lead.findMany({
        where,
        orderBy: {
          updatedAt: "asc",
        },
        take: 200,
        include: {
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      if (candidates.length === 0) {
        res.status(404).json({
          error: "No leads available for next assignment in your scope",
        });
        return;
      }

      const scored = candidates.map((l) => ({
        lead: l,
        score: computeLeadScore({
          status: l.status,
          createdAt: l.createdAt,
          permissionToContactPhone: l.permissionToContactPhone,
        }),
      }));

      scored.sort((a, b) => b.score - a.score);

      const best = scored[0].lead;
      const bestScore = scored[0].score;

      await recordAuditEvent({
        userId,
        leadId: best.id,
        eventType: "LEAD_NEXT_SELECTED",
        eventData: {
          score: bestScore,
          role,
        },
      });

      const assignedToName = buildAssigneeDisplayName(
        best.assignedTo ?? null
      );

      res.json({
        id: best.id,
        firstName: best.firstName,
        lastName: best.lastName,
        email: best.email,
        phone: best.phonePrimary,
        state: best.state,
        status: best.status,
        createdAt: best.createdAt.toISOString(),
        updatedAt: best.updatedAt.toISOString(),
        permissionToContactPhone: best.permissionToContactPhone,
        doNotContact: best.status === "DO_NOT_CONTACT",
        assignedToUserId: best.assignedToUserId,
        assignedToName,
        score: bestScore,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Helper to ensure a single lead is visible to the current user under
 * their org + role-aware scoping.
 */
async function getLeadVisibleToUser(params: {
  organizationId: string;
  userId: string;
  role: Roles;
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

  return prisma.lead.findFirst({
    where,
    include: {
      assignedTo: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });
}

/**
 * GET /api/leads/:id
 */
leadsRouter.get(
  "/:id",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const orgId = user.organizationId;
      const userId = user.id;
      const role = user.role;
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ error: "id is required" });
        return;
      }

      const lead = await getLeadVisibleToUser({
        organizationId: orgId,
        userId,
        role,
        leadId: id,
      });

      if (!lead) {
        res.status(404).json({ error: "Lead not found" });
        return;
      }

      const score = computeLeadScore({
        status: lead.status,
        createdAt: lead.createdAt,
        permissionToContactPhone: lead.permissionToContactPhone,
      });

      const assignedToName = buildAssigneeDisplayName(
        lead.assignedTo ?? null
      );

      res.json({
        id: lead.id,
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        phone: lead.phonePrimary,
        state: lead.state,
        status: lead.status,
        createdAt: lead.createdAt.toISOString(),
        updatedAt: lead.updatedAt.toISOString(),
        permissionToContactPhone: lead.permissionToContactPhone,
        doNotContact: lead.status === "DO_NOT_CONTACT",
        assignedToUserId: lead.assignedToUserId,
        assignedToName,
        score,
      });
    } catch (err) {
      next(err);
    }
  }
);

// Local extension type for POST body that includes dateOfBirth
type RawCreateLeadBody = Partial<CreateLeadRequestDto> & {
  status?: string;
  dateOfBirth?: string | null;
};

// Local extension matching service
type CreateLeadWithDob = CreateLeadRequestDto & {
  dateOfBirth?: string | null;
};

/**
 * POST /api/leads
 *
 * Create a new lead in the current org.
 * Allowed roles: ADMIN / MANAGER / DIRECTOR / AGENT
 * Read-only roles (COMPLIANCE_OFFICER / VIEW_ONLY) are blocked by requireRole.
 */
leadsRouter.post(
  "/",
  requireAuth,
  requireRole(Roles.ADMIN, Roles.MANAGER, Roles.DIRECTOR, Roles.AGENT),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const orgId = user.organizationId;
      const userId = user.id;

      const {
        firstName,
        lastName,
        email,
        phone,
        state,
        zip,
        timezone,
        notes,
        permissionToContactPhone,
        doNotContact,
        assignedToId,
        dateOfBirth,
        status,
      } = (req.body ?? {}) as RawCreateLeadBody;

      if (!firstName || !lastName || !phone) {
        res
          .status(400)
          .json({ error: "firstName, lastName, and phone are required" });
        return;
      }

      const payload: CreateLeadWithDob = {
        firstName: String(firstName).trim(),
        lastName: String(lastName).trim(),
        phone: String(phone).trim(),
        email:
          email !== undefined
            ? email
              ? String(email).trim()
              : null
            : undefined,
        state:
          state !== undefined
            ? state
              ? String(state).trim()
              : null
            : undefined,
        zip:
          zip !== undefined
            ? zip
              ? String(zip).trim()
              : null
            : undefined,
        timezone:
          timezone !== undefined && timezone !== null
            ? String(timezone).trim()
            : undefined,
        notes:
          notes !== undefined && notes !== null
            ? String(notes).trim()
            : undefined,
        permissionToContactPhone:
          typeof permissionToContactPhone === "boolean"
            ? permissionToContactPhone
            : undefined,
        doNotContact:
          doNotContact === true || status === "DO_NOT_CONTACT"
            ? true
            : undefined,
        assignedToId:
          assignedToId && String(assignedToId).trim().length > 0
            ? String(assignedToId).trim()
            : undefined,
        dateOfBirth:
          dateOfBirth !== undefined && dateOfBirth !== null
            ? String(dateOfBirth)
            : undefined,
      };

      const created = await createLeadService(orgId, payload);

      await recordAuditEvent({
        userId,
        leadId: created.id,
        eventType: "LEAD_CREATED",
        eventData: {
          firstName: created.firstName,
          lastName: created.lastName,
          phone: created.phone,
        },
      });

      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /api/leads/:id
 *
 * Update lead fields (contact info, state, status, assignee).
 *
 * Allowed roles: ADMIN / MANAGER / DIRECTOR / AGENT
 *   - AND the lead must be visible under that role's scope.
 *
 * Read-only roles (COMPLIANCE_OFFICER / VIEW_ONLY) blocked by requireRole.
 */
leadsRouter.put(
  "/:id",
  requireAuth,
  requireRole(Roles.ADMIN, Roles.MANAGER, Roles.DIRECTOR, Roles.AGENT),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const orgId = user.organizationId;
      const userId = user.id;
      const role = user.role;
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ error: "id is required" });
        return;
      }

      const existing = await getLeadVisibleToUser({
        organizationId: orgId,
        userId,
        role,
        leadId: id,
      });

      if (!existing) {
        res.status(404).json({ error: "Lead not found" });
        return;
      }

      const {
        firstName,
        lastName,
        email,
        phone,
        state,
        status,
        assignedToUserId,
      } = req.body ?? {};

      const data: any = {};

      if (typeof firstName === "string") data.firstName = firstName.trim();
      if (typeof lastName === "string") data.lastName = lastName.trim();
      if (email !== undefined)
        data.email = email ? String(email).trim() : null;
      if (phone !== undefined)
        data.phonePrimary = phone ? String(phone).trim() : null;
      if (state !== undefined)
        data.state = state ? String(state).trim() : null;
      if (
        status &&
        [
          "NEW",
          "CONTACT_ATTEMPTED",
          "CONTACTED",
          "SOA_REQUIRED",
          "SOA_COMPLETED",
          "IN_DISCUSSION",
          "ENROLLED",
          "NOT_INTERESTED",
          "DO_NOT_CONTACT",
        ].includes(status)
      ) {
        data.status = status;
      }
      if (assignedToUserId !== undefined) {
        data.assignedToUserId =
          assignedToUserId && String(assignedToUserId).trim().length > 0
            ? String(assignedToUserId).trim()
            : null;
      }

      const updated = await prisma.lead.update({
        where: { id: existing.id },
        data,
        include: {
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      await recordAuditEvent({
        userId,
        leadId: updated.id,
        eventType: "LEAD_UPDATED",
        eventData: {
          changedFields: Object.keys(data),
        },
      });

      const score = computeLeadScore({
        status: updated.status,
        createdAt: updated.createdAt,
        permissionToContactPhone: updated.permissionToContactPhone,
      });

      const assignedToName = buildAssigneeDisplayName(
        updated.assignedTo ?? null
      );

      res.json({
        id: updated.id,
        firstName: updated.firstName,
        lastName: updated.lastName,
        email: updated.email,
        phone: updated.phonePrimary,
        state: updated.state,
        status: updated.status,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        permissionToContactPhone: updated.permissionToContactPhone,
        doNotContact: updated.status === "DO_NOT_CONTACT",
        assignedToUserId: updated.assignedToUserId,
        assignedToName,
        score,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/leads/import
 *
 * Upload a CSV file of leads.
 * Only ADMIN and MANAGER roles are allowed.
 */
leadsRouter.post(
  "/import",
  requireAuth,
  requireRole(Roles.ADMIN, Roles.MANAGER),
  upload.single("file"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const orgId = user.organizationId;
      const userId = user.id;

      const file = (req as any).file as
        | { buffer: Buffer; originalname: string }
        | undefined;

      if (!file || !file.buffer) {
        res.status(400).json({ error: "CSV file is required (field 'file')" });
        return;
      }

      const source =
        typeof req.body?.source === "string" &&
        req.body.source.trim().length > 0
          ? req.body.source.trim()
          : null;

      const summary = await importLeadsFromCsv({
        organizationId: orgId,
        userId,
        filename: file.originalname,
        source,
        csvBuffer: file.buffer,
        defaultAssignedToUserId: null,
      });

      res.status(201).json(summary);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/leads/import/jobs
 *
 * List recent lead import jobs for the org.
 * Only ADMIN and MANAGER can see these.
 */
leadsRouter.get(
  "/import/jobs",
  requireAuth,
  requireRole(Roles.ADMIN, Roles.MANAGER),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const orgId = user.organizationId;

      const limitRaw = req.query.limit;
      let limit = 20;
      if (typeof limitRaw === "string") {
        const parsed = parseInt(limitRaw, 10);
        if (!Number.isNaN(parsed) && parsed > 0 && parsed <= 100) {
          limit = parsed;
        }
      }

      const jobs = await prisma.leadImportJob.findMany({
        where: {
          organizationId: orgId,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
        include: {
          createdByUser: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      res.json({
        jobs: jobs.map((job) => ({
          id: job.id,
          filename: job.filename,
          source: job.source,
          status: job.status,
          totalRows: job.totalRows,
          createdCount: job.createdCount,
          duplicateCount: job.duplicateCount,
          failedCount: job.failedCount,
          createdAt: job.createdAt.toISOString(),
          startedAt: job.startedAt ? job.startedAt.toISOString() : null,
          finishedAt: job.finishedAt
            ? job.finishedAt.toISOString()
            : null,
          createdBy: job.createdByUser
            ? {
                id: job.createdByUser.id,
                email: job.createdByUser.email,
                name: `${job.createdByUser.firstName} ${job.createdByUser.lastName}`,
              }
            : null,
        })),
      });
    } catch (err) {
      next(err);
    }
  }
);

