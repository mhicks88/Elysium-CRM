// apps/api/src/modules/audit/routes.ts

import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../../middleware/auth";
import { getAuditEventsForLead } from "./service";

export const auditRouter = Router();

/**
 * GET /api/audit/:leadId
 *
 * Returns audit events for a given lead in the current user's organization.
 * Supports optional pagination via ?limit=100&cursor=<eventId>.
 */
auditRouter.get(
  "/:leadId",
  requireAuth,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { leadId } = req.params;
      const { limit, cursor } = req.query;

      if (!leadId) {
        return res.status(400).json({ error: "leadId is required" });
      }

      // requireAuth guarantees req.user is set
      const orgId = req.user!.organizationId;

      const parsedLimit =
        typeof limit === "string"
          ? Math.min(Math.max(parseInt(limit, 10) || 0, 1), 200)
          : 100;

      const result = await getAuditEventsForLead({
        organizationId: orgId,
        leadId,
        limit: parsedLimit,
        cursor: typeof cursor === "string" ? cursor : undefined,
      });

      return res.json({
        events: result.events,
        nextCursor: result.nextCursor,
      });
    } catch (err) {
      next(err);
    }
  }
);

