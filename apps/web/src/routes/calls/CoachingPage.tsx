// apps/web/src/routes/calls/CoachingPage.tsx

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { useAuth } from "../../lib/auth";
import {
  getCoachingQueue,
  type CoachingQueueItem,
} from "../../lib/apiClient";

type Role =
  | "ADMIN"
  | "AGENT"
  | "VIEW_ONLY"
  | "MANAGER"
  | "DIRECTOR"
  | "COMPLIANCE"
  | "READ_ONLY";

const CoachingPage: React.FC = () => {
  const { user } = useAuth() as { user: any | null };
  const userRole = (user?.role ?? "AGENT") as Role;

  const [queue, setQueue] = useState<CoachingQueueItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await getCoachingQueue(50);
        if (!mounted) return;
        setQueue(res.items ?? []);
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message ?? "Failed to load coaching queue");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const isManagerLike =
    userRole === "ADMIN" ||
    userRole === "MANAGER" ||
    userRole === "DIRECTOR" ||
    userRole === "COMPLIANCE";

  function renderCoachingQueue() {
    if (loading && queue.length === 0 && !error) {
      return (
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--color-text-soft)",
          }}
        >
          Loading coaching queue…
        </p>
      );
    }

    if (error) {
      return (
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--color-danger)",
          }}
        >
          {error}
        </p>
      );
    }

    if (queue.length === 0) {
      return (
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--color-text-soft)",
            fontStyle: "italic",
          }}
        >
          No calls in the coaching queue yet. Once calls are coached, they will
          show up here for quick review.
        </p>
      );
    }

    return (
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
                borderBottom: "1px solid var(--color-border-subtle)",
              }}
            >
              <th style={{ padding: "0.4rem" }}>Call</th>
              <th style={{ padding: "0.4rem" }}>Lead</th>
              <th style={{ padding: "0.4rem" }}>Agent</th>
              <th style={{ padding: "0.4rem" }}>Direction</th>
              <th style={{ padding: "0.4rem" }}>Purpose</th>
              <th style={{ padding: "0.4rem" }}>Status</th>
              <th style={{ padding: "0.4rem" }}>Last coached</th>
              <th style={{ padding: "0.4rem" }}>Score</th>
              <th style={{ padding: "0.4rem" }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((item) => (
              <tr
                key={item.callId}
                style={{
                  borderBottom: "1px solid rgba(15,23,42,0.6)",
                }}
              >
                <td style={{ padding: "0.4rem" }}>
                  <Link
                    to={`/calls/${item.callId}`}
                    style={{
                      color: "var(--color-primary)",
                      textDecoration: "none",
                    }}
                  >
                    {item.callId.slice(0, 8)}…
                  </Link>
                </td>
                <td style={{ padding: "0.4rem" }}>
                  <Link
                    to={`/leads/${item.leadId}`}
                    style={{
                      color: "var(--color-primary)",
                      textDecoration: "none",
                    }}
                  >
                    {item.leadId.slice(0, 8)}…
                  </Link>
                </td>
                <td style={{ padding: "0.4rem" }}>
                  {item.agentId.slice(0, 10)}…
                </td>
                <td style={{ padding: "0.4rem" }}>{item.direction}</td>
                <td style={{ padding: "0.4rem" }}>{item.purpose}</td>
                <td style={{ padding: "0.4rem" }}>{item.status}</td>
                <td style={{ padding: "0.4rem" }}>
                  {new Date(item.lastCoachedAt).toLocaleString()}
                </td>
                <td style={{ padding: "0.4rem" }}>
                  {item.lastScore != null ? item.lastScore.toFixed(1) : "—"}
                </td>
                <td style={{ padding: "0.4rem" }}>{item.noteCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderTrainingSection() {
    const sections: {
      title: string;
      items: { label: string; description: string }[];
    }[] = [
      {
        title: "Compliance foundations",
        items: [
          {
            label: "Pre-call compliance checklist",
            description:
              "When to run checks, what to verify, and how to document exceptions.",
          },
          {
            label: "Handling Do Not Contact & revocation",
            description:
              "How to treat DNC and revocation events inside Elysium so the audit trail stays clean.",
          },
        ],
      },
      {
        title: "Call quality & coaching",
        items: [
          {
            label: "Using interactive scripts",
            description:
              "Best practices for staying on-script while still sounding human.",
          },
          {
            label: "Scoring calls consistently",
            description:
              "Guidelines for 0–100 coaching scores so managers grade the same way.",
          },
        ],
      },
      {
        title: "Productivity & CRM workflows",
        items: [
          {
            label: "Working your lead queue",
            description:
              "How to combine Leads, Tasks, and the Coaching queue to stay on top of your book.",
          },
          {
            label: "Documenting enrollments",
            description:
              "Where to log key enrollment decisions and how that feeds reporting.",
          },
        ],
      },
    ];

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        {sections.map((section) => (
          <div
            key={section.title}
            style={{
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border-subtle)",
              padding: "0.6rem 0.75rem",
              backgroundColor: "rgba(15,23,42,0.85)",
            }}
          >
            <div
              style={{
                fontSize: "var(--text-sm)",
                fontWeight: 500,
                marginBottom: "0.25rem",
              }}
            >
              {section.title}
            </div>
            <ul
              style={{
                listStyle: "disc",
                paddingLeft: "1.2rem",
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}
            >
              {section.items.map((item) => (
                <li key={item.label}>
                  <div
                    style={{
                      fontSize: "var(--text-xs)",
                      fontWeight: 500,
                    }}
                  >
                    {item.label}
                  </div>
                  <div
                    style={{
                      fontSize: "var(--text-2xs)",
                      color: "var(--color-text-soft)",
                    }}
                  >
                    {item.description}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
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
              Coaching
            </h1>
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-soft)",
                maxWidth: "40rem",
              }}
            >
              A focused workspace for reviewing calls, giving feedback, and
              sharing training with agents. Managers and compliance officer roles
              see their downline; agents see only their own coached calls.
            </p>
          </div>

          <Badge variant="secondary">
            {isManagerLike ? "Team coaching view" : "My coaching"}
          </Badge>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr)",
            gap: "var(--space-4)",
            alignItems: "flex-start",
          }}
        >
          <Card
            title="Coaching queue"
            description={
              isManagerLike
                ? "Recent calls with coaching notes for your team."
                : "Calls where you’ve received coaching."
            }
          >
            {renderCoachingQueue()}
          </Card>

          <Card
            title="Training"
            description="Reference material to support coaching and quality reviews."
          >
            {renderTrainingSection()}
          </Card>
        </div>
      </div>
    </AppShell>
  );
};

export default CoachingPage;
