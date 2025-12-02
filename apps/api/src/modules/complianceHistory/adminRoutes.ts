import { Router } from "express";
import {
  requireAuth,
  requireRole,
  Roles,
  type AuthenticatedRequest,
} from "../../middleware/auth";
import { listAllComplianceChecks } from "./service";

export const complianceAdminRouter = Router();

// Helper: filter by date range
function filterByDate(
  records: any[],
  from?: string | null,
  to?: string | null
) {
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;

  return records.filter((r) => {
    const t = r.createdAt.getTime();
    if (fromDate && t < fromDate.getTime()) return false;
    if (toDate && t > toDate.getTime()) return false;
    return true;
  });
}

// GET /api/compliance/admin/summary
complianceAdminRouter.get(
  "/summary",
  requireAuth,
  requireRole(Roles.ADMIN),
  async (req: AuthenticatedRequest, res) => {
    const { from, to } = req.query as {
      from?: string;
      to?: string;
    };

    const all = await listAllComplianceChecks();
    const filtered = filterByDate(all, from, to);

    const totalChecks = filtered.length;
    const passCount = filtered.filter((c) => c.status === "PASS").length;
    const failCount = filtered.filter((c) => c.status === "FAIL").length;
    const failRate = totalChecks > 0 ? failCount / totalChecks : 0;

    const purposes: Record<
      string,
      { total: number; pass: number; fail: number }
    > = {};

    for (const c of filtered) {
      const key = c.purpose || "UNKNOWN";
      if (!purposes[key]) {
        purposes[key] = { total: 0, pass: 0, fail: 0 };
      }
      purposes[key].total++;
      if (c.status === "PASS") purposes[key].pass++;
      if (c.status === "FAIL") purposes[key].fail++;
    }

    const firstCheckAt =
      filtered.length > 0
        ? filtered[0].createdAt.toISOString()
        : null;
    const lastCheckAt =
      filtered.length > 0
        ? filtered[filtered.length - 1].createdAt.toISOString()
        : null;

    return res.json({
      totalChecks,
      passCount,
      failCount,
      failRate,
      purposes,
      firstCheckAt,
      lastCheckAt,
    });
  }
);

// GET /api/compliance/admin/by-agent
complianceAdminRouter.get(
  "/by-agent",
  requireAuth,
  requireRole(Roles.ADMIN),
  async (req: AuthenticatedRequest, res) => {
    const { from, to } = req.query as {
      from?: string;
      to?: string;
    };

    const all = await listAllComplianceChecks();
    const filtered = filterByDate(all, from, to);

    const byAgent: Record<
      string,
      { userId: string; total: number; pass: number; fail: number }
    > = {};

    for (const c of filtered) {
      const key = c.userId || "UNKNOWN";
      if (!byAgent[key]) {
        byAgent[key] = { userId: key, total: 0, pass: 0, fail: 0 };
      }
      byAgent[key].total++;
      if (c.status === "PASS") byAgent[key].pass++;
      if (c.status === "FAIL") byAgent[key].fail++;
    }

    return res.json({
      agents: Object.values(byAgent),
    });
  }
);

// GET /api/compliance/admin/recent-failures?limit=20
complianceAdminRouter.get(
  "/recent-failures",
  requireAuth,
  requireRole(Roles.ADMIN),
  async (req: AuthenticatedRequest, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : 20;

    const all = await listAllComplianceChecks();
    const failures = all.filter((c) => c.status === "FAIL");

    failures.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );

    const sliced = failures.slice(0, limit).map((f) => ({
      ...f,
      createdAt: f.createdAt.toISOString(),
    }));

    return res.json({ failures: sliced });
  }
);

