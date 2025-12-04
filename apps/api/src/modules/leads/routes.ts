// apps/api/src/modules/leads/routes.ts
//
// Lead routes with org + role-aware scoping.
//
// Roles (API/JWT):
//  - ADMIN
//  - MANAGER
//  - DIRECTOR
//  - AGENT
//  - COMPLIANCE_OFFICER (mapped from DB role COMPLIANCE)
//  - VIEW_ONLY        (mapped from DB role READ_ONLY)
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
  type AuthenticatedRequest,
} from "../../middleware/auth";
import { prisma } from "../../db/client";
import { recordAuditEvent } from "../audit/service";
import { importLeadsFromCsv } from "./service";

export const leadsRouter = Router();

const upload = multer({ storage: multer.memoryStorage() });

// Canonical API role names we expect on req.user.role
type ApiRole =
  | "ADMIN"
  | "MANAGER"
  | "DIRECTOR"
  | "AGENT"
  | "COMPLIANCE_OFFICER"
  | "VIEW_ONLY";

/**
 * Normalize whatever comes in as user.role into our canonical ApiRole,
 * handling both DB naming (COMPLIANCE / READ_ONLY) and API naming
 * (COMPLIANCE_OFFICER / VIEW_ONLY).
 */
function normalizeRole(
  raw: string | null | undefined
): ApiRole | null {
  if (!raw) return null;
  const r = String(raw).toUpperCase();

  if (r === "ADMIN") return "ADMIN";
  if (r === "MANAGER") return "MANAGER";
  if (r === "DIRECTOR") return "DIRECTOR";
  if (r === "AGENT") return "AGENT";
  if (r === "COMPLIANCE" || r === "COMPLIANCE_OFFICER") {
    return "COMPLIANCE_OFFICER";
  }
  if (r === "READ_ONLY" || r === "VIEW_ONLY") {
    return "VIEW_ONLY";
  }

  return null;
}

/**
 * Compute a simple lead "score" for prioritization.
 *
 * Factors (roughly):
 *  - Status (NEW/CONTACT_ATTEMPTED/CONTACTED/IN_DISCUSSION higher; ENROLLED low; DNC very negative)
 *  - Recency of createdAt (newer = higher)
 *  - Permission to contact phone (missing permission: penalty)
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
  role: ApiRole | null;
}): Promise<string[] | null> {
  const { organizationId, userId, role } = params;

  if (!role) {
    // Defensive: unknown role → most restrictive (self only)
    return [userId];
  }

  // Org-wide roles: ADMIN, COMPLIANCE_OFFICER, VIEW_ONLY
  if (
    role === "ADMIN" ||
    role === "COMPLIANCE_OFFICER" ||
    role === "VIEW_ONLY"
  ) {
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
 * Optional query params:
 *   ?search=...   (name/email/phone/state/assignee)
 *   ?status=NEW|CONTACT_ATTEMPTED|CONTACTED|SOA_REQUIRED|SOA_COMPLETED|IN_DISCUSSION|ENROLLED|NOT_INTERESTED|DO_NOT_CONTACT
 *   ?sortBy=score|createdAt|updatedAt
 *   ?sortOrder=asc|desc
 */
leadsRouter.get(
  "/",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const orgId = user.organizationId;
      const userId = user.id;
      const role = normalizeRole(user.role as string | undefined);

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
      });

      let payload = leads.map((l) => {
        const score = computeLeadScore({
          status: l.status,
          createdAt: l.createdAt,
          permissionToContactPhone: l.permissionToContactPhone,
        });

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
 *
 * Pick the "next" best lead for the current user to work, based on:
 *  - org + role scoping
 *  - active statuses (NEW / CONTACT_ATTEMPTED / CONTACTED / SOA_* / IN_DISCUSSION)
 *  - computeLeadScore (status + recency + phone permission)
 *
 * Returns the same shape as GET /api/leads/:id.
 */
leadsRouter.get(
  "/next",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const orgId = user.organizationId;
      const userId = user.id;
      const role = normalizeRole(user.role as string | undefined);

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
  role: ApiRole | null;
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
  });
}

