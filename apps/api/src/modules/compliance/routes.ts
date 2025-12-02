import { Router } from "express";
import {
  requireAuth,
  requireRole,
  Roles,
  type AuthenticatedRequest,
} from "../../middleware/auth";
import { runPreCallChecks } from "./preCallComplianceService";
import { recordAuditEvent } from "../audit/service";
import { recordComplianceCheck } from "../complianceHistory/service";

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
      // Run compliance logic
      const result = await runPreCallChecks({
        leadId,
        agentUserId: user.id, // correct parameter for preCallComplianceService
        purpose,
        callSessionId: callSessionId ?? null,
      });

      // 1️⃣ AUDIT EVENT (high-level activity)
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

      // 2️⃣ STRUCTURED COMPLIANCE HISTORY RECORD
      await recordComplianceCheck({
        leadId,
        userId: user.id,
        purpose,
        status: result.status, // PASS / FAIL
        result,
      });

      return res.json(result);
    } catch (err: any) {
      return res
        .status(400)
        .json({ error: err?.message || "Failed to run compliance check" });
    }
  }
);

