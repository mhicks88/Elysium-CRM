// apps/web/src/routes/calls/Calls.tsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { getCalls, type CallSessionDto } from "../../lib/apiClient";

const Calls: React.FC = () => {
  const [calls, setCalls] = useState<CallSessionDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [leadIdFilter, setLeadIdFilter] = useState<string>("");
  const [limit, setLimit] = useState<number>(50);

  async function loadCalls(opts?: { leadId?: string; limit?: number }) {
    setLoading(true);
    setError(null);
    try {
      const res = await getCalls({
        leadId: opts?.leadId ?? (leadIdFilter.trim() || undefined),
        limit: opts?.limit ?? limit,
      });
      setCalls(res.calls || []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load calls");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCalls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function formatDate(value: string | null): string {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
  }

  function statusVariant(status: string): "success" | "warning" | "danger" {
    if (status === "COMPLETED" || status === "CONNECTED") return "success";
    if (status === "FAILED" || status === "ABANDONED") return "danger";
    return "warning";
  }

  function complianceVariant(
    state: string
  ): "success" | "warning" | "danger" {
    if (state === "PRE_CALL_CHECKS_PASSED") return "success";
    if (state === "PRE_CALL_CHECKS_FAILED") return "danger";
    return "warning";
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
        {/* Page header */}
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
            Calls
          </h1>
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-soft)",
              maxWidth: "38rem",
            }}
          >
            Recent call sessions with their direction, purpose, status, and
            compliance state. Use this to review call history by lead.
          </p>
        </div>

        {/* Filters */}
        <Card
          title="Filters"
          description="Slice calls by lead and change the result size."
          actions={
            <Button
              size="sm"
              variant="secondary"
              isLoading={loading}
              onClick={() => {
                void loadCalls();
              }}
            >
              Apply
            </Button>
          }
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
              gap: "var(--space-4)",
              alignItems: "flex-end",
            }}
          >
            <Input
              label="Lead ID"
              placeholder="Filter by leadId (optional)"
              value={leadIdFilter}
              onChange={(e) => setLeadIdFilter(e.target.value)}
            />
            <Input
              label="Max rows"
              type="number"
              min={1}
              max={200}
              value={String(limit)}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!Number.isNaN(v)) setLimit(v);
              }}
            />
          </div>
          {error && (
            <div
              style={{
                marginTop: "var(--space-3)",
                fontSize: "var(--text-sm)",
                color: "var(--color-danger)",
              }}
            >
              {error}
            </div>
          )}
        </Card>

        {/* Calls list */}
        <Card
          title="Recent calls"
          description="Calls the current user is allowed to see based on role and team hierarchy."
        >
          {calls.length === 0 && !loading ? (
            <p
              style={{
                fontStyle: "italic",
                fontSize: "var(--text-sm)",
                color: "var(--color-text-soft)",
              }}
            >
              No call sessions found for this filter.
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
                    <th style={{ padding: "0.5rem" }}>Call</th>
                    <th style={{ padding: "0.5rem" }}>Lead</th>
                    <th style={{ padding: "0.5rem" }}>Agent</th>
                    <th style={{ padding: "0.5rem" }}>Direction</th>
                    <th style={{ padding: "0.5rem" }}>Purpose</th>
                    <th style={{ padding: "0.5rem" }}>Status</th>
                    <th style={{ padding: "0.5rem" }}>Compliance</th>
                    <th style={{ padding: "0.5rem" }}>Started</th>
                    <th style={{ padding: "0.5rem" }}>Ended</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((call) => (
                    <tr
                      key={call.id}
                      style={{
                        borderBottom:
                          "1px solid rgba(15,23,42,0.6)",
                      }}
                    >
                      <td style={{ padding: "0.5rem" }}>
                        <Link
                          to={`/calls/${call.id}`}
                          style={{
                            color: "var(--color-primary)",
                            textDecoration: "none",
                          }}
                        >
                          {call.id.slice(0, 8)}…
                        </Link>
                      </td>
                      <td style={{ padding: "0.5rem" }}>
                        {call.leadId}
                      </td>
                      <td style={{ padding: "0.5rem" }}>
                        {call.agentId}
                      </td>
                      <td style={{ padding: "0.5rem" }}>
                        {call.direction}
                      </td>
                      <td style={{ padding: "0.5rem" }}>
                        {call.purpose}
                      </td>
                      <td style={{ padding: "0.5rem" }}>
                        <Badge variant={statusVariant(call.status)}>
                          {call.status.toLowerCase()}
                        </Badge>
                      </td>
                      <td style={{ padding: "0.5rem" }}>
                        <Badge
                          variant={complianceVariant(
                            call.complianceState
                          )}
                        >
                          {call.complianceState}
                        </Badge>
                      </td>
                      <td style={{ padding: "0.5rem" }}>
                        {formatDate(call.startedAt)}
                      </td>
                      <td style={{ padding: "0.5rem" }}>
                        {formatDate(call.endedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {loading && (
            <p
              style={{
                marginTop: "var(--space-2)",
                fontSize: "var(--text-sm)",
                color: "var(--color-text-soft)",
              }}
            >
              Loading calls…
            </p>
          )}
        </Card>
      </div>
    </AppShell>
  );
};

export default Calls;

