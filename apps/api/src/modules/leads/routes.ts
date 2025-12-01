import { Router } from "express";
import {
  requireAuth,
  requireRole,
  Roles,
  type AuthenticatedRequest,
} from "../../middleware/auth";
import {
  createLead,
  listLeads,
  getLeadById,
  updateLead,
} from "./service";
import { recordAuditEvent } from "../audit/service";

export const leadsRouter = Router();

// POST /api/leads
leadsRouter.post(
  "/",
  requireAuth,
  requireRole(Roles.ADMIN, Roles.AGENT),
  async (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    const payload = req.body;

    try {
      const lead = await createLead(user.organizationId, payload);

      // Audit: lead created
      await recordAuditEvent({
        userId: user.id,
        leadId: lead.id,
        eventType: "LEAD_CREATED",
        eventData: { payload },
      });

      return res.status(201).json(lead);
    } catch (err: any) {
      return res
        .status(400)
        .json({ error: err?.message || "Failed to create lead" });
    }
  }
);

// GET /api/leads
leadsRouter.get(
  "/",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    const user = req.user!;

    const {
      page,
      pageSize,
      search,
      status,
      sortBy,
      sortOrder,
    } = req.query as Record<string, string | undefined>;

    // Narrow status to allowed values (NEW, IN_PROGRESS, ENROLLED, DO_NOT_CONTACT, ALL)
    type StatusFilter =
      | "NEW"
      | "IN_PROGRESS"
      | "ENROLLED"
      | "DO_NOT_CONTACT"
      | "ALL";

    const rawStatus = status;
    const allowedStatuses: StatusFilter[] = [
      "NEW",
      "IN_PROGRESS",
      "ENROLLED",
      "DO_NOT_CONTACT",
      "ALL",
    ];

    const typedStatus = allowedStatuses.includes(rawStatus as StatusFilter)
      ? (rawStatus as StatusFilter)
      : undefined;

    const filters: any = {
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      search: search ?? undefined,
      status: typedStatus,
      sortBy: sortBy ?? undefined,
      sortOrder: (sortOrder as "asc" | "desc" | undefined) ?? undefined,
    };

    try {
      const result = await listLeads(user.organizationId, filters);
      return res.json(result);
    } catch (err: any) {
      return res
        .status(400)
        .json({ error: err?.message || "Failed to list leads" });
    }
  }
);

// GET /api/leads/:id
leadsRouter.get(
  "/:id",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    const { id } = req.params;

    try {
      const lead = await getLeadById(user.organizationId, id);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      return res.json(lead);
    } catch (err: any) {
      return res
        .status(400)
        .json({ error: err?.message || "Failed to fetch lead" });
    }
  }
);

// PUT /api/leads/:id
leadsRouter.put(
  "/:id",
  requireAuth,
  requireRole(Roles.ADMIN, Roles.AGENT),
  async (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    const { id } = req.params;
    const payload = req.body;

    try {
      const before = await getLeadById(user.organizationId, id);
      if (!before) {
        return res.status(404).json({ error: "Lead not found" });
      }

      const updated = await updateLead(user.organizationId, id, payload);

      // Audit: lead updated
      await recordAuditEvent({
        userId: user.id,
        leadId: id,
        eventType: "LEAD_UPDATED",
        eventData: {
          before,
          after: updated,
        },
      });

      return res.json(updated);
    } catch (err: any) {
      return res
        .status(400)
        .json({ error: err?.message || "Failed to update lead" });
    }
  }
);

