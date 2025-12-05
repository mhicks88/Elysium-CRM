// apps/api/src/modules/activityReports/routes.ts
//
// HTTP routes for team activity reports (calls, leads, tasks)
// scoped by org + role-based user visibility.

import { Router } from "express";
import {
  requireAuth,
  requireRole,
  Roles,
  type AuthenticatedRequest,
} from "../../middleware/auth";
import {
  getTeamActivityReport,
  type TeamActivityReport,
} from "./service";
import { getVisibleUserIdsForUser } from "../auth/visibility";

export const activityReportsRouter = Router();

/**
 * Parse from/to query params into Date | undefined.
 */
function parseDateParam(value: unknown): Date | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

/**
 * GET /api/reports/activity
 *
 * Returns a TeamActivityReport scoped to:
 *  - the current user's organization, and
 *  - the set of visible users (based on role: ADMIN, MANAGER, COMPLIANCE).
 */
activityReportsRouter.get(
  "/",
  requireAuth,
  requireRole(Roles.ADMIN, Roles.MANAGER, Roles.COMPLIANCE_OFFICER),
  async (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    const from = parseDateParam(req.query.from);
    const to = parseDateParam(req.query.to);

    const userIds = await getVisibleUserIdsForUser({
      id: user.id,
      role: user.role as any,
    });

    const report: TeamActivityReport = await getTeamActivityReport({
      organizationId: user.organizationId,
      userIds,
      from,
      to,
    });

    res.json(report);
  }
);

