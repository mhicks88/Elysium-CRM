// apps/api/src/modules/complianceAdmin/service.ts
//
// Aggregation logic for admin compliance analytics, based on
// the DB-backed complianceHistory service.

import {
  listAllComplianceChecks,
  type ComplianceCheckRecord,
} from "../complianceHistory/service";

export interface ComplianceSummary {
  totalChecks: number;
  passCount: number;
  failCount: number;
  failRate: number; // 0–1
  purposes: Record<
    string,
    {
      total: number;
      pass: number;
      fail: number;
    }
  >;
  firstCheckAt: Date | null;
  lastCheckAt: Date | null;
}

export interface AgentStats {
  userId: string;
  total: number;
  pass: number;
  fail: number;
}

export interface RecentFailure {
  id: string;
  leadId: string;
  userId: string;
  purpose: string;
  status: "PASS" | "FAIL";
  result: any;
  createdAt: Date;
}

interface FilterParams {
  organizationId: string;
  from?: Date;
  to?: Date;
  /**
   * Optional list of userIds whose checks should be included.
   * If omitted, all users in the org are considered.
   */
  userIds?: string[];
}

/**
 * Apply organization + date (+ userIds) filters to all compliance checks.
 */
async function getFilteredChecks(
  params: FilterParams
): Promise<ComplianceCheckRecord[]> {
  const { organizationId, from, to, userIds } = params;
  const all = await listAllComplianceChecks();

  const allowedUserIdSet =
    userIds && userIds.length > 0 ? new Set(userIds) : null;

  return all.filter((c) => {
    if (c.organizationId !== organizationId) return false;
    if (from && c.createdAt < from) return false;
    if (to && c.createdAt > to) return false;

    if (allowedUserIdSet) {
      // If we are scoping by user IDs, only include checks
      // where userId is in the allowed set.
      if (!c.userId) return false;
      if (!allowedUserIdSet.has(c.userId)) return false;
    }

    return true;
  });
}

/**
 * Compute compliance summary from filtered checks.
 */
export async function getComplianceSummary(
  params: FilterParams
): Promise<ComplianceSummary> {
  const checks = await getFilteredChecks(params);

  const totalChecks = checks.length;
  const passCount = checks.filter((c) => c.status === "PASS").length;
  const failCount = checks.filter((c) => c.status === "FAIL").length;
  const failRate = totalChecks > 0 ? failCount / totalChecks : 0;

  const purposes: ComplianceSummary["purposes"] = {};

  for (const check of checks) {
    const key = check.purpose || "UNKNOWN";
    if (!purposes[key]) {
      purposes[key] = { total: 0, pass: 0, fail: 0 };
    }
    purposes[key].total += 1;
    if (check.status === "PASS") {
      purposes[key].pass += 1;
    } else if (check.status === "FAIL") {
      purposes[key].fail += 1;
    }
  }

  let firstCheckAt: Date | null = null;
  let lastCheckAt: Date | null = null;

  for (const c of checks) {
    if (!firstCheckAt || c.createdAt < firstCheckAt) {
      firstCheckAt = c.createdAt;
    }
    if (!lastCheckAt || c.createdAt > lastCheckAt) {
      lastCheckAt = c.createdAt;
    }
  }

  return {
    totalChecks,
    passCount,
    failCount,
    failRate,
    purposes,
    firstCheckAt,
    lastCheckAt,
  };
}

/**
 * Aggregate checks by user (agent), filtered by org, dates, and optional userIds.
 * Shape matches apiClient.getComplianceStatsByAgent response:
 * { agents: [{ userId, total, pass, fail }] }
 */
export async function getComplianceStatsByAgent(
  params: FilterParams
): Promise<AgentStats[]> {
  const checks = await getFilteredChecks(params);

  const map = new Map<string, AgentStats>();

  for (const c of checks) {
    const userId = c.userId || "UNKNOWN";
    let stats = map.get(userId);
    if (!stats) {
      stats = { userId, total: 0, pass: 0, fail: 0 };
      map.set(userId, stats);
    }
    stats.total += 1;
    if (c.status === "PASS") stats.pass += 1;
    if (c.status === "FAIL") stats.fail += 1;
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

/**
 * Most recent failed checks, filtered by org + dates + optional userIds.
 * Shape matches apiClient.getRecentComplianceFailures response:
 * { failures: [{ id, leadId, userId, purpose, status, result, createdAt }] }
 */
export async function getRecentFailures(
  params: FilterParams & { limit: number }
): Promise<RecentFailure[]> {
  const { limit, ...rest } = params;
  const checks = await getFilteredChecks(rest);

  const failures = checks
    .filter((c) => c.status === "FAIL")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit)
    .map((c: ComplianceCheckRecord): RecentFailure => ({
      id: c.id,
      leadId: c.leadId,
      userId: c.userId,
      purpose: c.purpose,
      // We only kept FAIL records above, so this is always FAIL.
      status: "FAIL",
      result: c.result,
      createdAt: c.createdAt,
    }));

  return failures;
}

