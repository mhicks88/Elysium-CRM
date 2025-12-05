// apps/web/src/routes/ComplianceReportsPage.tsx

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Input } from "../components/ui/Input";
import {
  getComplianceSummary,
  getComplianceStatsByAgent,
  getRecentComplianceFailures,
  getTeamActivityReport,
  getScriptUsageReport,
  type TeamActivityReport,
  type ScriptUsageRow,
} from "../lib/apiClient";
import { useAuth } from "../lib/auth";

// Local types mirroring apiClient return shapes

type ComplianceSummary = {
  totalChecks: number;
  passCount: number;
  failCount: number;
  failRate: number;
  purposes: Record<
    string,
    {
      total: number;
      pass: number;
      fail: number;
    }
  >;
  firstCheckAt: string | null;
  lastCheckAt: string | null;
};

type ComplianceStatsByAgent = {
  agents: {
    userId: string;
    total: number;
    pass: number;
    fail: number;
  }[];
};

type RecentComplianceFailures = {
  failures: {
    id: string;
    leadId: string;
    userId: string;
    purpose: string;
    status: "PASS" | "FAIL";
    result: any;
    createdAt: string;
  }[];
};

type Role =
  | "ADMIN"
  | "AGENT"
  | "VIEW_ONLY"
  | "MANAGER"
  | "DIRECTOR"
  | "COMPLIANCE"
  | "READ_ONLY";

