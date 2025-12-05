// apps/api/src/modules/activityReports/service.ts
//
// Aggregations for team activity reports (calls, leads, tasks)
// scoped by organization + visible user IDs.

import { prisma } from "../../db/client";

export interface TeamActivityReport {
  calls: {
    total: number;
    byStatus: { status: string; count: number }[];
    byPurpose: { purpose: string; count: number }[];
    byAgent: { agentId: string; callCount: number }[];
  };
  leads: {
    byStatus: { status: string; count: number }[];
  };
  tasks: {
    open: number;
    completed: number;
    cancelled: number;
    overdueOpen: number;
  };
}

interface TeamActivityParams {
  organizationId: string;
  userIds: string[];
  from?: Date;
  to?: Date;
}

/**
 * Compute activity report for calls, leads, and tasks
 * for a given org + list of visible user IDs.
 */
export async function getTeamActivityReport(
  params: TeamActivityParams
): Promise<TeamActivityReport> {
  const { organizationId, userIds, from, to } = params;

  if (!userIds || userIds.length === 0) {
    // No visible users → empty report.
    return {
      calls: {
        total: 0,
        byStatus: [],
        byPurpose: [],
        byAgent: [],
      },
      leads: {
        byStatus: [],
      },
      tasks: {
        open: 0,
        completed: 0,
        cancelled: 0,
        overdueOpen: 0,
      },
    };
  }

  // Calls: scoped by agentId
  const calls = await prisma.callSession.findMany({
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
    select: {
      id: true,
      agentId: true,
      purpose: true,
      status: true,
    },
  });

  // Leads: scoped by assignedToUserId
  const leads = await prisma.lead.findMany({
    where: {
      organizationId,
      assignedToUserId: { in: userIds },
      ...(from || to
        ? {
            updatedAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    },
    select: {
      id: true,
      status: true,
    },
  });

  // Tasks: scoped by assignedToUserId
  const tasks = await prisma.task.findMany({
    where: {
      organizationId,
      assignedToUserId: { in: userIds },
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    },
    select: {
      id: true,
      status: true,
      dueAt: true,
    },
  });

  // --- Calls aggregations ---
  const totalCalls = calls.length;

  const byStatusMap = new Map<string, number>();
  const byPurposeMap = new Map<string, number>();
  const byAgentMap = new Map<string, number>();

  for (const c of calls) {
    const s = c.status || "UNKNOWN";
    byStatusMap.set(s, (byStatusMap.get(s) ?? 0) + 1);

    const p = c.purpose || "UNKNOWN";
    byPurposeMap.set(p, (byPurposeMap.get(p) ?? 0) + 1);

    const agentId = c.agentId || "UNKNOWN";
    byAgentMap.set(agentId, (byAgentMap.get(agentId) ?? 0) + 1);
  }

  const byStatus = Array.from(byStatusMap.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  const byPurpose = Array.from(byPurposeMap.entries())
    .map(([purpose, count]) => ({ purpose, count }))
    .sort((a, b) => b.count - a.count);

  const byAgent = Array.from(byAgentMap.entries())
    .map(([agentId, callCount]) => ({ agentId, callCount }))
    .sort((a, b) => b.callCount - a.callCount);

  // --- Leads aggregation ---
  const leadsStatusMap = new Map<string, number>();
  for (const l of leads) {
    const s = l.status || "UNKNOWN";
    leadsStatusMap.set(s, (leadsStatusMap.get(s) ?? 0) + 1);
  }

  const leadsByStatus = Array.from(leadsStatusMap.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  // --- Tasks aggregation ---
  let open = 0;
  let completed = 0;
  let cancelled = 0;
  let overdueOpen = 0;
  const now = new Date();

  for (const t of tasks) {
    const status = t.status || "UNKNOWN";
    const isCompleted = status === "COMPLETED";
    const isCancelled = status === "CANCELLED";
    const isOpen = !isCompleted && !isCancelled;

    if (isCompleted) completed += 1;
    else if (isCancelled) cancelled += 1;
    else open += 1;

    if (isOpen && t.dueAt && t.dueAt < now) {
      overdueOpen += 1;
    }
  }

  return {
    calls: {
      total: totalCalls,
      byStatus,
      byPurpose,
      byAgent,
    },
    leads: {
      byStatus: leadsByStatus,
    },
    tasks: {
      open,
      completed,
      cancelled,
      overdueOpen,
    },
  };
}

