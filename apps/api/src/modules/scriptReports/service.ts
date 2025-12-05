// apps/api/src/modules/scriptReports/service.ts
//
// Aggregations for script usage reports based on CallScriptRun,
// scoped by organization + visible user IDs.

import { prisma } from "../../db/client";

export interface ScriptUsageRow {
  scriptId: string;
  scriptName: string;
  purpose: string;
  isActive: boolean;
  runCount: number;
  completedCount: number;
  abandonedCount: number;
  completionRate: number; // 0–1
  lastRunAt: Date | null;
}

interface ScriptUsageParams {
  organizationId: string;
  userIds: string[];
  from?: Date;
  to?: Date;
}

/**
 * Compute script usage report for an org + list of visible user IDs.
 */
export async function getScriptUsageReport(
  params: ScriptUsageParams
): Promise<ScriptUsageRow[]> {
  const { organizationId, userIds, from, to } = params;

  if (!userIds || userIds.length === 0) {
    return [];
  }

  const runs = await prisma.callScriptRun.findMany({
    where: {
      organizationId,
      agentId: { in: userIds },
      ...(from || to
        ? {
            startedAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    },
    include: {
      script: true,
    },
    orderBy: {
      startedAt: "desc",
    },
  });

  if (runs.length === 0) {
    return [];
  }

  const map = new Map<string, ScriptUsageRow>();

  for (const r of runs) {
    if (!r.script) continue;
    const key = r.scriptId;
    let row = map.get(key);
    if (!row) {
      row = {
        scriptId: r.scriptId,
        scriptName: r.script.name,
        purpose: r.script.purpose,
        isActive: r.script.isActive,
        runCount: 0,
        completedCount: 0,
        abandonedCount: 0,
        completionRate: 0,
        lastRunAt: null,
      };
      map.set(key, row);
    }

    row.runCount += 1;

    if (r.status === "COMPLETED") {
      row.completedCount += 1;
    } else if (r.status === "ABANDONED") {
      row.abandonedCount += 1;
    }

    if (
      !row.lastRunAt ||
      r.startedAt.getTime() > row.lastRunAt.getTime()
    ) {
      row.lastRunAt = r.startedAt;
    }
  }

  // Compute completion rate
  for (const row of map.values()) {
    row.completionRate =
      row.runCount > 0 ? row.completedCount / row.runCount : 0;
  }

  return Array.from(map.values()).sort(
    (a, b) => (b.lastRunAt?.getTime() ?? 0) - (a.lastRunAt?.getTime() ?? 0)
  );
}

