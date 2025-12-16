// apps/web/src/routes/reports/ReportsPage.tsx

import React, { useEffect, useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { useAuth } from "../../lib/auth";
import { getDashboard } from "../../lib/apiClient";

// Local view types – we keep them loose-ish and mapped to the backend structure
type AgentDashboardCards = {
  leadsNeedingAttention: { count: number };
  tasksDueTodayOrOverdue: { count: number };
  recentComplianceFailures: {
    items: { id: string; leadId: string; purpose: string; createdAt: string }[];
  };
  recentScriptRuns: {
    items: { id: string; leadId: string; status: string; startedAt: string }[];
  };
  recentCalls: {
    items: {
      id: string;
      leadId: string;
      direction: string;
      purpose: string;
      status: string;
      startedAt: string;
    }[];
  };
  coachingSummary: {
    coachedCallCount: number;
    avgScore: number | null;
  };
};

type ManagerAdminDashboardCards = {
  teamComplianceSummary: {
    totalChecks: number;
    passCount: number;
    failCount: number;
    passRate: number;
  };
  overdueTasks: { count: number };
  leadDistributionByStatus: {
    status: string;
    count: number;
  }[];
  highRiskLeads: {
    items: { leadId: string; failCount: number }[];
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
  recentCalls: {
    items: {
      id: string;
      leadId: string;
      agentId: string;
      direction: string;
      purpose: string;
      status: string;
      startedAt: string;
    }[];
  };
  callVolumeByAgent: {
    items: {
      agentId: string;
      callCount: number;
    }[];
  };
  coachingSummary: {
    coachedCallCount: number;
    avgScore: number | null;
  };
  coachingByAgent: {
    items: {
      agentId: string;
      coachedCallCount: number;
      avgScore: number | null;
    }[];
  };
};

type AgentDashboardViewData = {
  role: "AGENT";
  cards: AgentDashboardCards;
};

type ManagerDashboardViewData = {
  role: "MANAGER" | "DIRECTOR" | "ADMIN";
  cards: ManagerAdminDashboardCards;
};

type AnyDashboardViewData = AgentDashboardViewData | ManagerDashboardViewData;

// App roles from auth
type AppRole =
  | "ADMIN"
  | "MANAGER"
  | "DIRECTOR"
  | "AGENT"
  | "COMPLIANCE_OFFICER"
  | "READ_ONLY";

type DashboardRole = "AGENT" | "MANAGER" | "DIRECTOR" | "ADMIN";

export const ReportsPage: React.FC = () => {
  const { user } = useAuth() as { user: any | null };

  // We’ll just store whatever the backend gives us and cast into the view types
  const [data, setData] = useState<AnyDashboardViewData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const raw = await getDashboard();
        if (!mounted) return;
        // raw is whatever DashboardResponse is; we trust backend shape for now
        setData(raw as AnyDashboardViewData);
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message ?? "Failed to load dashboard data");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  function renderAgentView(d: AgentDashboardViewData) {
    const cards = d.cards;

    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr)",
          gap: "var(--space-4)",
          alignItems: "flex-start",
        }}
      >
        <Card
          title="My queue"
          description="Leads and tasks that need your attention."
        >
          <div
            style={{
              display: "flex",
              gap: "var(--space-6)",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--color-text-soft)",
                }}
              >
                Leads needing attention
              </div>
              <div
                style={{
                  fontSize: "var(--text-2xl)",
                  fontWeight: 600,
                }}
              >
                {cards.leadsNeedingAttention.count}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--color-text-soft)",
                }}
              >
                Tasks due today / overdue
              </div>
              <div
                style={{
                  fontSize: "var(--text-2xl)",
                  fontWeight: 600,
                }}
              >
                {cards.tasksDueTodayOrOverdue.count}
              </div>
            </div>
          </div>
        </Card>

        <Card
          title="Coaching"
          description="Coached calls and average score."
        >
          <div
            style={{
              display: "flex",
              gap: "var(--space-6)",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--color-text-soft)",
                }}
              >
                Coached calls
              </div>
              <div
                style={{
                  fontSize: "var(--text-2xl)",
                  fontWeight: 600,
                }}
              >
                {cards.coachingSummary.coachedCallCount}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--color-text-soft)",
                }}
              >
                Avg score
              </div>
              <div
                style={{
                  fontSize: "var(--text-2xl)",
                  fontWeight: 600,
                }}
              >
                {cards.coachingSummary.avgScore != null
                  ? `${cards.coachingSummary.avgScore.toFixed(1)}`
                  : "—"}
              </div>
            </div>
          </div>
        </Card>

        <Card
          title="Recent calls"
          description="Last few calls you handled."
        >
          {cards.recentCalls.items.length === 0 ? (
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-soft)",
              }}
            >
              No recent calls.
            </p>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "var(--text-xs)",
              }}
            >
              <thead>
                <tr
                  style={{
                    textAlign: "left",
                    color: "var(--color-text-soft)",
                    borderBottom: "1px solid var(--color-border-subtle)",
                  }}
                >
                  <th style={{ padding: "0.4rem" }}>Lead</th>
                  <th style={{ padding: "0.4rem" }}>Direction</th>
                  <th style={{ padding: "0.4rem" }}>Purpose</th>
                  <th style={{ padding: "0.4rem" }}>Status</th>
                  <th style={{ padding: "0.4rem" }}>Started</th>
                </tr>
              </thead>
              <tbody>
                {cards.recentCalls.items.map((c) => (
                  <tr key={c.id}>
                    <td style={{ padding: "0.4rem" }}>{c.leadId.slice(0, 8)}…</td>
                    <td style={{ padding: "0.4rem" }}>{c.direction}</td>
                    <td style={{ padding: "0.4rem" }}>{c.purpose}</td>
                    <td style={{ padding: "0.4rem" }}>{c.status}</td>
                    <td style={{ padding: "0.4rem" }}>
                      {new Date(c.startedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card
          title="Recent compliance failures"
          description="Your most recent failed checks."
        >
          {cards.recentComplianceFailures.items.length === 0 ? (
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-soft)",
              }}
            >
              No recent failures.
            </p>
          ) : (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              {cards.recentComplianceFailures.items.map((f) => (
                <li
                  key={f.id}
                  style={{
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-border-subtle)",
                    padding: "0.4rem 0.6rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.15rem",
                  }}
                >
                  <span
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-soft)",
                    }}
                  >
                    {new Date(f.createdAt).toLocaleString()}
                  </span>
                  <span
                    style={{
                      fontSize: "var(--text-sm)",
                      fontWeight: 500,
                    }}
                  >
                    {f.purpose}
                  </span>
                  <span
                    style={{
                      fontSize: "var(--text-2xs)",
                      color: "var(--color-text-soft)",
                    }}
                  >
                    Lead {f.leadId.slice(0, 8)}…
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Recent scripted calls"
          description="Most recent script runs you started."
        >
          {cards.recentScriptRuns.items.length === 0 ? (
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-soft)",
              }}
            >
              No scripted calls yet.
            </p>
          ) : (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              {cards.recentScriptRuns.items.map((r) => (
                <li
                  key={r.id}
                  style={{
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-border-subtle)",
                    padding: "0.4rem 0.6rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.15rem",
                  }}
                >
                  <span
                    style={{
                      fontSize: "var(--text-sm)",
                      fontWeight: 500,
                    }}
                  >
                    Script run {r.id.slice(0, 8)}…
                  </span>
                  <span
                    style={{
                      fontSize: "var(--text-2xs)",
                      color: "var(--color-text-soft)",
                    }}
                  >
                    Lead {r.leadId.slice(0, 8)} • {r.status}
                  </span>
                  <span
                    style={{
                      fontSize: "var(--text-2xs)",
                      color: "var(--color-text-soft)",
                    }}
                  >
                    {new Date(r.startedAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    );
  }

  function renderManagerView(d: ManagerDashboardViewData) {
    const cards = d.cards;
    const passRatePct = (cards.teamComplianceSummary.passRate * 100).toFixed(1);

    // Build a per-agent performance view from existing aggregates
    const agentPerformance = cards.callVolumeByAgent.items.map((row) => {
      const coaching = cards.coachingByAgent.items.find(
        (c) => c.agentId === row.agentId
      );
      return {
        agentId: row.agentId,
        callCount: row.callCount,
        coachedCallCount: coaching?.coachedCallCount ?? 0,
        avgScore: coaching?.avgScore ?? null,
      };
    });

    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr)",
          gap: "var(--space-4)",
          alignItems: "flex-start",
        }}
      >
        <Card
          title="Team compliance"
          description="Compliance checks across your team."
        >
          <div
            style={{
              display: "flex",
              gap: "var(--space-6)",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--color-text-soft)",
                }}
              >
                Total checks
              </div>
              <div
                style={{
                  fontSize: "var(--text-2xl)",
                  fontWeight: 600,
                }}
              >
                {cards.teamComplianceSummary.totalChecks}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--color-text-soft)",
                }}
              >
                Pass / Fail
              </div>
              <div
                style={{
                  fontSize: "var(--text-sm)",
                }}
              >
                <Badge variant="success">
                  {cards.teamComplianceSummary.passCount} PASS
                </Badge>{" "}
                <Badge variant="danger">
                  {cards.teamComplianceSummary.failCount} FAIL
                </Badge>
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--color-text-soft)",
                }}
              >
                Pass rate
              </div>
              <div
                style={{
                  fontSize: "var(--text-2xl)",
                  fontWeight: 600,
                }}
              >
                {Number.isNaN(+passRatePct) ? "—" : `${passRatePct}%`}
              </div>
            </div>
          </div>
        </Card>

        <Card
          title="Overdue work"
          description="Tasks past due for your team."
        >
          <div
            style={{
              fontSize: "var(--text-3xl)",
              fontWeight: 600,
            }}
          >
            {cards.overdueTasks.count}
          </div>
          <p
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--color-text-soft)",
              marginTop: "0.25rem",
            }}
          >
            Tasks with due dates in the past and still open or in progress.
          </p>
        </Card>

        <Card
          title="Lead distribution"
          description="How your team’s leads are distributed by status."
        >
          {cards.leadDistributionByStatus.length === 0 ? (
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-soft)",
              }}
            >
              No leads yet for your team.
            </p>
          ) : (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: "0.3rem",
              }}
            >
              {cards.leadDistributionByStatus.map((row) => (
                <li
                  key={row.status}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "var(--text-xs)",
                  }}
                >
                  <span>{row.status}</span>
                  <span>{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="High-risk leads"
          description="Leads with multiple failed compliance checks."
        >
          {cards.highRiskLeads.items.length === 0 ? (
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-soft)",
              }}
            >
              No high-risk leads detected.
            </p>
          ) : (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: "0.35rem",
              }}
            >
              {cards.highRiskLeads.items.map((item) => (
                <li
                  key={item.leadId}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "var(--text-xs)",
                  }}
                >
                  <span>Lead {item.leadId.slice(0, 8)}…</span>
                  <span>{item.failCount} fails</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Team call volume"
          description="Calls handled by each agent in your downline."
        >
          {cards.callVolumeByAgent.items.length === 0 ? (
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-soft)",
              }}
            >
              No calls yet for your team.
            </p>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "var(--text-xs)",
              }}
            >
              <thead>
                <tr
                  style={{
                    textAlign: "left",
                    color: "var(--color-text-soft)",
                    borderBottom: "1px solid var(--color-border-subtle)",
                  }}
                >
                  <th style={{ padding: "0.4rem" }}>Agent</th>
                  <th style={{ padding: "0.4rem" }}>Calls</th>
                </tr>
              </thead>
              <tbody>
                {cards.callVolumeByAgent.items.map((row) => (
                  <tr key={row.agentId}>
                    <td style={{ padding: "0.4rem" }}>
                      {row.agentId.slice(0, 10)}…
                    </td>
                    <td style={{ padding: "0.4rem" }}>{row.callCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card
          title="Agent performance"
          description="Per-agent call volume and coaching scores (scoped to your team, or org-wide for admins/compliance)."
        >
          {agentPerformance.length === 0 ? (
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-soft)",
              }}
            >
              No agent activity yet for this scope.
            </p>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "var(--text-xs)",
              }}
            >
              <thead>
                <tr
                  style={{
                    textAlign: "left",
                    color: "var(--color-text-soft)",
                    borderBottom: "1px solid var(--color-border-subtle)",
                  }}
                >
                  <th style={{ padding: "0.4rem" }}>Agent</th>
                  <th style={{ padding: "0.4rem" }}>Calls</th>
                  <th style={{ padding: "0.4rem" }}>Coached calls</th>
                  <th style={{ padding: "0.4rem" }}>Avg score</th>
                </tr>
              </thead>
              <tbody>
                {agentPerformance.map((row) => (
                  <tr key={row.agentId}>
                    <td style={{ padding: "0.4rem" }}>
                      {row.agentId.slice(0, 10)}…
                    </td>
                    <td style={{ padding: "0.4rem" }}>{row.callCount}</td>
                    <td style={{ padding: "0.4rem" }}>
                      {row.coachedCallCount}
                    </td>
                    <td style={{ padding: "0.4rem" }}>
                      {row.avgScore != null
                        ? row.avgScore.toFixed(1)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card
          title="Coaching summary"
          description="Coverage and quality of coaching across your team."
        >
          <div
            style={{
              display: "flex",
              gap: "var(--space-6)",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--color-text-soft)",
                }}
              >
                Coached calls
              </div>
              <div
                style={{
                  fontSize: "var(--text-2xl)",
                  fontWeight: 600,
                }}
              >
                {cards.coachingSummary.coachedCallCount}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--color-text-soft)",
                }}
              >
                Avg score
              </div>
              <div
                style={{
                  fontSize: "var(--text-2xl)",
                  fontWeight: 600,
                }}
              >
                {cards.coachingSummary.avgScore != null
                  ? cards.coachingSummary.avgScore.toFixed(1)
                  : "—"}
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: "var(--space-3)",
              fontSize: "var(--text-xs)",
            }}
          >
            <div
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--color-text-soft)",
                marginBottom: "0.25rem",
              }}
            >
              Coaching by agent
            </div>
            {cards.coachingByAgent.items.length === 0 ? (
              <p
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--color-text-soft)",
                }}
              >
                No coached calls yet broken down by agent.
              </p>
            ) : (
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.25rem",
                }}
              >
                {cards.coachingByAgent.items.map((row) => (
                  <li
                    key={row.agentId}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>{row.agentId.slice(0, 10)}…</span>
                    <span>
                      {row.coachedCallCount} calls
                      {row.avgScore != null
                        ? ` · ${row.avgScore.toFixed(1)}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card
          title="Recent lead imports"
          description="Bulk lead imports into your org."
        >
          {cards.recentLeadImports.items.length === 0 ? (
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-soft)",
              }}
            >
              No recent imports.
            </p>
          ) : (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              {cards.recentLeadImports.items.map((imp) => (
                <li
                  key={imp.id}
                  style={{
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-border-subtle)",
                    padding: "0.4rem 0.6rem",
                    fontSize: "var(--text-2xs)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "0.15rem",
                    }}
                  >
                    <span>{imp.label ?? "Unnamed import"}</span>
                    <span>
                      {new Date(imp.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    {imp.insertedCount}/{imp.totalRows} inserted ·{" "}
                    {imp.duplicateCount} dupes · {imp.errorCount} errors
                  </div>
                  {imp.source && (
                    <div
                      style={{
                        color: "var(--color-text-soft)",
                      }}
                    >
                      Source: {imp.source}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    );
  }

  // App-level role (auth) and dashboard role (data layout)
  const appRole = (user?.role ?? "AGENT") as AppRole;
  const dashboardRole: DashboardRole =
    (data?.role as DashboardRole | undefined) ??
    (appRole === "AGENT"
      ? "AGENT"
      : appRole === "DIRECTOR"
      ? "DIRECTOR"
      : appRole === "ADMIN"
      ? "ADMIN"
      : "MANAGER");

  const displayRoleLabel =
    appRole === "COMPLIANCE_OFFICER"
      ? "compliance"
      : appRole.toLowerCase();

  let scopeLabel: string;
  switch (dashboardRole) {
    case "AGENT":
      scopeLabel = "Your own leads, tasks, and calls";
      break;
    case "MANAGER":
      scopeLabel =
        appRole === "COMPLIANCE_OFFICER"
          ? "All agents in the org"
          : "Your agents (and your own activity)";
      break;
    case "DIRECTOR":
      scopeLabel = "Your managers and their agents";
      break;
    case "ADMIN":
      scopeLabel =
        appRole === "COMPLIANCE_OFFICER"
          ? "All agents in the org"
          : "Entire organization";
      break;
    default:
      scopeLabel = "Team overview";
  }

  return (
    <AppShell>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-6)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <h1
              style={{
                fontSize: "var(--text-2xl)",
                fontWeight: 600,
              }}
            >
              Reports
            </h1>
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-soft)",
                maxWidth: "40rem",
              }}
            >
              {dashboardRole === "AGENT"
                ? "Metrics for your own book of business, calls, and compliance."
                : appRole === "COMPLIANCE_OFFICER"
                ? "Org-wide view of agents, calls, lead imports, and compliance risk."
                : "High-level metrics for your team’s leads, calls, compliance, and coaching coverage."}
            </p>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
              alignItems: "flex-end",
            }}
          >
            <Badge variant="secondary">Role: {displayRoleLabel}</Badge>
            <Badge variant="secondary">Scope: {scopeLabel}</Badge>
          </div>
        </div>

        {loading && !error && (
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-soft)",
            }}
          >
            Loading reports…
          </p>
        )}

        {error && (
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-danger)",
            }}
          >
            {error}
          </p>
        )}

        {data && !loading && !error && (
          <>
            {dashboardRole === "AGENT"
              ? renderAgentView(data as AgentDashboardViewData)
              : renderManagerView(data as ManagerDashboardViewData)}
          </>
        )}
      </div>
    </AppShell>
  );
};

export default ReportsPage;

