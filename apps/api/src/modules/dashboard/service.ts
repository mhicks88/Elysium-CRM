// apps/api/src/modules/dashboard/service.ts
//
// Dashboard service: aggregates data for different roles (AGENT, MANAGER, DIRECTOR, ADMIN).
// Team semantics:
//   - AGENT: only their own leads/tasks/compliance/script runs.
//   - MANAGER: limited to their agents (and optionally themselves).
//   - DIRECTOR: limited to their managers + those managers' agents (and themselves).
//   - ADMIN: full org-wide view.
// COMPLIANCE and READ_ONLY currently get an org-wide manager-style view.

import { prisma } from "../../db/client";

export type DashboardRole =
  | "ADMIN"
  | "MANAGER"
  | "DIRECTOR"
  | "AGENT"
  | "COMPLIANCE"
  | "READ_ONLY";

export interface AgentDashboardData {
  role: "AGENT";
  cards: {
    leadsNeedingAttention: {
      count: number;
    };
    tasksDueTodayOrOverdue: {
      count: number;
    };
    recentComplianceFailures: {
      items: {
        id: string;
        leadId: string;
        purpose: string;
        createdAt: string;
      }[];
    };
    recentScriptRuns: {
      items: {
        id: string;
        leadId: string;
        status: string;
        outcome: string | null;
        startedAt: string;
      }[];
    };
  };
}

// Shared card shape for MANAGER / ADMIN / DIRECTOR dashboards
interface ManagerAdminDashboardCards {
  teamComplianceSummary: {
    totalChecks: number;
    passCount: number;
    failCount: number;
    passRate: number; // 0–1
  };
  overdueTasks: {
    count: number;
  };
  leadDistributionByStatus: {
    status: string;
    count: number;
  }[];
  highRiskLeads: {
    items: {
      leadId: string;
      failCount: number;
    }[];
  };
  recentLeadImports: {
    items: {
      id: string;
      createdAt: string;
      totalRows: number;
      insertedCount: number;
      duplicateCount: number;
      errorCount: number;
      label: string | null;
      source: string | null;
    }[];
  };
}

export interface ManagerDashboardData {
  role: "MANAGER";
  cards: ManagerAdminDashboardCards;
}

export interface AdminDashboardData {
  role: "ADMIN";
  cards: ManagerAdminDashboardCards;
}

export interface DirectorDashboardData {
  role: "DIRECTOR";
  cards: ManagerAdminDashboardCards;
}

export type DashboardData =
  | AgentDashboardData
  | ManagerDashboardData
  | AdminDashboardData
  | DirectorDashboardData;

/**
 * Agent dashboard: scoped to the current user (agent).
 */
