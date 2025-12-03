// apps/api/src/modules/enrollment/routes.ts

import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import {
  requireAuth,
  requireRole,
  Roles,
  type AuthenticatedRequest,
} from "../../middleware/auth";
import {
  getEnrollmentForLead,
  isValidStage,
  upsertEnrollmentForLead,
} from "./service";
import { recordAuditEvent } from "../audit/service";

export const enrollmentRouter = Router();

/**
 * GET /api/enrollment/:leadId
 * Fetch enrollment info for a given lead.
 *
 * Any authenticated user can read enrollment; edits are role-restricted.
 * If no enrollment journey exists yet, we return 200 with `null`.
 */
enrollmentRouter.get(
  "/:leadId",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { leadId } = req.params;

      if (!leadId) {
        res.status(400).json({ error: "leadId is required" });
        return;
      }

      const enrollment = await getEnrollmentForLead(leadId);
      if (!enrollment) {
        res.json(null);
        return;
      }

      res.json({
        id: enrollment.id,
        leadId: enrollment.leadId,
        stage: enrollment.stage,
        notes: enrollment.notes ?? null,
        createdAt: enrollment.createdAt.toISOString(),
        updatedAt: enrollment.updatedAt.toISOString(),
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /api/enrollment/:leadId
 * Create or update enrollment for a given lead.
 *
 * Roles: ADMIN, AGENT, MANAGER, COMPLIANCE_OFFICER
 *
 * Body: { stage: EnrollmentStage, notes?: string }
 *
 * NOTE (future hardening):
 * - Enforce Compliance PASS requirement
 * - More detailed audit diffs
 */
enrollmentRouter.put(
  "/:leadId",
  requireAuth,
  requireRole(
    Roles.ADMIN,
    Roles.AGENT,
    Roles.MANAGER,
    Roles.COMPLIANCE_OFFICER
  ),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { leadId } = req.params;
      const { stage, notes } = req.body ?? {};
      const user = req.user!;

      if (!leadId) {
        res.status(400).json({ error: "leadId is required" });
        return;
      }

      if (!stage || typeof stage !== "string" || !isValidStage(stage)) {
        res.status(400).json({ error: "Valid enrollment stage is required" });
        return;
      }

      // Snapshot previous state for audit purposes
      const previous = await getEnrollmentForLead(leadId);

      const enrollment = await upsertEnrollmentForLead(leadId, {
        stage,
        notes,
      });

      // Audit event — we treat both create and update as "ENROLLMENT_UPDATED"
      await recordAuditEvent({
        userId: user.id,
        leadId,
        eventType: "ENROLLMENT_UPDATED",
        eventData: {
          previous: previous
            ? {
                stage: previous.stage,
                notes: previous.notes ?? null,
              }
            : null,
          next: {
            stage: enrollment.stage,
            notes: enrollment.notes ?? null,
          },
        },
      });

      res.json({
        id: enrollment.id,
        leadId: enrollment.leadId,
        stage: enrollment.stage,
        notes: enrollment.notes ?? null,
        createdAt: enrollment.createdAt.toISOString(),
        updatedAt: enrollment.updatedAt.toISOString(),
      });
    } catch (err) {
      next(err);
    }
  }
);

