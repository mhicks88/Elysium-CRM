// apps/web/src/routes/dashboard/Dashboard.tsx
//
// Role-aware dashboard UI backed by /api/dashboard.
//
// - AGENT: personal queue/summary
// - MANAGER / DIRECTOR / ADMIN (and COMPLIANCE/VIEW_ONLY via backend mapping):
//   team/org overview with compliance + call metrics.

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { useAuth } from "../../lib/auth";
import { apiFetch } from "../../lib/apiClient";

type UiRole =
  | "ADMIN"
  | "MANAGER"
  | "DIRECTOR"
  | "AGENT"
  | "COMPLIANCE_OFFICER"
  | "VIEW_ONLY";

// === Types mirroring backend dashboard/service.ts ===

type DashboardRoleBackend =
  | "ADMIN"
  | "MANAGER"
  | "DIRECTOR"
  | "AGENT";

interface AgentDashboardData {
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
      avgScore: number | null; // 0–100
    };
  };
}

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
}

interface ManagerDashboardData {
  role: "MANAGER";
  cards: ManagerAdminDashboardCards;
}

interface AdminDashboardData {
  role: "ADMIN";
  cards: ManagerAdminDashboardCards;
}

interface DirectorDashboardData {
  role: "DIRECTOR";
  cards: ManagerAdminDashboardCards;
}

type ManagerLikeDashboardData =
  | ManagerDashboardData
  | AdminDashboardData
  | DirectorDashboardData;

type DashboardData = AgentDashboardData | ManagerLikeDashboardData;

// === Small helpers ===

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

const Dashboard: React.FC = () => {
  const { user } = useAuth() as { user: any | null };
  const uiRole = (user?.role ?? null) as UiRole | null;

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await apiFetch<DashboardData>("/api/dashboard", {
          method: "GET",
        });
        if (!mounted) return;
        setData(result);
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message ?? "Failed to load dashboard");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  // While user isn't loaded or no role, keep it simple
  if (!user) {
    return (
      <AppShell>
        <div style={{ padding: "2rem" }}>
          <h1>Not authenticated</h1>
          <p>Please log in to view the dashboard.</p>
        </div>
      </AppShell>
    );
  }

  const backendRole = (data?.role ??
    "AGENT") as DashboardRoleBackend;

  return (
    <AppShell>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-6)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "var(--space-4)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.4rem",
            }}
          >
            <h1
              style={{
                fontSize: "var(--text-2xl)",
                fontWeight: 600,
              }}
            >
              Dashboard
            </h1>
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-soft)",
                maxWidth: "42rem",
              }}
            >
              Role-aware overview for{" "}
              <strong>{user.email}</strong>. This view changes depending
              on whether you&apos;re an agent, manager, director, admin,
              or compliance.
            </p>
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                alignItems: "center",
              }}
            >
              <Badge variant="secondary">
                App role: {uiRole ?? "unknown"}
              </Badge>
              <Badge variant="secondary">
                Dashboard scope: {backendRole}
              </Badge>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              alignItems: "flex-end",
            }}
          >
            <Link to="/leads">
              <Button size="sm" variant="secondary">
                Go to leads
              </Button>
            </Link>
            <Link to="/calls">
              <Button size="sm" variant="secondary">
                View recent calls
              </Button>
            </Link>
            <Link to="/admin">
              <Button size="sm" variant="ghost">
                Compliance & imports
              </Button>
            </Link>
          </div>
        </div>

        {/* Error + loading */}
        {error && (
          <Card title="Unable to load dashboard">
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-danger)",
              }}
            >
              {error}
            </p>
            <div style={{ marginTop: "var(--space-3)" }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.location.reload()}
              >
                Reload
              </Button>
            </div>
          </Card>
        )}

        {loading && !data && !error && (
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-soft)",
            }}
          >
            Loading dashboard…
          </p>
        )}

        {data && data.role === "AGENT" && (
          <AgentDashboardView data={data} />
        )}

        {data &&
          (data.role === "MANAGER" ||
            data.role === "ADMIN" ||
            data.role === "DIRECTOR") && (
            <ManagerLikeDashboardView data={data} />
          )}
      </div>
    </AppShell>
  );
};

// === Agent view ===

