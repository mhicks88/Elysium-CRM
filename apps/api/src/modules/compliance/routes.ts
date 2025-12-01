import { Router } from "express";

import {
  requireAuth,
  requireRole,
  Roles,
  AuthenticatedRequest,
} from "../../middleware/auth";
import { runPreCallChecks } from "./preCallComplianceService";

export const complianceRouter = Router();

// POST /api/compliance/pre-call-check
complianceRouter.post(
  "/pre-call-check",
  requireAuth,
  requireRole(Roles.ADMIN, Roles.AGENT),
  async (req, res, next) => {
    const { leadId, purpose, callSessionId } = req.body ?? {};
    const user = (req as AuthenticatedRequest).user;

    if (!leadId || !purpose) {
      res
        .status(400)
        .json({ error: "leadId and purpose are required" });
      return;
    }

    if (!user) {
      res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "Missing auth context" },
      });
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
  }
);

