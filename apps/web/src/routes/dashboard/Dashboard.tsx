// apps/web/src/routes/dashboard/Dashboard.tsx

import React, { useEffect, useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { getDashboard, type DashboardResponse } from "../../lib/apiClient";

const DashboardPage: React.FC = () => {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await getDashboard();
        if (!mounted) return;
        setData(res);
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

  const role = (data as any)?.role ?? null;

  function renderHeader() {
    let title = "Dashboard";
    let subtitle =
      "High-level overview of what needs your attention across leads, tasks, and compliance.";

    if (role === "AGENT") {
      title = "Agent dashboard";
      subtitle =
        "Your leads, tasks, and compliance activity at a glance.";
    } else if (role === "MANAGER") {
      title = "Manager dashboard";
      subtitle =
        "Overview of team compliance, workload, and lead flow.";
    } else if (role === "ADMIN") {
      title = "Admin dashboard";
      subtitle =
        "Organization-wide view of leads, compliance, imports, and audit activity.";
    }

    return (
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
          {title}
        </h1>
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--color-text-soft)",
            maxWidth: "40rem",
          }}
        >
          {subtitle}
        </p>
      </div>
    );
  }

  function renderAgentCards() {
    const cards = (data as any)?.cards ?? {};
    const leadsNeedingAttention = cards.leadsNeedingAttention?.count ?? 0;
    const tasksDue = cards.tasksDueTodayOrOverdue?.count ?? 0;
    const failures =
      cards.recentComplianceFailures?.items ??
      [];
    const scriptRuns =
      cards.recentScriptRuns?.items ?? [];

    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "var(--space-4)",
        }}
      >
        <Card
          title="Leads needing attention"
          description="Active leads assigned to you that are not yet closed or DNC."
        >
          <div
            style={{
              fontSize: "var(--text-2xl)",
              fontWeight: 600,
            }}
          >
            {leadsNeedingAttention}
          </div>
        </Card>

        <Card
          title="Tasks due today / overdue"
          description="Open or in-progress tasks that are due now or in the past."
        >
          <div
            style={{
              fontSize: "var(--text-2xl)",
              fontWeight: 600,
            }}
          >
            {tasksDue}
          </div>
        </Card>

        <Card
          title="Recent compliance failures"
          description="Latest failed compliance checks for your leads."
        >
          {failures.length === 0 ? (
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
              {failures.map((f: any) => (
                <li key={f.id}>
                  <div
                    style={{
                      fontSize: "var(--text-sm)",
                      fontWeight: 500,
                    }}
                  >
                    {f.purpose}
                  </div>
                  <div
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-soft)",
                    }}
                  >
                    Lead {f.leadId} •{" "}
                    {new Date(
                      f.createdAt
                    ).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Recent scripted calls"
          description="Latest scripted call runs you’ve completed."
        >
          {scriptRuns.length === 0 ? (
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-soft)",
              }}
            >
              No recent scripted calls.
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
              {scriptRuns.map((r: any) => (
                <li key={r.id}>
                  <div
                    style={{
                      fontSize: "var(--text-sm)",
                      fontWeight: 500,
                    }}
                  >
                    {r.status}
                  </div>
                  <div
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-soft)",
                    }}
                  >
                    Lead {r.leadId} •{" "}
                    {new Date(
                      r.startedAt
                    ).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    );
  }

  function renderManagerAdminCards() {
    const cards = (data as any)?.cards ?? {};
    const compliance = cards.teamComplianceSummary ?? {};
    const overdueTasks = cards.overdueTasks?.count ?? 0;
    const distribution =
      cards.leadDistributionByStatus ?? [];
    const highRisk =
      cards.highRiskLeads?.items ?? [];
    const imports =
      cards.recentLeadImports?.items ?? [];

    const passRatePct = Math.round(
      (compliance.passRate ?? 0) * 100
    );

    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "var(--space-4)",
        }}
      >
        <Card
          title="Team compliance summary"
          description="Pass/fail overview for compliance checks in your org."
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <div
              style={{
                fontSize: "var(--text-2xl)",
                fontWeight: 600,
              }}
            >
              {passRatePct}%
              <span
                style={{
                  fontSize: "var(--text-sm)",
                  marginLeft: "0.25rem",
                  color: "var(--color-text-soft)",
                }}
              >
                pass rate
              </span>
            </div>
            <div
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--color-text-soft)",
              }}
            >
              {compliance.totalChecks ?? 0} checks •{" "}
              <span>Pass: {compliance.passCount ?? 0}</span>{" "}
              • <span>Fail: {compliance.failCount ?? 0}</span>
            </div>
          </div>
        </Card>

        <Card
          title="Overdue tasks"
          description="Open or in-progress tasks that are past due."
        >
          <div
            style={{
              fontSize: "var(--text-2xl)",
              fontWeight: 600,
            }}
          >
            {overdueTasks}
          </div>
        </Card>

        <Card
          title="Lead distribution by status"
          description="How leads are distributed across statuses."
        >
          {distribution.length === 0 ? (
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-soft)",
              }}
            >
              No leads found.
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
              {distribution.map((row: any) => (
                <li
                  key={row.status}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "var(--text-sm)",
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
          description="Leads with repeated compliance failures."
        >
          {highRisk.length === 0 ? (
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-soft)",
              }}
            >
              No high-risk leads identified yet.
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
              {highRisk.map((row: any) => (
                <li
                  key={row.leadId}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "var(--text-sm)",
                  }}
                >
                  <span>Lead {row.leadId}</span>
                  <Badge variant="danger">
                    {row.failCount} fails
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Recent lead imports"
          description="Latest manual or API-based lead imports."
        >
          {imports.length === 0 ? (
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-soft)",
              }}
            >
              No recent lead imports.
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
              {imports.map((imp: any) => (
                <li key={imp.id}>
                  <div
                    style={{
                      fontSize: "var(--text-sm)",
                      fontWeight: 500,
                    }}
                  >
                    {imp.label || "Unnamed import"}
                  </div>
                  <div
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-soft)",
                    }}
                  >
                    {imp.totalRows} rows • inserted{" "}
                    {imp.insertedCount} • duplicates{" "}
                    {imp.duplicateCount} • errors{" "}
                    {imp.errorCount}
                    <br />
                    {new Date(
                      imp.createdAt
                    ).toLocaleString()}{" "}
                    {imp.source
                      ? `• source: ${imp.source}`
                      : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    );
  }

  function renderRoleCards() {
    if (!data) return null;
    if (role === "AGENT") {
      return renderAgentCards();
    }
    if (role === "MANAGER" || role === "ADMIN") {
      return renderManagerAdminCards();
    }

    // COMPLIANCE / READ_ONLY etc → use manager/admin-style view for now
    return renderManagerAdminCards();
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
        {renderHeader()}

        {loading && (
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-soft)",
            }}
          >
            Loading dashboard…
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

        {!loading && !error && data && renderRoleCards()}
      </div>
    </AppShell>
  );
};

export default DashboardPage;

