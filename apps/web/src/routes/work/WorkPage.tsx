// apps/web/src/routes/work/WorkPage.tsx

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { getWorkQueue, type WorkItem } from "../../lib/apiClient";
import { useAuth } from "../../lib/auth";

const WorkPage: React.FC = () => {
  const { user } = useAuth() as { user: any | null };

  const [items, setItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  async function loadQueue() {
    setLoading(true);
    setError(null);
    try {
      const res = await getWorkQueue();
      setItems(res.items || []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load work queue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            Work queue
          </h1>
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-soft)",
              maxWidth: "40rem",
            }}
          >
            A simple queue of work items (currently tasks) scoped to your role
            and team. Use this to drive your day from one place, then jump into
            the lead when you&apos;re ready.
          </p>
        </div>

        {/* Summary */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: "var(--space-4)",
          }}
        >
          <Card title="Total items">
            <div
              style={{
                fontSize: "1.75rem",
                fontWeight: 600,
              }}
            >
              {items.length}
            </div>
            <p
              style={{
                marginTop: "var(--space-2)",
                fontSize: "var(--text-xs)",
                color: "var(--color-text-soft)",
              }}
            >
              Loaded from your current organization.
            </p>
          </Card>
          <Card title="Tasks">
            <div
              style={{
                fontSize: "1.75rem",
                fontWeight: 600,
              }}
            >
              {items.filter((i) => i.type === "TASK").length}
            </div>
            <p
              style={{
                marginTop: "var(--space-2)",
                fontSize: "var(--text-xs)",
                color: "var(--color-text-soft)",
              }}
            >
              Items currently backed by tasks.
            </p>
          </Card>
          <Card title="User">
            <div
              style={{
                fontSize: "1rem",
                fontWeight: 500,
              }}
            >
              {user?.email ?? "Unknown"}
            </div>
            <p
              style={{
                marginTop: "var(--space-2)",
                fontSize: "var(--text-xs)",
                color: "var(--color-text-soft)",
              }}
            >
              Queue is scoped by your role and team.
            </p>
          </Card>
        </div>

        {/* Queue table */}
        <Card
          title="Queue"
          description={
            items.length === 0
              ? "No work items available right now."
              : `Showing ${items.length} items.`
          }
          actions={
            <Button
              variant="secondary"
              size="sm"
              isLoading={loading}
              onClick={() => {
                void loadQueue();
              }}
            >
              Refresh
            </Button>
          }
        >
          {error && (
            <div
              style={{
                marginBottom: "var(--space-3)",
                fontSize: "var(--text-sm)",
                color: "var(--color-danger)",
              }}
            >
              {error}
            </div>
          )}

          {loading && items.length === 0 ? (
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-soft)",
              }}
            >
              Loading work queue…
            </p>
          ) : items.length === 0 ? (
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-soft)",
              }}
            >
              No items in your work queue. Try creating tasks from the lead
              detail page.
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
                    <th style={{ padding: "0.5rem" }}>Type</th>
                    <th style={{ padding: "0.5rem" }}>Lead</th>
                    <th style={{ padding: "0.5rem" }}>Created</th>
                    <th
                      style={{
                        padding: "0.5rem",
                        textAlign: "right",
                      }}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: "1px solid rgba(15,23,42,0.6)",
                      }}
                    >
                      <td style={{ padding: "0.5rem" }}>
                        <Badge variant="secondary">{item.type}</Badge>
                      </td>
                      <td style={{ padding: "0.5rem" }}>
                        {item.leadId ? (
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
                          {new Date(item.createdAt).toLocaleString()}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "0.5rem",
                          textAlign: "right",
                        }}
                      >
                        {item.leadId && (
                          <Button size="sm" variant="secondary">
                            <Link
                              to={`/leads/${item.leadId}`}
                              style={{
                                color: "inherit",
                                textDecoration: "none",
                              }}
                            >
                              Go to lead
                            </Link>
                          </Button>
                        )}
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

export default WorkPage;

