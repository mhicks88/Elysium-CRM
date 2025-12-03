// apps/api/src/modules/complianceAdmin/routes.ts
//
// HTTP routes for admin compliance analytics.

import { Router } from "express";
import {
  requireAuth,
  requireRole,
  Roles,
  type AuthenticatedRequest,
} from "../../middleware/auth";
import {
  getComplianceStatsByAgent,
  getComplianceSummary,
  getRecentFailures,
} from "./service";

export const complianceAdminRouter = Router();

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
 * GET /api/compliance/admin/summary
 *
 * Shape matches apiClient.getComplianceSummary:
 * {
 *   totalChecks,
 *   passCount,
 *   failCount,
 *   failRate,
 *   purposes: { [purpose]: { total, pass, fail } },
 *   firstCheckAt: string | null,
 *   lastCheckAt: string | null
 * }
 */
complianceAdminRouter.get(
  "/summary",
  requireAuth,
  requireRole(Roles.ADMIN, Roles.MANAGER, Roles.COMPLIANCE_OFFICER),
  async (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    const from = parseDateParam(req.query.from);
    const to = parseDateParam(req.query.to);

    const summary = await getComplianceSummary({
      organizationId: user.organizationId,
      from,
      to,
    });

    res.json({
      totalChecks: summary.totalChecks,
      passCount: summary.passCount,
      failCount: summary.failCount,
      failRate: summary.failRate,
      purposes: summary.purposes,
      firstCheckAt: summary.firstCheckAt
        ? summary.firstCheckAt.toISOString()
        : null,
      lastCheckAt: summary.lastCheckAt
        ? summary.lastCheckAt.toISOString()
        : null,
    });
  }
);

/**
 * GET /api/compliance/admin/by-agent
 *
 * Shape matches apiClient.getComplianceStatsByAgent:
 * { agents: [{ userId, total, pass, fail }] }
 */
complianceAdminRouter.get(
  "/by-agent",
  requireAuth,
  requireRole(Roles.ADMIN, Roles.MANAGER, Roles.COMPLIANCE_OFFICER),
  async (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    const from = parseDateParam(req.query.from);
    const to = parseDateParam(req.query.to);

    const agents = await getComplianceStatsByAgent({
      organizationId: user.organizationId,
      from,
      to,
    });

    res.json({
      agents,
    });
  }
);

/**
 * GET /api/compliance/admin/recent-failures?limit=20
 *
 * Shape matches apiClient.getRecentComplianceFailures:
 * { failures: [{ id, leadId, userId, purpose, status, result, createdAt }] }
 *
 * (Currently apiClient only sends `limit`; we also support from/to for future use.)
 */
complianceAdminRouter.get(
  "/recent-failures",
  requireAuth,
  requireRole(Roles.ADMIN, Roles.MANAGER, Roles.COMPLIANCE_OFFICER),
  async (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    const from = parseDateParam(req.query.from);
    const to = parseDateParam(req.query.to);

    const limitParam = req.query.limit;
    let limit = 20;
    if (typeof limitParam === "string") {
      const parsed = parseInt(limitParam, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        limit = parsed;
      }
    }

    const failures = await getRecentFailures({
      organizationId: user.organizationId,
      from,
      to,
      limit,
    });

    res.json({
      failures: failures.map((f) => ({
        id: f.id,
        leadId: f.leadId,
        userId: f.userId,
        purpose: f.purpose,
        status: f.status,
        result: f.result,
        createdAt: f.createdAt.toISOString(),
      })),
    });
  }
);