export async function getAgentDashboard(params: {
  organizationId: string;
  userId: string;
}): Promise<AgentDashboardData> {
  const { organizationId, userId } = params;

  // Leads needing attention: basic heuristic for now
  const leadsNeedingAttentionCount = await prisma.lead.count({
    where: {
      organizationId,
      assignedToUserId: userId,
      status: {
        in: [
          "NEW",
          "CONTACT_ATTEMPTED",
          "CONTACTED",
          "SOA_REQUIRED",
          "SOA_COMPLETED",
          "IN_DISCUSSION",
        ] as any,
      },
    },
  });

  // Tasks due today or overdue
  const now = new Date();
  const tasksDueCount = await prisma.task.count({
    where: {
      organizationId,
      assignedToUserId: userId,
      status: {
        in: ["OPEN", "IN_PROGRESS"] as any,
      },
      dueAt: {
        not: null,
        lte: now,
      },
    },
  });

  // Recent compliance failures by this agent
  const recentComplianceFailuresRaw = await prisma.complianceCheck.findMany({
    where: {
      organizationId,
      userId,
      status: "FAIL",
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 5,
  });

  const recentComplianceFailures = recentComplianceFailuresRaw.map((c: any) => ({
    id: c.id,
    leadId: c.leadId,
    purpose: c.purpose,
    createdAt: c.createdAt.toISOString(),
  }));

  // Recent script runs by this agent
  const recentScriptRunsRaw = await prisma.callScriptRun.findMany({
    where: {
      organizationId,
      agentId: userId,
    },
    orderBy: {
      startedAt: "desc",
    },
    take: 5,
  });

  const recentScriptRuns = recentScriptRunsRaw.map((r: any) => ({
    id: r.id,
    leadId: r.leadId,
    status: r.status,
    outcome: r.outcome,
    startedAt: r.startedAt.toISOString(),
  }));

  return {
    role: "AGENT",
    cards: {
      leadsNeedingAttention: {
        count: leadsNeedingAttentionCount,
      },
      tasksDueTodayOrOverdue: {
        count: tasksDueCount,
      },
      recentComplianceFailures: {
        items: recentComplianceFailures,
      },
      recentScriptRuns: {
        items: recentScriptRuns,
      },
    },
  };
}

/**
 * Compute the set of userIds that a manager or director "owns".
 *
 * - For MANAGER: [managerId, all agents where user.managerId = managerId]
 * - For DIRECTOR: [directorId, managers where directorId = directorId, agents under those managers]
 *
 * For ADMIN: returns null to indicate "org-wide".
 */
async function getTeamUserIdsForRole(params: {
  organizationId: string;
  role: "MANAGER" | "DIRECTOR" | "ADMIN";
  userId: string;
}): Promise<string[] | null> {
  const { organizationId, role, userId } = params;

  if (role === "ADMIN") {
    return null; // org-wide
  }

  if (role === "MANAGER") {
    const agents = await prisma.user.findMany({
      where: {
        organizationId,
        managerId: userId,
      },
      select: { id: true },
    });

    const teamIds = [userId, ...agents.map((a) => a.id)];
    return teamIds;
  }

  // DIRECTOR
  const managers = await prisma.user.findMany({
    where: {
      organizationId,
      directorId: userId,
    },
    select: { id: true },
  });
  const managerIds = managers.map((m) => m.id);

  const agents = await prisma.user.findMany({
    where: {
      organizationId,
      managerId: {
        in: managerIds.length > 0 ? managerIds : ["__none__"],
      },
    },
    select: { id: true },
  });

  const agentIds = agents.map((a) => a.id);

  const teamIds = [userId, ...managerIds, ...agentIds];
  return teamIds;
}

/**
 * Manager/Admin/Director dashboard with team-aware scoping.
 */
export async function getManagerAdminDirectorDashboard(params: {
  organizationId: string;
  role: "MANAGER" | "ADMIN" | "DIRECTOR";
  userId: string;
}): Promise<ManagerDashboardData | AdminDashboardData | DirectorDashboardData> {
  const { organizationId, role, userId } = params;

  const teamUserIds = await getTeamUserIdsForRole({
    organizationId,
    role,
    userId,
  });

  // Compliance summary
  const allChecks = await prisma.complianceCheck.groupBy({
    by: ["status"],
    where: {
      organizationId,
      ...(teamUserIds
        ? {
            userId: {
              in: teamUserIds,
            },
          }
        : {}),
    },
    _count: {
      _all: true,
    },
  });

  const totalChecks = allChecks.reduce(
    (sum: number, row: any) => sum + row._count._all,
    0
  );
  const passRow = allChecks.find((r: any) => r.status === "PASS");
  const failRow = allChecks.find((r: any) => r.status === "FAIL");
  const passCount = passRow?._count._all ?? 0;
  const failCount = failRow?._count._all ?? 0;
  const passRate = totalChecks > 0 ? passCount / totalChecks : 0;

  // Overdue tasks: scoped to team if applicable
  const now = new Date();
  const overdueTasksCount = await prisma.task.count({
    where: {
      organizationId,
      status: {
        in: ["OPEN", "IN_PROGRESS"] as any,
      },
      dueAt: {
        not: null,
        lte: now,
      },
      ...(teamUserIds
        ? {
            assignedToUserId: {
              in: teamUserIds,
            },
          }
        : {}),
    },
  });

  // Lead distribution by status (scoped by assignee team)
  const leadDistributionRaw = await prisma.lead.groupBy({
    by: ["status"],
    where: {
      organizationId,
      ...(teamUserIds
        ? {
            assignedToUserId: {
              in: teamUserIds,
            },
          }
        : {}),
    },
    _count: {
      _all: true,
    },
  });

  const leadDistribution = leadDistributionRaw.map((row: any) => ({
    status: row.status,
    count: row._count._all,
  }));

  // High-risk leads: leads with multiple FAIL compliance checks
  const highRiskRaw = await prisma.complianceCheck.groupBy({
    by: ["leadId"],
    where: {
      organizationId,
      status: "FAIL",
      ...(teamUserIds
        ? {
            userId: {
              in: teamUserIds,
            },
          }
        : {}),
    },
    _count: {
      _all: true,
    },
  });

  const topHighRisk = highRiskRaw
    .sort((a: any, b: any) => b._count._all - a._count._all)
    .slice(0, 10);

  const highRiskLeads = topHighRisk.map((row: any) => ({
    leadId: row.leadId,
    failCount: row._count._all,
  }));

  // Recent lead imports from AuditEvent (eventType = LEAD_IMPORT)
  // We keep this org-wide for now, since imports are typically global ops.
  const recentImportsRaw = await prisma.auditEvent.findMany({
    where: {
      organizationId,
      eventType: "LEAD_IMPORT",
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 5,
  });

  const recentLeadImports = recentImportsRaw.map((e: any) => {
    const md = (e.metadata ?? {}) as any;
    return {
      id: e.id,
      createdAt: e.createdAt.toISOString(),
      totalRows: md.totalRows ?? 0,
      insertedCount: md.insertedCount ?? 0,
      duplicateCount: md.duplicateCount ?? 0,
      errorCount: md.errorCount ?? 0,
      label: md.importLabel ?? null,
      source: md.importSource ?? null,
    };
  });

  const cards: ManagerAdminDashboardCards = {
    teamComplianceSummary: {
      totalChecks,
      passCount,
      failCount,
      passRate,
    },
    overdueTasks: {
      count: overdueTasksCount,
    },
    leadDistributionByStatus: leadDistribution,
    highRiskLeads: {
      items: highRiskLeads,
    },
    recentLeadImports: {
      items: recentLeadImports,
    },
  };

  if (role === "ADMIN") {
    const admin: AdminDashboardData = {
      role: "ADMIN",
      cards,
    };
    return admin;
  }

  if (role === "DIRECTOR") {
    const director: DirectorDashboardData = {
      role: "DIRECTOR",
      cards,
    };
    return director;
  }

  const manager: ManagerDashboardData = {
    role: "MANAGER",
    cards,
  };
  return manager;
}

/**
 * Entry point that chooses the appropriate dashboard aggregation
 * based on the user's role.
 */
export async function getDashboardForUser(params: {
  organizationId: string;
  userId: string;
  role: DashboardRole;
}): Promise<DashboardData> {
  const { organizationId, userId, role } = params;

  if (role === "AGENT") {
    return getAgentDashboard({ organizationId, userId });
  }

  if (role === "MANAGER" || role === "ADMIN" || role === "DIRECTOR") {
    // MANAGER / DIRECTOR / ADMIN get team-aware or org-wide aggregates.
    const mappedRole: "MANAGER" | "ADMIN" | "DIRECTOR" =
      role === "MANAGER"
        ? "MANAGER"
        : role === "DIRECTOR"
        ? "DIRECTOR"
        : "ADMIN";

    return getManagerAdminDirectorDashboard({
      organizationId,
      role: mappedRole,
      userId,
    });
  }

  // COMPLIANCE and READ_ONLY: reuse MANAGER-style org overview for now.
  return getManagerAdminDirectorDashboard({
    organizationId,
    role: "MANAGER",
    userId,
  });
}
