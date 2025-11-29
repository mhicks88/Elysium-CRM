// apps/api/src/modules/leads/routes.ts

import { Router } from "express";
import {
  LeadStatus,
  UpdateLeadRequestDto,
} from "@elysium-crm/shared-types";
import {
  AuthenticatedRequest,
  requireAuth,
} from "../../middleware/auth";
import {
  listLeads,
  getLeadById,
  updateLead,
} from "./service";

export const leadsRouter = Router();

// All routes require auth
leadsRouter.use(requireAuth);

// GET /api/leads
leadsRouter.get("/", async (req, res, next) => {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user;

  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { page, pageSize, search } = req.query;
  const statusParam = (req.query.status as string) ?? "ALL";
  const validStatuses = new Set<string>([
    "ALL",
    ...Object.values(LeadStatus),
  ]);

  if (!validStatuses.has(statusParam)) {
    res.status(400).json({ error: "Invalid status filter" });
    return;
  }

  try {
    const result = await listLeads(user.organizationId, {
      page: page ? parseInt(page as string, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize as string, 10) : undefined,
      search: (search as string) || undefined,
      status: statusParam as LeadStatus | "ALL",
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/leads/:id
leadsRouter.get("/:id", async (req, res, next) => {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user;

  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const lead = await getLeadById(user.organizationId, req.params.id);
    res.json(lead);
  } catch (err: any) {
    if (err && err.status === 404) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }
    next(err);
  }
});

// PUT /api/leads/:id
leadsRouter.put("/:id", async (req, res, next) => {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user;

  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const payload = req.body as UpdateLeadRequestDto;

  if (
    payload.status &&
    !Object.values(LeadStatus).includes(payload.status)
  ) {
    res.status(400).json({ error: "Invalid lead status" });
    return;
  }

  try {
    const lead = await updateLead(
      user.organizationId,
      req.params.id,
      payload
    );
    res.json(lead);
  } catch (err: any) {
    if (err && err.status === 404) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }
    next(err);
  }
});

