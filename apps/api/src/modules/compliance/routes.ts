import { Router } from "express";

import { requireAuth } from "../../middleware/auth";
import { runPreCallChecks } from "./preCallComplianceService";

export const complianceRouter = Router();

// POST /api/compliance/pre-call-check
complianceRouter.post("/pre-call-check", requireAuth, async (req, res, next) => {
  const { leadId, purpose, callSessionId } = req.body ?? {};
  const user = (req as any).user;

  if (!leadId || !purpose) {
    res.status(400).json({ error: "leadId and purpose are required" });
    return;
  }

  try {
    const result = await runPreCallChecks({
      leadId,
      agentUserId: user.id,
      purpose,
      callSessionId,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});