const AgentDashboardView: React.FC<{
  data: AgentDashboardData;
}> = ({ data }) => {
  const cards = data.cards;
  const failureCount =
    cards.recentComplianceFailures.items.length ?? 0;

  return (
    <>
      {/* Top KPI row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: "var(--space-4)",
        }}
      >
        <Card title="Leads needing attention">
          <div
            style={{
              fontSize: "1.75rem",
              fontWeight: 600,
            }}
          >
            {cards.leadsNeedingAttention.count}
          </div>
          <p
            style={{
              marginTop: "var(--space-2)",
              fontSize: "var(--text-xs)",
              color: "var(--color-text-soft)",
            }}
          >
            Active leads in your queue with work left to do.
          </p>
        </Card>

        <Card title="Tasks due / overdue">
          <div
            style={{
              fontSize: "1.75rem",
              fontWeight: 600,
              color:
                cards.tasksDueTodayOrOverdue.count > 0
                  ? "var(--color-warning)"
                  : "var(--color-text-primary)",
            }}
          >
            {cards.tasksDueTodayOrOverdue.count}
          </div>
          <p
            style={{
              marginTop: "var(--space-2)",
              fontSize: "var(--text-xs)",
              color: "var(--color-text-soft)",
            }}
          >
            Tasks due today or earlier that still need attention.
          </p>
        </Card>

        <Card title="Coached calls">
          <div
            style={{
              fontSize: "1.75rem",
              fontWeight: 600,
            }}
          >
            {cards.coachingSummary.coachedCallCount}
          </div>
          <p
            style={{
              marginTop: "var(--space-2)",
              fontSize: "var(--text-xs)",
              color: "var(--color-text-soft)",
            }}
          >
            Calls where coaching notes were left.
          </p>
          <div
            style={{
              marginTop: "var(--space-2)",
              fontSize: "var(--text-xs)",
              color: "var(--color-text-soft)",
            }}
          >
            Avg coaching score:{" "}
            {cards.coachingSummary.avgScore != null
              ? `${cards.coachingSummary.avgScore.toFixed(1)}/100`
              : "—"}
          </div>
        </Card>

        <Card title="Recent compliance failures">
          <div
            style={{
              fontSize: "1.75rem",
              fontWeight: 600,
              color:
                failureCount > 0
                  ? "var(--color-danger)"
                  : "var(--color-text-primary)",
            }}
          >
            {failureCount}
          </div>
          <p
            style={{
              marginTop: "var(--space-2)",
              fontSize: "var(--text-xs)",
              color: "var(--color-text-soft)",
            }}
          >
            Failed checks attached to your calls (last 5).
          </p>
        </Card>
      </div>

      {/* Middle row: recent calls + compliance failures */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr)",
          gap: "var(--space-4)",
          alignItems: "flex-start",
        }}
      >
        <Card
          title="Recent calls"
          description="Your latest calls, including failed or abandoned ones."
        >
          {cards.recentCalls.items.length === 0 ? (
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-soft)",
                fontStyle: "italic",
              }}
            >
              No call sessions recorded yet.
            </p>
          ) : (
            <div
              style={{
                overflowX: "auto",
              }}
            >
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
                      borderBottom:
                        "1px solid var(--color-border-subtle)",
                    }}
                  >
                    <th style={{ padding: "0.45rem" }}>Call</th>
                    <th style={{ padding: "0.45rem" }}>Lead</th>
                    <th style={{ padding: "0.45rem" }}>Direction</th>
                    <th style={{ padding: "0.45rem" }}>Purpose</th>
                    <th style={{ padding: "0.45rem" }}>Status</th>
                    <th style={{ padding: "0.45rem" }}>Started</th>
                  </tr>
                </thead>
                <tbody>
                  {cards.recentCalls.items.map((c) => (
                    <tr
                      key={c.id}
                      style={{
                        borderBottom:
                          "1px solid rgba(15,23,42,0.6)",
                      }}
                    >
                      <td style={{ padding: "0.45rem" }}>
                        <Link
                          to={`/calls/${c.id}`}
                          style={{
                            color: "var(--color-primary)",
                            textDecoration: "none",
                          }}
                        >
                          {c.id.slice(0, 8)}…
                        </Link>
                      </td>
                      <td style={{ padding: "0.45rem" }}>
                        <Link
                          to={`/leads/${c.leadId}`}
                          style={{
                            color: "var(--color-primary)",
                            textDecoration: "none",
                          }}
                        >
                          {c.leadId.slice(0, 8)}…
                        </Link>
                      </td>
                      <td style={{ padding: "0.45rem" }}>
                        {c.direction}
                      </td>
                      <td style={{ padding: "0.45rem" }}>
                        {c.purpose}
                      </td>
                      <td style={{ padding: "0.45rem" }}>
                        <Badge
                          variant={
                            c.status === "COMPLETED" ||
                            c.status === "CONNECTED"
                              ? "success"
                              : c.status === "FAILED" ||
                                c.status === "ABANDONED"
                              ? "danger"
                              : "warning"
                          }
                        >
                          {c.status.toLowerCase()}
                        </Badge>
                      </td>
                      <td style={{ padding: "0.45rem" }}>
                        {formatDateTime(c.startedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card
          title="Recent compliance failures"
          description="Failed checks involving your calls."
        >
          {cards.recentComplianceFailures.items.length === 0 ? (
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-soft)",
                fontStyle: "italic",
              }}
            >
              No recent failures attributed to you.
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-2)",
                maxHeight: "320px",
                overflowY: "auto",
              }}
            >
              {cards.recentComplianceFailures.items.map((f) => (
                <div
                  key={f.id}
                  style={{
                    padding: "var(--space-3)",
                    borderRadius: "var(--radius-md)",
                    border:
                      "1px solid var(--color-border-subtle)",
                    backgroundColor: "rgba(15,23,42,0.75)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.25rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "var(--text-sm)",
                        fontWeight: 500,
                      }}
                    >
                      Lead{" "}
                      <Link
                        to={`/leads/${f.leadId}`}
                        style={{
                          color: "var(--color-primary)",
                          textDecoration: "none",
                        }}
                      >
                        {f.leadId.slice(0, 8)}…
                      </Link>
                    </div>
                    <Badge variant="danger">FAIL</Badge>
                  </div>
                  <div
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-soft)",
                    }}
                  >
                    Purpose: {f.purpose}
                  </div>
                  <div
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-soft)",
                    }}
                  >
                    {formatDateTime(f.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Script runs */}
      <Card
        title="Recent scripted calls"
        description="Interactive script runs for your leads."
      >
        {cards.recentScriptRuns.items.length === 0 ? (
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-soft)",
              fontStyle: "italic",
            }}
          >
            No scripted call runs yet.
          </p>
        ) : (
          <div
            style={{
              overflowX: "auto",
            }}
          >
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
                    borderBottom:
                      "1px solid var(--color-border-subtle)",
                  }}
                >
                  <th style={{ padding: "0.45rem" }}>Run</th>
                  <th style={{ padding: "0.45rem" }}>Lead</th>
                  <th style={{ padding: "0.45rem" }}>Status</th>
                  <th style={{ padding: "0.45rem" }}>Outcome</th>
                  <th style={{ padding: "0.45rem" }}>Started</th>
                </tr>
              </thead>
              <tbody>
                {cards.recentScriptRuns.items.map((r) => (
                  <tr
                    key={r.id}
                    style={{
                      borderBottom:
                        "1px solid rgba(15,23,42,0.6)",
                    }}
                  >
                    <td style={{ padding: "0.45rem" }}>
                      {r.id.slice(0, 8)}…
                    </td>
                    <td style={{ padding: "0.45rem" }}>
                      <Link
                        to={`/leads/${r.leadId}`}
                        style={{
                          color: "var(--color-primary)",
                          textDecoration: "none",
                        }}
                      >
                        {r.leadId.slice(0, 8)}…
                      </Link>
                    </td>
                    <td style={{ padding: "0.45rem" }}>{r.status}</td>
                    <td style={{ padding: "0.45rem" }}>
                      {r.outcome ?? "—"}
                    </td>
                    <td style={{ padding: "0.45rem" }}>
                      {formatDateTime(r.startedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
};

// === Manager/Admin/Director view ===

const ManagerLikeDashboardView: React.FC<{
  data: ManagerLikeDashboardData;
}> = ({ data }) => {
  const cards = data.cards;
  const failRate = cards.teamComplianceSummary.passRate
    ? 1 - cards.teamComplianceSummary.passRate
    : cards.teamComplianceSummary.totalChecks === 0
    ? 0
    : 1;

  const failRateBadgeVariant =
    failRate >= 0.2
      ? "danger"
      : failRate >= 0.1
      ? "warning"
      : "success";

  return (
    <>
      {/* Top KPI row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: "var(--space-4)",
        }}
      >
        <Card title="Total compliance checks">
          <div
            style={{
              fontSize: "1.75rem",
              fontWeight: 600,
            }}
          >
            {cards.teamComplianceSummary.totalChecks}
          </div>
          <p
            style={{
              marginTop: "var(--space-2)",
              fontSize: "var(--text-xs)",
              color: "var(--color-text-soft)",
            }}
          >
            Checks in your scoped view (team or org-wide).
          </p>
        </Card>

        <Card title="Failed checks">
          <div
            style={{
              fontSize: "1.75rem",
              fontWeight: 600,
              color: "var(--color-danger)",
            }}
          >
            {cards.teamComplianceSummary.failCount}
          </div>
          <p
            style={{
              marginTop: "var(--space-2)",
              fontSize: "var(--text-xs)",
              color: "var(--color-text-soft)",
            }}
          >
            Calls that did not pass your rules engine.
          </p>
        </Card>

        <Card title="Failure rate">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span
              style={{
                fontSize: "1.75rem",
                fontWeight: 600,
              }}
            >
              {percent(failRate)}
            </span>
            <Badge variant={failRateBadgeVariant}>
              {failRateBadgeVariant === "danger"
                ? "High risk"
                : failRateBadgeVariant === "warning"
                ? "Monitor"
                : "Healthy"}
            </Badge>
          </div>
          <p
            style={{
              marginTop: "var(--space-2)",
              fontSize: "var(--text-xs)",
              color: "var(--color-text-soft)",
            }}
          >
            Failures / total checks, in scope.
          </p>
        </Card>

        <Card title="Overdue tasks">
          <div
            style={{
              fontSize: "1.75rem",
              fontWeight: 600,
              color:
                cards.overdueTasks.count > 0
                  ? "var(--color-warning)"
                  : "var(--color-text-primary)",
            }}
          >
            {cards.overdueTasks.count}
          </div>
          <p
            style={{
              marginTop: "var(--space-2)",
              fontSize: "var(--text-xs)",
              color: "var(--color-text-soft)",
            }}
          >
            Open tasks with due dates in the past.
          </p>
        </Card>
      </div>

      {/* Middle row: lead distribution + high-risk leads */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
          gap: "var(--space-4)",
          alignItems: "flex-start",
        }}
      >
        <Card
          title="Lead distribution by status"
          description="How active your team/org pipeline is, by status."
        >
          {cards.leadDistributionByStatus.length === 0 ? (
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-soft)",
                fontStyle: "italic",
              }}
            >
              No leads in scope for this dashboard.
            </p>
          ) : (
            <div
              style={{
                overflowX: "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "var(--text-sm)",
                }}
              >
                <thead>
                  <tr
                    style={{
                      textAlign: "left",
                      color: "var(--color-text-soft)",
                      fontSize: "var(--text-xs)",
                      borderBottom:
                        "1px solid var(--color-border-subtle)",
                    }}
                  >
                    <th style={{ padding: "0.5rem" }}>Status</th>
                    <th
                      style={{
                        padding: "0.5rem",
                        textAlign: "right",
                      }}
                    >
                      Count
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cards.leadDistributionByStatus.map((row) => (
                    <tr
                      key={row.status}
                      style={{
                        borderBottom:
                          "1px solid rgba(15,23,42,0.6)",
                      }}
                    >
                      <td style={{ padding: "0.5rem" }}>
                        {row.status}
                      </td>
                      <td
                        style={{
                          padding: "0.5rem",
                          textAlign: "right",
                        }}
                      >
                        {row.count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
                fontStyle: "italic",
              }}
            >
              No leads with repeated failures in this scope.
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-2)",
                maxHeight: "320px",
                overflowY: "auto",
              }}
            >
              {cards.highRiskLeads.items.map((row) => (
                <div
                  key={row.leadId}
                  style={{
                    padding: "var(--space-3)",
                    borderRadius: "var(--radius-md)",
                    border:
                      "1px solid var(--color-border-subtle)",
                    backgroundColor: "rgba(15,23,42,0.75)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.25rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <Link
                      to={`/leads/${row.leadId}`}
                      style={{
                        color: "var(--color-primary)",
                        textDecoration: "none",
                        fontSize: "var(--text-sm)",
                      }}
                    >
                      Lead {row.leadId.slice(0, 8)}…
                    </Link>
                    <Badge variant="danger">
                      {row.failCount} failures
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Bottom row: imports + calls + coaching */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1.2fr)",
          gap: "var(--space-4)",
          alignItems: "flex-start",
        }}
      >
        <Card
          title="Recent lead imports"
          description="Latest bulk imports into the org."
        >
          {cards.recentLeadImports.items.length === 0 ? (
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-soft)",
                fontStyle: "italic",
              }}
            >
              No import events found yet.
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-2)",
                maxHeight: "320px",
                overflowY: "auto",
              }}
            >
              {cards.recentLeadImports.items.map((job) => (
                <div
                  key={job.id}
                  style={{
                    padding: "var(--space-3)",
                    borderRadius: "var(--radius-md)",
                    border:
                      "1px solid var(--color-border-subtle)",
                    backgroundColor: "rgba(15,23,42,0.75)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.25rem",
                  }}
                >
                  <div
                    style={{
                      fontSize: "var(--text-sm)",
                      fontWeight: 500,
                    }}
                  >
                    {job.label ?? job.source ?? "(Unnamed import)"}
                  </div>
                  <div
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-soft)",
                    }}
                  >
                    {formatDateTime(job.createdAt)} • Total:{" "}
                    <strong>{job.totalRows}</strong> • Created:{" "}
                    <strong>{job.insertedCount}</strong> • Duplicates:{" "}
                    <strong>{job.duplicateCount}</strong> • Errors:{" "}
                    <strong>{job.errorCount}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card
          title="Recent calls & coaching"
          description="Call volume snapshot plus coaching coverage."
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(0, 1.1fr) minmax(0, 1fr)",
              gap: "var(--space-3)",
              alignItems: "flex-start",
            }}
          >
            {/* Recent calls */}
            <div
              style={{
                overflowX: "auto",
              }}
            >
              {cards.recentCalls.items.length === 0 ? (
                <p
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--color-text-soft)",
                    fontStyle: "italic",
                  }}
                >
                  No calls in this scope yet.
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
                        borderBottom:
                          "1px solid var(--color-border-subtle)",
                      }}
                    >
                      <th style={{ padding: "0.4rem" }}>Call</th>
                      <th style={{ padding: "0.4rem" }}>Lead</th>
                      <th style={{ padding: "0.4rem" }}>Agent</th>
                      <th style={{ padding: "0.4rem" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cards.recentCalls.items.map((c) => (
                      <tr
                        key={c.id}
                        style={{
                          borderBottom:
                            "1px solid rgba(15,23,42,0.6)",
                        }}
                      >
                        <td style={{ padding: "0.4rem" }}>
                          <Link
                            to={`/calls/${c.id}`}
                            style={{
                              color: "var(--color-primary)",
                              textDecoration: "none",
                            }}
                          >
                            {c.id.slice(0, 8)}…
                          </Link>
                        </td>
                        <td style={{ padding: "0.4rem" }}>
                          <Link
                            to={`/leads/${c.leadId}`}
                            style={{
                              color: "var(--color-primary)",
                              textDecoration: "none",
                            }}
                          >
                            {c.leadId.slice(0, 8)}…
                          </Link>
                        </td>
                        <td style={{ padding: "0.4rem" }}>
                          {c.agentId}
                        </td>
                        <td style={{ padding: "0.4rem" }}>
                          {c.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Coaching summary */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-2)",
                fontSize: "var(--text-xs)",
                color: "var(--color-text-soft)",
              }}
            >
              <div>
                <strong>Coached calls</strong>
                <div>
                  Total coached calls:{" "}
                  <strong>
                    {cards.coachingSummary.coachedCallCount}
                  </strong>
                </div>
                <div>
                  Avg score:{" "}
                  <strong>
                    {cards.coachingSummary.avgScore != null
                      ? `${cards.coachingSummary.avgScore.toFixed(
                          1
                        )}/100`
                      : "—"}
                  </strong>
                </div>
              </div>

              <div>
                <strong>Coaching by agent</strong>
                {cards.coachingByAgent.items.length === 0 ? (
                  <div> No coaching activity found. </div>
                ) : (
                  <div
                    style={{
                      maxHeight: "200px",
                      overflowY: "auto",
                    }}
                  >
                    {cards.coachingByAgent.items.map((row) => (
                      <div
                        key={row.agentId}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "0.5rem",
                          padding: "0.2rem 0",
                        }}
                      >
                        <span>{row.agentId}</span>
                        <span>
                          {row.coachedCallCount} calls •{" "}
                          {row.avgScore != null
                            ? `${row.avgScore.toFixed(1)}/100`
                            : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <strong>Call volume by agent</strong>
                {cards.callVolumeByAgent.items.length === 0 ? (
                  <div>No calls in this scope.</div>
                ) : (
                  <div
                    style={{
                      maxHeight: "200px",
                      overflowY: "auto",
                    }}
                  >
                    {cards.callVolumeByAgent.items.map((row) => (
                      <div
                        key={row.agentId}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "0.5rem",
                          padding: "0.2rem 0",
                        }}
                      >
                        <span>{row.agentId}</span>
                        <span>{row.callCount} calls</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Dashboard;

