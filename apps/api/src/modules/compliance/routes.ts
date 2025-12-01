import { Router } from "express";
import {
  requireAuth,
  requireRole,
  Roles,
  type AuthenticatedRequest,
} from "../../middleware/auth";
import { runPreCallChecks } from "./preCallComplianceService";
import { recordAuditEvent } from "../audit/service";

export const complianceRouter = Router();

// POST /api/compliance/pre-call-check
complianceRouter.post(
  "/pre-call-check",
  requireAuth,
  requireRole(Roles.ADMIN, Roles.AGENT),
  async (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    const { leadId, purpose, callSessionId } = req.body ?? {};

    if (!leadId || !purpose) {
      return res
        .status(400)
        .json({ error: "leadId and purpose are required" });
    }

    try {
      const result = await runPreCallChecks({
        leadId,
        agentUserId: user.id,              // 👈 renamed from userId → agentUserId
        purpose,
        callSessionId: callSessionId ?? null,
      });

      // Audit: compliance check
      await recordAuditEvent({
        userId: user.id,
        leadId,
        eventType: "COMPLIANCE_CHECK",
        eventData: {
          purpose,
          callSessionId: callSessionId ?? null,
          result,
        },
      });

      return res.json(result);
    } catch (err: any) {
      return res
        .status(400)
        .json({ error: err?.message || "Failed to run compliance check" });
    }
  }
);

