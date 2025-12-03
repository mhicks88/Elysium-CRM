// apps/api/src/modules/callScripts/routes.ts
//
// Express routes for Interactive Call Scripts.
// Phase 0: basic endpoints for listing scripts, starting runs
// with pre-call compliance gating, stepping through, ending runs,
// and viewing prior runs per lead.

import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../../middleware/auth";
import {
  listActiveScriptsForOrg,
  getScriptById,
  resolveScriptForPurpose,
  startScriptRun,
  stepScriptRun,
  endScriptRun,
  getScriptRunsForLead,
} from "./service";
import { recordAuditEvent } from "../audit/service";
import { runPreCallChecks } from "../compliance/preCallComplianceService";
import { recordComplianceCheck } from "../complianceHistory/service";

export const callScriptsRouter = Router();

/**
 * GET /api/call-scripts
 * Optional query: ?purpose=INITIAL_OUTREACH
 *
 * Lists active scripts for the current organization.
 */
callScriptsRouter.get(
  "/",
  requireAuth,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const orgId = req.user!.organizationId;
      const { purpose } = req.query;

      const scripts = await listActiveScriptsForOrg({
        organizationId: orgId,
        purpose: typeof purpose === "string" ? purpose : undefined,
      });

      return res.json({ scripts });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/call-scripts/:scriptId
 *
 * Fetch a single script (with nodes/options) by id.
 */
callScriptsRouter.get(
  "/:scriptId",
  requireAuth,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const orgId = req.user!.organizationId;
      const { scriptId } = req.params;

      const script = await getScriptById({
        organizationId: orgId,
        scriptId,
      });

      if (!script) {
        return res.status(404).json({ error: "Script not found" });
      }

      return res.json({ script });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/call-scripts/start
 *
 * Starts a new script run for a lead.
 * Body:
 *   {
 *     "leadId": "lead-id",
 *     "scriptId": "script-id"        // OR
 *     "purpose": "MARKETING"         // used for compliance + optional script resolution
 *   }
 *
 * Infra behavior:
 * - Requires leadId and either scriptId or purpose
 * - Runs pre-call compliance via runPreCallChecks
 * - If FAIL → 400 with { error, compliance }
 * - If PASS → records compliance audit/history and starts script run
 */
callScriptsRouter.post(
  "/start",
  requireAuth,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const orgId = req.user!.organizationId;
      const userId = req.user!.id;
      const { leadId, scriptId, purpose } = req.body ?? {};

      if (!leadId) {
        return res.status(400).json({ error: "leadId is required" });
      }

      if (
        (typeof scriptId !== "string" || scriptId.length === 0) &&
        (typeof purpose !== "string" || purpose.length === 0)
      ) {
        return res.status(400).json({
          error:
            "Either scriptId or purpose is required to start a scripted call",
        });
      }

      if (typeof purpose !== "string" || purpose.length === 0) {
        // For now we *require* a purpose for compliance purposes.
        return res
          .status(400)
          .json({ error: "purpose is required to start a scripted call" });
      }

      // 1️⃣ Run pre-call compliance checks for this lead + purpose.
      // PlannedCallPurpose is a union type; we cast here because script purposes
      // may be broader in the future. Compliance logic itself only branches
      // on known values (MARKETING/ENROLLMENT/etc.).
      const complianceResult = await runPreCallChecks({
        leadId,
        agentUserId: userId,
        purpose: purpose as any,
        callSessionId: undefined,
      });

      // Record high-level compliance event in Audit
      await recordAuditEvent({
        userId,
        leadId,
        eventType: "COMPLIANCE_CHECK_BEFORE_SCRIPT",
        eventData: {
          purpose,
          result: complianceResult,
        },
      });

      // Record structured compliance history entry
      await recordComplianceCheck({
        leadId,
        userId,
        purpose,
        status: complianceResult.status, // PASS / FAIL
        result: complianceResult,
      });

      if (complianceResult.status === "FAIL") {
        // Block script start if compliance fails.
        return res.status(400).json({
          error: "Pre-call compliance failed; scripted call cannot be started.",
          compliance: complianceResult,
        });
      }

      // 2️⃣ Resolve which script to use (same behavior as before).
      let scriptIdToUse: string | null = null;

      if (typeof scriptId === "string" && scriptId.length > 0) {
        scriptIdToUse = scriptId;
      } else {
        const script = await resolveScriptForPurpose({
          organizationId: orgId,
          purpose,
        });
        if (!script) {
          return res
            .status(400)
            .json({ error: "No active script found for that purpose" });
        }
        scriptIdToUse = script.id;
      }

      const { runId, script, currentNode } = await startScriptRun({
        organizationId: orgId,
        scriptId: scriptIdToUse,
        leadId,
        agentId: userId,
      });

      // 3️⃣ Audit: script run started
      await recordAuditEvent({
        userId,
        leadId,
        eventType: "CALL_SCRIPT_RUN_STARTED",
        eventData: {
          runId,
          scriptId: script.id,
          purpose: script.purpose,
        },
      });

      return res.status(201).json({
        runId,
        script,
        currentNode,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/call-scripts/runs/:runId/step
 *
 * Advance a script run by selecting an option.
 * Body:
 *   { "optionId": "option-id" }
 */
callScriptsRouter.post(
  "/runs/:runId/step",
  requireAuth,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const userId = req.user!.id;
      const { runId } = req.params;
      const { optionId } = req.body ?? {};

      if (!optionId) {
        return res.status(400).json({ error: "optionId is required" });
      }

      const result = await stepScriptRun({
        runId,
        optionId,
      });

      // Audit: script step
      await recordAuditEvent({
        userId,
        leadId: null,
        eventType: "CALL_SCRIPT_STEP",
        eventData: {
          runId: result.runId,
          optionId,
          newStatus: result.status,
          nextNodeId: result.currentNode?.id ?? null,
        },
      }).catch(() => {
        // Don't break the call if audit logging fails.
      });

      return res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/call-scripts/runs/:runId/end
 *
 * Explicitly end a script run.
 * Body:
 *   {
 *     "outcome": "INTERESTED" | "NOT_INTERESTED" | ...,
 *     "status": "COMPLETED" | "ABANDONED"       // optional, default COMPLETED
 *   }
 */
callScriptsRouter.post(
  "/runs/:runId/end",
  requireAuth,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const userId = req.user!.id;
      const { runId } = req.params;
      const { outcome, status } = req.body ?? {};

      await endScriptRun({
        runId,
        outcome: typeof outcome === "string" ? outcome : undefined,
        status: typeof status === "string" ? (status as any) : undefined,
      });

      // Audit: script run ended
      await recordAuditEvent({
        userId,
        leadId: null,
        eventType: "CALL_SCRIPT_RUN_ENDED",
        eventData: {
          runId,
          outcome: outcome ?? null,
          status: status ?? "COMPLETED",
        },
      }).catch(() => {});

      return res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/call-scripts/leads/:leadId/runs
 *
 * Returns recent script runs for a lead, for history views.
 */
callScriptsRouter.get(
  "/leads/:leadId/runs",
  requireAuth,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const orgId = req.user!.organizationId;
      const { leadId } = req.params;

      if (!leadId) {
        return res.status(400).json({ error: "leadId is required" });
      }

      const runs = await getScriptRunsForLead({
        organizationId: orgId,
        leadId,
      });

      return res.json({ runs });
    } catch (err) {
      next(err);
    }
  }
);

