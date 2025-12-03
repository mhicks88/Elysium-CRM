// apps/api/src/modules/complianceHistory/routes.ts

import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../../middleware/auth";
import { listComplianceChecks } from "./service";

export const complianceHistoryRouter = Router();

// GET /api/compliance/history/:leadId
complianceHistoryRouter.get(
  "/:leadId",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    const { leadId } = req.params;

    if (!leadId) {
      return res.status(400).json({ error: "leadId is required" });
    }

    const records = await listComplianceChecks(leadId);

    const serialized = records.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    }));

    return res.json({ history: serialized });
  }
);

