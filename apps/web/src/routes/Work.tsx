// apps/web/src/routes/work/Work.tsx

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { apiFetch } from "../../lib/apiClient";
import { useAuth } from "../../lib/auth";

type Role =
  | "ADMIN"
  | "MANAGER"
  | "DIRECTOR"
  | "AGENT"
  | "COMPLIANCE"
  | "READ_ONLY";

interface WorkLead {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  state: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  permissionToContactPhone: boolean;
  doNotContact: boolean;
  assignedToUserId: string | null;
  score?: number;
}

interface WorkReasoning {
  score: number;
  openTasksCount: number;
  lastCallAt: string | null;
  lastCallStatus: string | null;
}

const WorkPage: React.FC = () => {
  const { user } = useAuth() as { user: any | null };
  const role = (user?.role ?? null) as Role | null;

  const [lead, setLead] = useState<WorkLead | null>(null);
  const [reasoning, setReasoning] = useState<WorkReasoning | null>(
    null
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  async function loadNextLead() {
    setLoading(true);
    setError(null);
    try {
      const res = (await apiFetch<{
        lead: WorkLead | null;
        reasoning: WorkReasoning | null;
      }>("/api/work/next-lead", { method: "GET" })) as {
        lead: WorkLead | null;
        reasoning: WorkReasoning | null;
      };
      setLead(res.lead);
      setReasoning(res.reasoning);
    } catch (err: any) {
      setError(err?.message ?? "Failed to fetch next lead");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadNextLead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function statusVariant(status: string): "success" | "warning" | "danger" | "neutral" {
    if (status === "ENROLLED") return "success";
    if (status === "DO_NOT_CONTACT") return "danger";
    if (
      status === "IN_DISCUSSION" ||
      status === "CONTACTED" ||
      status === "CONTACT_ATTEMPTED" ||
      status === "SOA_REQUIRED" ||
      status === "SOA_COMPLETED"
    ) {
      return "warning";
    }
    if (status === "NOT_INTERESTED") return "neutral";
    return "neutral";
  }

  function formatDate(value: string | null | undefined): string {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
  }

  const headerTitle =
    role === "AGENT"
      ? "Work queue"
      : role === "MANAGER" || role === "DIRECTOR"
      ? "Team work queue"
      : role === "ADMIN"
      ? "Organization work queue"
      : "Work queue";

  const headerSubtitle =
    role === "AGENT"
      ? "Your next best lead to call based on priority and recency."
      : role === "MANAGER" || role === "DIRECTOR"
      ? "Top-priority leads in your team’s scope."
      : role === "ADMIN"
      ? "Highest-priority leads across the org."
      : "Prioritized lead suggestions based on your scope.";

  return (
    <AppShell>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-6)",
        }}
      >
        {/* Header row */}
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
              {headerTitle}
            </h1>
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-soft)",
                maxWidth: "40rem",
              }}
            >
              {headerSubtitle}
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: "var(--space-2)",
            }}
          >
            <Button
              variant="secondary"
              size="sm"
              isLoading={loading}
              onClick={() => {
                void loadNextLead();
              }}
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Error / loading / empty state */}
        {error && (
          <Card title="Unable to fetch next lead">
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-danger)",
              }}
            >
              {error}
            </p>
          </Card>
        )}

        {loading && (
          <Card title="Finding your next lead">
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-soft)",
              }}
            >
              Computing a prioritized lead based on your scope…
            </p>
          </Card>
        )}

        {!loading && !error && !lead && (
          <Card title="No leads to work right now">
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-soft)",
              }}
            >
              There are no active leads matching your scope and filters. Once
              new leads are imported or assigned, they’ll appear here.
            </p>
          </Card>
        )}

        {!loading && !error && lead && (
          <>
            <Card
              title="Next best lead"
              description="This lead was chosen based on score, recency, and open work."
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "minmax(0, 1.6fr) minmax(0, 1.1fr)",
                  gap: "var(--space-4)",
                  alignItems: "flex-start",
                }}
              >
                {/* Lead info */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.5rem",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: "var(--text-xl)",
                          fontWeight: 600,
                        }}
                      >
                        {lead.firstName} {lead.lastName}
                      </div>
                      <div
                        style={{
                          fontSize: "var(--text-xs)",
                          color: "var(--color-text-soft)",
                        }}
                      >
                        Lead ID: {lead.id}
                      </div>
                    </div>
                    <Badge variant={statusVariant(lead.status)}>
                      {lead.status.toLowerCase()}
                    </Badge>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(2, minmax(0, 1fr))",
                      gap: "var(--space-3)",
                      fontSize: "var(--text-sm)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.25rem",
                      }}
                    >
                      <div>
                        <strong>Phone:</strong>{" "}
                        {lead.phone ?? "—"}
                      </div>
                      <div>
                        <strong>Email:</strong>{" "}
                        {lead.email ?? "—"}
                      </div>
                      <div>
                        <strong>State:</strong>{" "}
                        {lead.state ?? "—"}
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.25rem",
                      }}
                    >
                      <div>
                        <strong>Assignee:</strong>{" "}
                        {lead.assignedToUserId ?? "—"}
                      </div>
                      <div>
                        <strong>Created:</strong>{" "}
                        {formatDate(lead.createdAt)}
                      </div>
                      <div>
                        <strong>Updated:</strong>{" "}
                        {formatDate(lead.updatedAt)}
                      </div>
                    </div>
                  </div>

                  {lead.doNotContact && (
                    <div
                      style={{
                        marginTop: "0.35rem",
                        fontSize: "var(--text-xs)",
                        color: "var(--color-danger)",
                      }}
                    >
                      This lead is marked Do Not Contact. The compliance
                      system will block outbound calls.
                    </div>
                  )}

                  {!lead.permissionToContactPhone && !lead.doNotContact && (
                    <div
                      style={{
                        marginTop: "0.35rem",
                        fontSize: "var(--text-xs)",
                        color: "var(--color-warning)",
                      }}
                    >
                      No phone permission on file. Ensure permission is
                      captured and documented before calling.
                    </div>
                  )}
                </div>

                {/* Reasoning + actions */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-3)",
                  }}
                >
                  <div
                    style={{
                      borderRadius: "var(--radius-md)",
                      border:
                        "1px solid var(--color-border-subtle)",
                      padding: "var(--space-3)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.35rem",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "var(--text-xs)",
                        color: "var(--color-text-soft)",
                      }}
                    >
                      Priority score
                    </div>
                    <div
                      style={{
                        fontFamily: "monospace",
                        fontSize: "var(--text-xl)",
                        fontWeight: 600,
                      }}
                    >
                      {lead.score ?? reasoning?.score ?? 0}
                    </div>
                    {reasoning && (
                      <div
                        style={{
                          fontSize: "var(--text-xs)",
                          color: "var(--color-text-soft)",
                        }}
                      >
                        <div>
                          Open tasks:{" "}
                          <strong>
                            {reasoning.openTasksCount}
                          </strong>
                        </div>
                        <div>
                          Last call:{" "}
                          {reasoning.lastCallAt
                            ? `${formatDate(
                                reasoning.lastCallAt
                              )} (${reasoning.lastCallStatus})`
                            : "No calls yet"}
                        </div>
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      gap: "var(--space-2)",
                      justifyContent: "flex-end",
                    }}
                  >
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        void loadNextLead();
                      }}
                    >
                      Skip
                    </Button>
                    <Button asChild size="sm">
                      <Link to={`/leads/${lead.id}`}>
                        Open lead
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
};

export default WorkPage;