/**
 * GET /api/leads/:id
 *
 * Fetch a single lead, scoped by org + role.
 */
leadsRouter.get(
  "/:id",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const orgId = user.organizationId;
      const userId = user.id;
      const role = normalizeRole(user.role as string | undefined);
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
        score,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/leads
 *
 * Create a new lead in the current org.
 * Allowed roles: ADMIN / MANAGER / DIRECTOR / AGENT
 * Read-only roles (COMPLIANCE_OFFICER / VIEW_ONLY) get 403.
 */
leadsRouter.post(
  "/",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const orgId = user.organizationId;
      const userId = user.id;
      const role = normalizeRole(user.role as string | undefined);

      if (
        !role ||
        role === "COMPLIANCE_OFFICER" ||
        role === "VIEW_ONLY"
      ) {
        res.status(403).json({
          error: "Not authorized to create leads",
        });
        return;
      }

      const {
        firstName,
        lastName,
        email,
        phone,
        state,
        status,
      } = req.body ?? {};

      if (!firstName || !lastName || !phone) {
        res
          .status(400)
          .json({ error: "firstName, lastName, and phone are required" });
        return;
      }

      const created = await prisma.lead.create({
        data: {
          organizationId: orgId,
          firstName: String(firstName),
          lastName: String(lastName),
          email: email ? String(email) : null,
          phonePrimary: String(phone),
          phoneAlt: null,
          state: state ? String(state) : "UNKNOWN",
          addressLine1: "UNKNOWN",
          addressLine2: null,
          city: "UNKNOWN",
          zip: "00000",
          timeZone: "America/New_York",
          leadSource: "OTHER",
          dateOfBirth: new Date("1900-01-01T00:00:00.000Z"),
          permissionToContactPhone: false,
          permissionToContactEmail: false,
          permissionSource: "UNKNOWN",
          permissionCapturedAt: null,
          status:
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
              ? status
              : "NEW",
          assignedToUserId: null,
          notesSummary: null,
        },
      });

      await recordAuditEvent({
        userId,
        leadId: created.id,
        eventType: "LEAD_CREATED",
        eventData: {
          firstName: created.firstName,
          lastName: created.lastName,
          phone: created.phonePrimary,
        },
      });

      const score = computeLeadScore({
        status: created.status,
        createdAt: created.createdAt,
        permissionToContactPhone: created.permissionToContactPhone,
      });

      res.status(201).json({
        id: created.id,
        firstName: created.firstName,
        lastName: created.lastName,
        email: created.email,
        phone: created.phonePrimary,
        state: created.state,
        status: created.status,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
        permissionToContactPhone: created.permissionToContactPhone,
        doNotContact: created.status === "DO_NOT_CONTACT",
        assignedToUserId: created.assignedToUserId,
        score,
      });
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
 * Read-only roles (COMPLIANCE_OFFICER / VIEW_ONLY) get 403.
 */
leadsRouter.put(
  "/:id",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const orgId = user.organizationId;
      const userId = user.id;
      const role = normalizeRole(user.role as string | undefined);
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ error: "id is required" });
        return;
      }

      if (
        !role ||
        role === "COMPLIANCE_OFFICER" ||
        role === "VIEW_ONLY"
      ) {
        res.status(403).json({
          error: "Not authorized to update leads",
        });
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
 *
 * Expects multipart/form-data with:
 *   - file: CSV file
 *   - source (optional): string label for the import
 */
leadsRouter.post(
  "/import",
  requireAuth,
  upload.single("file"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const orgId = user.organizationId;
      const userId = user.id;
      const role = normalizeRole(user.role as string | undefined);

      if (!role || !["ADMIN", "MANAGER"].includes(role)) {
        res.status(403).json({ error: "Not authorized to import leads" });
        return;
      }

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
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const orgId = user.organizationId;
      const role = normalizeRole(user.role as string | undefined);

      if (!role || !["ADMIN", "MANAGER"].includes(role)) {
        res
          .status(403)
          .json({ error: "Not authorized to view lead imports" });
        return;
      }

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

