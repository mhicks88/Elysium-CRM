import React, { useEffect, useState } from "react";
import { useAuth } from "../../lib/auth";
import {
  getComplianceSummary,
  getComplianceStatsByAgent,
  getRecentComplianceFailures,
} from "../../lib/apiClient";

type Role =
  | "ADMIN"
  | "AGENT"
  | "VIEW_ONLY"
  | "MANAGER"
  | "COMPLIANCE_OFFICER";

interface RequireRoleProps {
  roles: Role[];
  children: React.ReactNode;
}

export function RequireRole({ roles, children }: RequireRoleProps) {
  const { user } = useAuth() as { user: any | null };

  // If we truly have no user in context, just show a message,
  // don't hard-redirect to /login. This avoids the redirect loop
  // you're seeing while keeping the page protected.
  if (!user) {
    return (
      <div style={{ padding: "2rem" }}>
        <h1>Not authenticated</h1>
        <p>Please log in as an authorized user to view this page.</p>
      </div>
    );
  }

  const userRole = user.role as Role | undefined;

  if (!userRole || !roles.includes(userRole)) {
    return (
      <div style={{ padding: "2rem" }}>
        <h1>Access denied</h1>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  return <>{children}</>;
}

interface SummaryState {
  totalChecks: number;
  passCount: number;
  failCount: number;
  failRate: number;
  purposes: Record<
    string,
    { total: number; pass: number; fail: number }
  >;
  firstCheckAt: string | null;
  lastCheckAt: string | null;
}

export default function Admin() {
  const [summary, setSummary] = useState<SummaryState | null>(null);
  const [agentStats, setAgentStats] = useState<
    { userId: string; total: number; pass: number; fail: number }[]
  >([]);
  const [failures, setFailures] = useState<
    {
      id: string;
      leadId: string;
      userId: string;
      purpose: string;
      status: "PASS" | "FAIL";
      result: any;
      createdAt: string;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [summaryRes, agentRes, failuresRes] = await Promise.all([
          getComplianceSummary(),
          getComplianceStatsByAgent(),
          getRecentComplianceFailures(20),
        ]);

        if (!mounted) return;

        setSummary(summaryRes);
        setAgentStats(agentRes.agents || []);
        setFailures(failuresRes.failures || []);
      } catch (err: any) {
        if (!mounted) return;
        setError(
          err?.message || "Failed to load compliance dashboard data"
        );
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <RequireRole roles={["ADMIN"]}>
      <div style={{ padding: "2rem", maxWidth: 1200, margin: "0 auto" }}>
        <h1 style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}>
          Compliance Dashboard
        </h1>
        <p style={{ color: "#6b7280", marginBottom: "1.5rem" }}>
          Overview of pre-call compliance checks across the organization.
        </p>

        {error && (
          <div
            style={{
              marginBottom: "1rem",
              padding: "0.75rem 1rem",
              borderRadius: 8,
              backgroundColor: "#fee2e2",
              color: "#b91c1c",
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        {loading && !summary && <p>Loading dashboard...</p>}

        {summary && (
          <>
            {/* Summary cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "1rem",
                marginBottom: "1.5rem",
              }}
            >
              <SummaryCard
                label="Total checks"
                value={summary.totalChecks}
              />
              <SummaryCard
                label="Passes"
                value={summary.passCount}
              />
              <SummaryCard
                label="Failures"
                value={summary.failCount}
              />
              <SummaryCard
                label="Failure rate"
                value={
                  summary.failRate > 0
                    ? `${(summary.failRate * 100).toFixed(1)}%`
                    : "0%"
                }
              />
            </div>

            {/* Purpose breakdown */}
            <section
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: "1rem",
                marginBottom: "1.5rem",
                backgroundColor: "#ffffff",
              }}
            >
              <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>
                Checks by purpose
              </h2>
              {Object.keys(summary.purposes).length === 0 ? (
                <p style={{ fontStyle: "italic" }}>
                  No compliance checks recorded yet.
                </p>
              ) : (
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 14,
                  }}
                >
                  <thead>
                    <tr>
                      <th
                        style={{
                          textAlign: "left",
                          padding: "0.5rem",
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        Purpose
                      </th>
                      <th
                        style={{
                          textAlign: "right",
                          padding: "0.5rem",
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        Total
                      </th>
                      <th
                        style={{
                          textAlign: "right",
                          padding: "0.5rem",
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        Pass
                      </th>
                      <th
                        style={{
                          textAlign: "right",
                          padding: "0.5rem",
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        Fail
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(summary.purposes).map(
                      ([purpose, stats]) => (
                        <tr key={purpose}>
                          <td
                            style={{
                              padding: "0.5rem",
                              borderBottom: "1px solid #f3f4f6",
                            }}
                          >
                            {purpose}
                          </td>
                          <td
                            style={{
                              padding: "0.5rem",
                              textAlign: "right",
                              borderBottom: "1px solid #f3f4f6",
                            }}
                          >
                            {stats.total}
                          </td>
                          <td
                            style={{
                              padding: "0.5rem",
                              textAlign: "right",
                              borderBottom: "1px solid #f3f4f6",
                            }}
                          >
                            {stats.pass}
                          </td>
                          <td
                            style={{
                              padding: "0.5rem",
                              textAlign: "right",
                              borderBottom: "1px solid #f3f4f6",
                            }}
                          >
                            {stats.fail}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              )}
            </section>

            {/* Agent breakdown */}
            <section
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: "1rem",
                marginBottom: "1.5rem",
                backgroundColor: "#ffffff",
              }}
            >
              <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>
                Checks by agent
              </h2>
              {agentStats.length === 0 ? (
                <p style={{ fontStyle: "italic" }}>
                  No agent compliance activity yet.
                </p>
              ) : (
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 14,
                  }}
                >
                  <thead>
                    <tr>
                      <th
                        style={{
                          textAlign: "left",
                          padding: "0.5rem",
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        Agent (userId)
                      </th>
                      <th
                        style={{
                          textAlign: "right",
                          padding: "0.5rem",
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        Total
                      </th>
                      <th
                        style={{
                          textAlign: "right",
                          padding: "0.5rem",
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        Pass
                      </th>
                      <th
                        style={{
                          textAlign: "right",
                          padding: "0.5rem",
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        Fail
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentStats.map((agent) => (
                      <tr key={agent.userId}>
                        <td
                          style={{
                            padding: "0.5rem",
                            borderBottom: "1px solid #f3f4f6",
                          }}
                        >
                          {agent.userId}
                        </td>
                        <td
                          style={{
                            padding: "0.5rem",
                            textAlign: "right",
                            borderBottom: "1px solid #f3f4f6",
                          }}
                        >
                          {agent.total}
                        </td>
                        <td
                          style={{
                            padding: "0.5rem",
                            textAlign: "right",
                            borderBottom: "1px solid #f3f4f6",
                          }}
                        >
                          {agent.pass}
                        </td>
                        <td
                          style={{
                            padding: "0.5rem",
                            textAlign: "right",
                            borderBottom: "1px solid #f3f4f6",
                          }}
                        >
                          {agent.fail}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            {/* Recent failures */}
            <section
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: "1rem",
                marginBottom: "1.5rem",
                backgroundColor: "#ffffff",
              }}
            >
              <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>
                Recent failed checks
              </h2>
              {failures.length === 0 ? (
                <p style={{ fontStyle: "italic" }}>
                  No failed compliance checks recorded.
                </p>
              ) : (
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 13,
                  }}
                >
                  <thead>
                    <tr>
                      <th
                        style={{
                          textAlign: "left",
                          padding: "0.5rem",
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        Time
                      </th>
                      <th
                        style={{
                          textAlign: "left",
                          padding: "0.5rem",
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        Lead ID
                      </th>
                      <th
                        style={{
                          textAlign: "left",
                          padding: "0.5rem",
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        Agent
                      </th>
                      <th
                        style={{
                          textAlign: "left",
                          padding: "0.5rem",
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        Purpose
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {failures.map((f) => (
                      <tr key={f.id}>
                        <td
                          style={{
                            padding: "0.5rem",
                            borderBottom: "1px solid #f3f4f6",
                          }}
                        >
                          {new Date(f.createdAt).toLocaleString()}
                        </td>
                        <td
                          style={{
                            padding: "0.5rem",
                            borderBottom: "1px solid #f3f4f6",
                          }}
                        >
                          {f.leadId}
                        </td>
                        <td
                          style={{
                            padding: "0.5rem",
                            borderBottom: "1px solid #f3f4f6",
                          }}
                        >
                          {f.userId}
                        </td>
                        <td
                          style={{
                            padding: "0.5rem",
                            borderBottom: "1px solid #f3f4f6",
                          }}
                        >
                          {f.purpose}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </>
        )}
      </div>
    </RequireRole>
  );
}

const SummaryCard: React.FC<{ label: string; value: number | string }> = ({
  label,
  value,
}) => {
  return (
    <div
      style={{
        padding: "1rem",
        borderRadius: 8,
        border: "1px solid #e5e7eb",
        backgroundColor: "#ffffff",
      }}
    >
      <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: "1.4rem", fontWeight: 600 }}>{value}</div>
    </div>
  );
};