type ReportsTab = "COMPLIANCE" | "TEAM" | "SCRIPTS";

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function percentFromRate(rate: number | null | undefined): string {
  if (rate == null) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

const ComplianceReportsPage: React.FC = () => {
  const { user } = useAuth() as { user: any | null };
  const role = (user?.role ?? null) as Role | null;

  // Allow COMPLIANCE, ADMIN, MANAGER.
  const canViewReports =
    role === "COMPLIANCE" ||
    role === "ADMIN" ||
    role === "MANAGER";

  const [activeTab, setActiveTab] =
    useState<ReportsTab>("COMPLIANCE");

  const [from, setFrom] = useState<string>(() => {
    // default: last 30 days
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });

  const [summary, setSummary] =
    useState<ComplianceSummary | null>(null);
  const [statsByAgent, setStatsByAgent] =
    useState<ComplianceStatsByAgent | null>(null);
  const [recentFailures, setRecentFailures] =
    useState<RecentComplianceFailures | null>(null);

  const [teamActivity, setTeamActivity] =
    useState<TeamActivityReport | null>(null);

  const [scriptUsage, setScriptUsage] = useState<
    ScriptUsageRow[]
  >([]);

  const [loadingCompliance, setLoadingCompliance] =
    useState(false);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [loadingScripts, setLoadingScripts] =
    useState(false);

  const [errorCompliance, setErrorCompliance] =
    useState<string | null>(null);
  const [errorTeam, setErrorTeam] =
    useState<string | null>(null);
  const [errorScripts, setErrorScripts] =
    useState<string | null>(null);

  function loadCompliance() {
    setLoadingCompliance(true);
    setErrorCompliance(null);
    Promise.all([
      getComplianceSummary({ from, to }),
      getComplianceStatsByAgent({ from, to }),
      getRecentComplianceFailures(20),
    ])
      .then(([summaryRes, statsRes, failuresRes]) => {
        setSummary(summaryRes);
        setStatsByAgent(statsRes);
        setRecentFailures(failuresRes);
      })
      .catch((err: any) => {
        setErrorCompliance(
          err?.message ?? "Failed to load compliance reports"
        );
      })
      .finally(() => setLoadingCompliance(false));
  }

  function loadTeam() {
    setLoadingTeam(true);
    setErrorTeam(null);
    getTeamActivityReport({ from, to })
      .then((report) => {
        setTeamActivity(report);
      })
      .catch((err: any) => {
        setErrorTeam(
          err?.message ?? "Failed to load team activity report"
        );
      })
      .finally(() => setLoadingTeam(false));
  }

  function loadScriptsUsage() {
    setLoadingScripts(true);
    setErrorScripts(null);
    getScriptUsageReport({ from, to })
      .then((res) => {
        setScriptUsage(res.scripts || []);
      })
      .catch((err: any) => {
        setErrorScripts(
          err?.message ?? "Failed to load script usage report"
        );
      })
      .finally(() => setLoadingScripts(false));
  }

  useEffect(() => {
    if (!canViewReports) return;
    loadCompliance();
    loadTeam();
    loadScriptsUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewReports]);

  if (!user) {
    return (
      <AppShell>
        <div style={{ padding: "2rem" }}>
          <h1>Not authenticated</h1>
          <p>Please log in to view reports.</p>
        </div>
      </AppShell>
    );
  }

  if (!canViewReports) {
    return (
      <AppShell>
        <div style={{ padding: "2rem" }}>
          <h1
            style={{
              fontSize: "var(--text-xl)",
              fontWeight: 600,
            }}
          >
            Reports
          </h1>
          <p
            style={{
              marginTop: "0.5rem",
              fontSize: "var(--text-sm)",
              color: "var(--color-text-soft)",
              maxWidth: "32rem",
            }}
          >
            Your role (<strong>{role ?? "unknown"}</strong>) does not
            have access to the reports view.
          </p>
        </div>
      </AppShell>
    );
  }

  const showCompliance = activeTab === "COMPLIANCE";
  const showTeam = activeTab === "TEAM";
  const showScripts = activeTab === "SCRIPTS";

  return (
    <AppShell>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-6)",
        }}
      >
        {/* Header + filters + tabs */}
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
                maxWidth: "44rem",
              }}
            >
              Compliance metrics, team activity, and script usage. Data
              is automatically scoped to your visibility (org-wide for{" "}
              <strong>ADMIN/COMPLIANCE</strong>, team-level for{" "}
              <strong>MANAGER</strong>).
            </p>
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <Badge variant="secondary">
                Role: {role ?? "unknown"}
              </Badge>
              <Badge variant="secondary">
                Window: {from} → {to}
              </Badge>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              alignItems: "flex-end",
              minWidth: "260px",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.5rem",
                width: "100%",
              }}
            >
              <Input
                label="From"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
              <Input
                label="To"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
              }}
            >
              <Button
                size="sm"
                isLoading={
                  loadingCompliance ||
                  loadingTeam ||
                  loadingScripts
                }
                onClick={() => {
                  if (showCompliance) loadCompliance();
                  if (showTeam) loadTeam();
                  if (showScripts) loadScriptsUsage();
                }}
              >
                Apply filters
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "inline-flex",
            padding: "0.25rem",
            borderRadius: "999px",
            border: "1px solid var(--color-border-subtle)",
            backgroundColor: "rgba(15,23,42,0.7)",
            gap: "0.25rem",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("COMPLIANCE")}
            style={{
              border: "none",
              borderRadius: "999px",
              padding: "0.3rem 0.8rem",
              fontSize: "var(--text-xs)",
              cursor: "pointer",
              backgroundColor:
                activeTab === "COMPLIANCE"
                  ? "rgba(37,99,235,0.9)"
                  : "transparent",
              color:
                activeTab === "COMPLIANCE"
                  ? "var(--color-text-on-accent)"
                  : "var(--color-text-soft)",
            }}
          >
            Compliance
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("TEAM")}
            style={{
              border: "none",
              borderRadius: "999px",
              padding: "0.3rem 0.8rem",
              fontSize: "var(--text-xs)",
              cursor: "pointer",
              backgroundColor:
                activeTab === "TEAM"
                  ? "rgba(37,99,235,0.9)"
                  : "transparent",
              color:
                activeTab === "TEAM"
                  ? "var(--color-text-on-accent)"
                  : "var(--color-text-soft)",
            }}
          >
            Team activity
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("SCRIPTS")}
            style={{
              border: "none",
              borderRadius: "999px",
              padding: "0.3rem 0.8rem",
              fontSize: "var(--text-xs)",
              cursor: "pointer",
              backgroundColor:
                activeTab === "SCRIPTS"
                  ? "rgba(37,99,235,0.9)"
                  : "transparent",
              color:
                activeTab === "SCRIPTS"
                  ? "var(--color-text-on-accent)"
                  : "var(--color-text-soft)",
            }}
          >
            Script usage
          </button>
        </div>

        {/* === COMPLIANCE TAB === */}
        {showCompliance && (
          <>
            {errorCompliance && (
              <Card title="Unable to load compliance reports">
                <p
                  style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--color-danger)",
                  }}
                >
                  {errorCompliance}
                </p>
                <div style={{ marginTop: "var(--space-3)" }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={loadCompliance}
                  >
                    Retry
                  </Button>
                </div>
              </Card>
            )}

            {/* Top KPIs */}
            {summary && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(4, minmax(0, 1fr))",
                  gap: "var(--space-4)",
                }}
              >
                <Card title="Total checks">
                  <div
                    style={{
                      fontSize: "1.8rem",
                      fontWeight: 600,
                    }}
                  >
                    {summary.totalChecks}
                  </div>
                  <p
                    style={{
                      marginTop: "var(--space-2)",
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-soft)",
                    }}
                  >
                    All pre-call checks in this window.
                  </p>
                </Card>

                <Card title="Passes">
                  <div
                    style={{
                      fontSize: "1.8rem",
                      fontWeight: 600,
                      color: "var(--color-success)",
                    }}
                  >
                    {summary.passCount}
                  </div>
                  <p
                    style={{
                      marginTop: "var(--space-2)",
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-soft)",
                    }}
                  >
                    Compliant calls cleared to proceed.
                  </p>
                </Card>

                <Card title="Failures">
                  <div
                    style={{
                      fontSize: "1.8rem",
                      fontWeight: 600,
                      color: "var(--color-danger)",
                    }}
                  >
                    {summary.failCount}
                  </div>
                  <p
                    style={{
                      marginTop: "var(--space-2)",
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-soft)",
                    }}
                  >
                    Calls blocked by compliance rules.
                  </p>
                </Card>

                <Card title="Failure rate">
                  <div
                    style={{
                      fontSize: "1.8rem",
                      fontWeight: 600,
                    }}
                  >
                    {percentFromRate(summary.failRate)}
                  </div>
                  <p
                    style={{
                      marginTop: "var(--space-2)",
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-soft)",
                    }}
                  >
                    Failures / total checks.
                  </p>
                </Card>
              </div>
            )}

            {/* Middle row: purposes + agents */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(0, 1.2fr) minmax(0, 1fr)",
                gap: "var(--space-4)",
                alignItems: "flex-start",
              }}
            >
              <Card
                title="Checks by purpose"
                description="How checks distribute across marketing, enrollment, and other purposes."
              >
                {summary &&
                Object.keys(summary.purposes).length > 0 ? (
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
                            color:
                              "var(--color-text-soft)",
                            borderBottom:
                              "1px solid var(--color-border-subtle)",
                          }}
                        >
                          <th style={{ padding: "0.4rem" }}>
                            Purpose
                          </th>
                          <th style={{ padding: "0.4rem" }}>
                            Total
                          </th>
                          <th style={{ padding: "0.4rem" }}>
                            Pass
                          </th>
                          <th style={{ padding: "0.4rem" }}>
                            Fail
                          </th>
                          <th style={{ padding: "0.4rem" }}>
                            Fail rate
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary &&
                          Object.entries(
                            summary.purposes
                          ).map(([purpose, counts]) => {
                            const rate =
                              counts.total > 0
                                ? counts.fail /
                                  counts.total
                                : 0;
                            return (
                              <tr
                                key={purpose}
                                style={{
                                  borderBottom:
                                    "1px solid rgba(15,23,42,0.6)",
                                }}
                              >
                                <td
                                  style={{
                                    padding: "0.4rem",
                                  }}
                                >
                                  {purpose}
                                </td>
                                <td
                                  style={{
                                    padding: "0.4rem",
                                  }}
                                >
                                  {counts.total}
                                </td>
                                <td
                                  style={{
                                    padding: "0.4rem",
                                  }}
                                >
                                  {counts.pass}
                                </td>
                                <td
                                  style={{
                                    padding: "0.4rem",
                                  }}
                                >
                                  {counts.fail}
                                </td>
                                <td
                                  style={{
                                    padding: "0.4rem",
                                  }}
                                >
                                  {percentFromRate(rate)}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p
                    style={{
                      fontSize: "var(--text-sm)",
                      color: "var(--color-text-soft)",
                      fontStyle: "italic",
                    }}
                  >
                    No checks found in this window.
                  </p>
                )}
              </Card>

              <Card
                title="Checks by agent"
                description="Which agents are driving compliance volume and where failures occur."
              >
                {statsByAgent &&
                statsByAgent.agents.length > 0 ? (
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
                            color:
                              "var(--color-text-soft)",
                            borderBottom:
                              "1px solid var(--color-border-subtle)",
                          }}
                        >
                          <th style={{ padding: "0.4rem" }}>
                            Agent
                          </th>
                          <th style={{ padding: "0.4rem" }}>
                            Total
                          </th>
                          <th style={{ padding: "0.4rem" }}>
                            Pass
                          </th>
                          <th style={{ padding: "0.4rem" }}>
                            Fail
                          </th>
                          <th style={{ padding: "0.4rem" }}>
                            Fail rate
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {statsByAgent.agents.map((a) => {
                          const rate =
                            a.total > 0
                              ? a.fail / a.total
                              : 0;
                          return (
                            <tr
                              key={a.userId}
                              style={{
                                borderBottom:
                                  "1px solid rgba(15,23,42,0.6)",
                              }}
                            >
                              <td
                                style={{
                                  padding: "0.4rem",
                                }}
                              >
                                {a.userId}
                              </td>
                              <td
                                style={{
                                  padding: "0.4rem",
                                }}
                              >
                                {a.total}
                              </td>
                              <td
                                style={{
                                  padding: "0.4rem",
                                }}
                              >
                                {a.pass}
                              </td>
                              <td
                                style={{
                                  padding: "0.4rem",
                                }}
                              >
                                {a.fail}
                              </td>
                              <td
                                style={{
                                  padding: "0.4rem",
                                }}
                              >
                                {percentFromRate(rate)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p
                    style={{
                      fontSize: "var(--text-sm)",
                      color: "var(--color-text-soft)",
                      fontStyle: "italic",
                    }}
                  >
                    No per-agent compliance data found in this window.
                  </p>
                )}
              </Card>
            </div>

            {/* Bottom row: recent failures */}
            <Card
              title="Recent failures"
              description="The most recent failed checks, with links to leads."
            >
              {recentFailures &&
              recentFailures.failures.length > 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-2)",
                    maxHeight: "360px",
                    overflowY: "auto",
                  }}
                >
                  {recentFailures.failures.map((f) => (
                    <div
                      key={f.id}
                      style={{
                        padding: "var(--space-3)",
                        borderRadius: "var(--radius-md)",
                        border:
                          "1px solid var(--color-border-subtle)",
                        backgroundColor:
                          "rgba(15,23,42,0.75)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.25rem",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent:
                            "space-between",
                          alignItems: "center",
                          gap: "0.5rem",
                        }}
                      >
                        <div
                          style={{
                            fontSize:
                              "var(--text-sm)",
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
                        <Badge variant="danger">
                          FAIL
                        </Badge>
                      </div>
                      <div
                        style={{
                          fontSize: "var(--text-xs)",
                          color:
                            "var(--color-text-soft)",
                        }}
                      >
                        Agent: {f.userId}
                      </div>
                      <div
                        style={{
                          fontSize: "var(--text-xs)",
                          color:
                            "var(--color-text-soft)",
                        }}
                      >
                        Purpose: {f.purpose}
                      </div>
                      <div
                        style={{
                          fontSize: "var(--text-xs)",
                          color:
                            "var(--color-text-soft)",
                        }}
                      >
                        {formatDateTime(f.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p
                  style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--color-text-soft)",
                    fontStyle: "italic",
                  }}
                >
                  No recent failed checks found.
                </p>
              )}
            </Card>
          </>
        )}

        {/* === TEAM ACTIVITY TAB === */}
        {showTeam && (
          <>
            {errorTeam && (
              <Card title="Unable to load team activity report">
                <p
                  style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--color-danger)",
                  }}
                >
                  {errorTeam}
                </p>
                <div style={{ marginTop: "var(--space-3)" }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={loadTeam}
                  >
                    Retry
                  </Button>
                </div>
              </Card>
            )}

            {teamActivity && (
              <>
                {/* KPIs row */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(4, minmax(0, 1fr))",
                    gap: "var(--space-4)",
                  }}
                >
                  <Card title="Total calls">
                    <div
                      style={{
                        fontSize: "1.8rem",
                        fontWeight: 600,
                      }}
                    >
                      {teamActivity.calls.total}
                    </div>
                    <p
                      style={{
                        marginTop: "var(--space-2)",
                        fontSize: "var(--text-xs)",
                        color: "var(--color-text-soft)",
                      }}
                    >
                      All calls in this window for your scoped team.
                    </p>
                  </Card>

                  <Card title="Open tasks">
                    <div
                      style={{
                        fontSize: "1.8rem",
                        fontWeight: 600,
                        color: "var(--color-warning)",
                      }}
                    >
                      {teamActivity.tasks.open}
                    </div>
                    <p
                      style={{
                        marginTop: "var(--space-2)",
                        fontSize: "var(--text-xs)",
                        color: "var(--color-text-soft)",
                      }}
                    >
                      Tasks currently open for your scoped users.
                    </p>
                  </Card>

                  <Card title="Overdue tasks">
                    <div
                      style={{
                        fontSize: "1.8rem",
                        fontWeight: 600,
                        color: "var(--color-danger)",
                      }}
                    >
                      {teamActivity.tasks.overdueOpen}
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

                  <Card title="Completed tasks">
                    <div
                      style={{
                        fontSize: "1.8rem",
                        fontWeight: 600,
                        color: "var(--color-success)",
                      }}
                    >
                      {teamActivity.tasks.completed}
                    </div>
                    <p
                      style={{
                        marginTop: "var(--space-2)",
                        fontSize: "var(--text-xs)",
                        color: "var(--color-text-soft)",
                      }}
                    >
                      Tasks completed in this window.
                    </p>
                  </Card>
                </div>

                {/* Middle row: leads by status + calls by agent */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "minmax(0, 1.2fr) minmax(0, 1fr)",
                    gap: "var(--space-4)",
                    alignItems: "flex-start",
                  }}
                >
                  <Card
                    title="Leads by status"
                    description="Distribution of leads for your scoped users."
                  >
                    {teamActivity.leads.byStatus.length ===
                    0 ? (
                      <p
                        style={{
                          fontSize: "var(--text-sm)",
                          color: "var(--color-text-soft)",
                          fontStyle: "italic",
                        }}
                      >
                        No leads found in this window.
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
                                color:
                                  "var(--color-text-soft)",
                                borderBottom:
                                  "1px solid var(--color-border-subtle)",
                              }}
                            >
                              <th
                                style={{
                                  padding: "0.4rem",
                                }}
                              >
                                Status
                              </th>
                              <th
                                style={{
                                  padding: "0.4rem",
                                  textAlign: "right",
                                }}
                              >
                                Count
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {teamActivity.leads.byStatus.map(
                              (row) => (
                                <tr
                                  key={row.status}
                                  style={{
                                    borderBottom:
                                      "1px solid rgba(15,23,42,0.6)",
                                  }}
                                >
                                  <td
                                    style={{
                                      padding: "0.4rem",
                                    }}
                                  >
                                    {row.status}
                                  </td>
                                  <td
                                    style={{
                                      padding: "0.4rem",
                                      textAlign: "right",
                                    }}
                                  >
                                    {row.count}
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>

                  <Card
                    title="Calls by agent"
                    description="Call volume across your scoped users."
                  >
                    {teamActivity.calls.byAgent.length ===
                    0 ? (
                      <p
                        style={{
                          fontSize: "var(--text-sm)",
                          color: "var(--color-text-soft)",
                          fontStyle: "italic",
                        }}
                      >
                        No calls found in this window.
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
                                color:
                                  "var(--color-text-soft)",
                                borderBottom:
                                  "1px solid var(--color-border-subtle)",
                              }}
                            >
                              <th
                                style={{
                                  padding: "0.4rem",
                                }}
                              >
                                Agent
                              </th>
                              <th
                                style={{
                                  padding: "0.4rem",
                                  textAlign: "right",
                                }}
                              >
                                Calls
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {teamActivity.calls.byAgent.map(
                              (row) => (
                                <tr
                                  key={row.agentId}
                                  style={{
                                    borderBottom:
                                      "1px solid rgba(15,23,42,0.6)",
                                  }}
                                >
                                  <td
                                    style={{
                                      padding: "0.4rem",
                                    }}
                                  >
                                    {row.agentId}
                                  </td>
                                  <td
                                    style={{
                                      padding: "0.4rem",
                                      textAlign: "right",
                                    }}
                                  >
                                    {row.callCount}
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                </div>

                {/* Bottom row: calls by status + calls by purpose */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "minmax(0, 1.1fr) minmax(0, 1.2fr)",
                    gap: "var(--space-4)",
                    alignItems: "flex-start",
                  }}
                >
                  <Card
                    title="Calls by status"
                    description="Outcome distribution for calls in this window."
                  >
                    {teamActivity.calls.byStatus.length ===
                    0 ? (
                      <p
                        style={{
                          fontSize: "var(--text-sm)",
                          color: "var(--color-text-soft)",
                          fontStyle: "italic",
                        }}
                      >
                        No calls found.
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
                                color:
                                  "var(--color-text-soft)",
                                borderBottom:
                                  "1px solid var(--color-border-subtle)",
                              }}
                            >
                              <th
                                style={{
                                  padding: "0.4rem",
                                }}
                              >
                                Status
                              </th>
                              <th
                                style={{
                                  padding: "0.4rem",
                                  textAlign: "right",
                                }}
                              >
                                Count
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {teamActivity.calls.byStatus.map(
                              (row) => (
                                <tr
                                  key={row.status}
                                  style={{
                                    borderBottom:
                                      "1px solid rgba(15,23,42,0.6)",
                                  }}
                                >
                                  <td
                                    style={{
                                      padding: "0.4rem",
                                    }}
                                  >
                                    {row.status}
                                  </td>
                                  <td
                                    style={{
                                      padding: "0.4rem",
                                      textAlign: "right",
                                    }}
                                  >
                                    {row.count}
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>

                  <Card
                    title="Calls by purpose"
                    description="Which call purposes are driving volume."
                  >
                    {teamActivity.calls.byPurpose.length ===
                    0 ? (
                      <p
                        style={{
                          fontSize: "var(--text-sm)",
                          color: "var(--color-text-soft)",
                          fontStyle: "italic",
                        }}
                      >
                        No calls found.
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
                                color:
                                  "var(--color-text-soft)",
                                borderBottom:
                                  "1px solid var(--color-border-subtle)",
                              }}
                            >
                              <th
                                style={{
                                  padding: "0.4rem",
                                }}
                              >
                                Purpose
                              </th>
                              <th
                                style={{
                                  padding: "0.4rem",
                                  textAlign: "right",
                                }}
                              >
                                Count
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {teamActivity.calls.byPurpose.map(
                              (row) => (
                                <tr
                                  key={row.purpose}
                                  style={{
                                    borderBottom:
                                      "1px solid rgba(15,23,42,0.6)",
                                  }}
                                >
                                  <td
                                    style={{
                                      padding: "0.4rem",
                                    }}
                                  >
                                    {row.purpose}
                                  </td>
                                  <td
                                    style={{
                                      padding: "0.4rem",
                                      textAlign: "right",
                                    }}
                                  >
                                    {row.count}
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                </div>
              </>
            )}

            {loadingTeam && !teamActivity && (
              <p
                style={{
                  fontSize: "var(--text-sm)",
                  color: "var(--color-text-soft)",
                }}
              >
                Loading team activity…
              </p>
            )}
          </>
        )}

        {/* === SCRIPT USAGE TAB === */}
        {showScripts && (
          <>
            {errorScripts && (
              <Card title="Unable to load script usage report">
                <p
                  style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--color-danger)",
                  }}
                >
                  {errorScripts}
                </p>
                <div style={{ marginTop: "var(--space-3)" }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={loadScriptsUsage}
                  >
                    Retry
                  </Button>
                </div>
              </Card>
            )}

            <Card
              title="Script usage"
              description="How interactive call scripts are being used by your scoped users."
            >
              {loadingScripts && scriptUsage.length === 0 ? (
                <p
                  style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--color-text-soft)",
                  }}
                >
                  Loading script usage…
                </p>
              ) : scriptUsage.length === 0 ? (
                <p
                  style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--color-text-soft)",
                    fontStyle: "italic",
                  }}
                >
                  No script runs found in this window.
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
                        <th style={{ padding: "0.4rem" }}>
                          Script
                        </th>
                        <th style={{ padding: "0.4rem" }}>
                          Purpose
                        </th>
                        <th style={{ padding: "0.4rem" }}>
                          Active
                        </th>
                        <th style={{ padding: "0.4rem" }}>
                          Runs
                        </th>
                        <th style={{ padding: "0.4rem" }}>
                          Completed
                        </th>
                        <th style={{ padding: "0.4rem" }}>
                          Abandoned
                        </th>
                        <th style={{ padding: "0.4rem" }}>
                          Completion rate
                        </th>
                        <th style={{ padding: "0.4rem" }}>
                          Last run
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {scriptUsage.map((row) => (
                        <tr
                          key={row.scriptId}
                          style={{
                            borderBottom:
                              "1px solid rgba(15,23,42,0.6)",
                          }}
                        >
                          <td
                            style={{
                              padding: "0.4rem",
                            }}
                          >
                            {row.scriptName}
                          </td>
                          <td
                            style={{
                              padding: "0.4rem",
                            }}
                          >
                            {row.purpose}
                          </td>
                          <td
                            style={{
                              padding: "0.4rem",
                            }}
                          >
                            <Badge
                              variant={
                                row.isActive
                                  ? "success"
                                  : "secondary"
                              }
                            >
                              {row.isActive
                                ? "Active"
                                : "Inactive"}
                            </Badge>
                          </td>
                          <td
                            style={{
                              padding: "0.4rem",
                            }}
                          >
                            {row.runCount}
                          </td>
                          <td
                            style={{
                              padding: "0.4rem",
                            }}
                          >
                            {row.completedCount}
                          </td>
                          <td
                            style={{
                              padding: "0.4rem",
                            }}
                          >
                            {row.abandonedCount}
                          </td>
                          <td
                            style={{
                              padding: "0.4rem",
                            }}
                          >
                            {percentFromRate(
                              row.completionRate
                            )}
                          </td>
                          <td
                            style={{
                              padding: "0.4rem",
                            }}
                          >
                            {row.lastRunAt
                              ? formatDateTime(
                                  row.lastRunAt
                                )
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
};

export default ComplianceReportsPage;

