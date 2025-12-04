// apps/web/src/routes/calls/CoachingQueue.tsx

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import {
  getCoachingQueue,
  type CoachingQueueItem,
} from "../../lib/apiClient";

function callStatusVariant(status: string): "success" | "warning" | "danger" {
  if (status === "COMPLETED" || status === "CONNECTED") return "success";
  if (status === "FAILED" || status === "ABANDONED") return "danger";
  return "warning";
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

const CoachingQueuePage: React.FC = () => {
  const [items, setItems] = useState<CoachingQueueItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await getCoachingQueue(50);
      setItems(res.items || []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load coaching queue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

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
            Coaching review
          </h1>
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-soft)",
              maxWidth: "40rem",
            }}
          >
            Calls with coaching notes, ordered by most recently coached. Use
            this to spot coaching patterns, follow up on low scores, and
            quickly jump into call details.
          </p>
        </div>

        {/* Controls */}
        <Card
          title="Filters & actions"
          description="Refresh the coaching queue to pick up new notes."
          actions={
            <Button
              variant="secondary"
              size="sm"
              isLoading={loading}
              onClick={() => {
                void load();
              }}
            >
              Refresh
            </Button>
          }
        >
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-soft)",
            }}
          >
            Showing up to 50 most recently coached calls in your scope.
          </p>
          {error && (
            <p
              style={{
                marginTop: "var(--space-2)",
                fontSize: "var(--text-sm)",
                color: "var(--color-danger)",
              }}
            >
              {error}
            </p>
          )}
        </Card>

        {/* Table */}
        <Card
          title="Coached calls"
          description={
            items.length === 0
              ? "No coached calls found."
              : `Showing ${items.length} coached calls.`
          }
        >
          {loading && items.length === 0 && !error ? (
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-soft)",
              }}
            >
              Loading coaching queue…
            </p>
          ) : items.length === 0 ? (
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-soft)",
                fontStyle: "italic",
              }}
            >
              No coaching activity found in your scope yet.
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
                    <th style={{ padding: "0.5rem" }}>Last coached</th>
                    <th style={{ padding: "0.5rem" }}>Score</th>
                    <th style={{ padding: "0.5rem" }}>Notes</th>
                    <th style={{ padding: "0.5rem" }} />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.callId}
                      style={{
                        borderBottom:
                          "1px solid rgba(15,23,42,0.6)",
                      }}
                    >
                      <td style={{ padding: "0.5rem" }}>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.1rem",
                          }}
                        >
                          <Link
                            to={`/calls/${item.callId}`}
                            style={{
                              color: "var(--color-primary)",
                              textDecoration: "none",
                            }}
                          >
                            {item.callId.slice(0, 8)}…
                          </Link>
                        </div>
                      </td>
                      <td style={{ padding: "0.5rem" }}>
                        <Link
                          to={`/leads/${item.leadId}`}
                          style={{
                            color: "var(--color-primary)",
                            textDecoration: "none",
                            fontSize: "var(--text-xs)",
                          }}
                        >
                          {item.leadId}
                        </Link>
                      </td>
                      <td style={{ padding: "0.5rem" }}>
                        <span
                          style={{
                            fontSize: "var(--text-xs)",
                            color: "var(--color-text-soft)",
                          }}
                        >
                          {item.agentId}
                        </span>
                      </td>
                      <td style={{ padding: "0.5rem" }}>
                        {item.direction}
                      </td>
                      <td style={{ padding: "0.5rem" }}>
                        {item.purpose}
                      </td>
                      <td style={{ padding: "0.5rem" }}>
                        <Badge
                          variant={callStatusVariant(item.status)}
                        >
                          {item.status.toLowerCase()}
                        </Badge>
                      </td>
                      <td style={{ padding: "0.5rem" }}>
                        <span
                          style={{
                            fontSize: "var(--text-xs)",
                            color: "var(--color-text-soft)",
                          }}
                        >
                          {formatDate(item.lastCoachedAt)}
                        </span>
                      </td>
                      <td style={{ padding: "0.5rem" }}>
                        {item.lastScore !== null ? (
                          <span
                            style={{
                              fontSize: "var(--text-xs)",
                            }}
                          >
                            {item.lastScore}/100
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: "var(--text-xs)",
                              color: "var(--color-text-soft)",
                            }}
                          >
                            —
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "0.5rem" }}>
                        <span
                          style={{
                            fontSize: "var(--text-xs)",
                            color: "var(--color-text-soft)",
                          }}
                        >
                          {item.noteCount}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "0.5rem",
                          textAlign: "right",
                        }}
                      >
                        <Link to={`/calls/${item.callId}`}>
                          <Button variant="ghost" size="sm">
                            Review
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
};

export default CoachingQueuePage;

