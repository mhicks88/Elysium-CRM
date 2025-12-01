// apps/api/src/modules/audit/routes.ts

import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../../middleware/auth";
import { getAuditEventsForLead } from "./service";

export const auditRouter = Router();

// GET /api/audit/:leadId
auditRouter.get(
  "/:leadId",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    const { leadId } = req.params;

    if (!leadId) {
      return res.status(400).json({ error: "leadId is required" });
    }

    const events = await getAuditEventsForLead(leadId);
    return res.json({ events });
  }
);

