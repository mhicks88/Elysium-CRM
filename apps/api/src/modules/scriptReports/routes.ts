// apps/api/src/modules/scriptReports/routes.ts
//
// HTTP routes for script usage reports, scoped by org + role-based visibility.

import { Router } from "express";
import {
  requireAuth,
  requireRole,
  Roles,
  type AuthenticatedRequest,
} from "../../middleware/auth";
import {
  getScriptUsageReport,
  type ScriptUsageRow,
} from "./service";
import { getVisibleUserIdsForUser } from "../auth/visibility";

export const scriptReportsRouter = Router();

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
 * GET /api/reports/scripts/usage
 *
 * Returns script usage stats for the current user's scoped view:
 * { scripts: [{ scriptId, scriptName, purpose, isActive, runCount, completedCount, abandonedCount, completionRate, lastRunAt }] }
 *
 * Visibility:
 *  - ADMIN / COMPLIANCE_OFFICER: org-wide
 *  - MANAGER: only runs by manager + their agents
 */
scriptReportsRouter.get(
  "/usage",
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

    const rows: ScriptUsageRow[] = await getScriptUsageReport({
      organizationId: user.organizationId,
      userIds,
      from,
      to,
    });

    res.json({ scripts: rows });
  }
);

