// apps/web/src/routes/leads/CallScriptHistoryPanel.tsx

import React, { useEffect, useState } from "react";
import { Badge } from "../../components/ui/Badge";
import {
  getCallScriptRunsForLead,
  type CallScriptRunSummary,
} from "../../lib/apiClient";

interface CallScriptHistoryPanelProps {
  leadId: string;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function statusVariant(status: string): "success" | "warning" | "danger" {
  if (status === "COMPLETED") return "success";
  if (status === "ABANDONED") return "danger";
  return "warning";
}

export const CallScriptHistoryPanel: React.FC<
  CallScriptHistoryPanelProps
> = ({ leadId }) => {
  const [runs, setRuns] = useState<CallScriptRunSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await getCallScriptRunsForLead(leadId);
        if (!mounted) return;
        setRuns(res.runs || []);
      } catch (err: any) {
        if (!mounted) return;
        setError(
          err?.message ?? "Failed to load scripted call history"
        );
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [leadId]);

  if (loading && runs.length === 0 && !error) {
    return (
      <p
        style={{
          fontSize: "var(--text-sm)",
          color: "var(--color-text-soft)",
        }}
      >
        Loading scripted calls…
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

  if (runs.length === 0) {
    return (
      <p
        style={{
          fontSize: "var(--text-sm)",
          color: "var(--color-text-soft)",
          fontStyle: "italic",
        }}
      >
        No scripted calls recorded for this lead yet.
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
            <th style={{ padding: "0.4rem" }}>Script</th>
            <th style={{ padding: "0.4rem" }}>Purpose</th>
            <th style={{ padding: "0.4rem" }}>Status</th>
            <th style={{ padding: "0.4rem" }}>Outcome</th>
            <th style={{ padding: "0.4rem" }}>Started</th>
            <th style={{ padding: "0.4rem" }}>Ended</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr
              key={run.id}
              style={{
                borderBottom: "1px solid rgba(15,23,42,0.6)",
              }}
            >
              <td style={{ padding: "0.4rem" }}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.1rem",
                  }}
                >
                  <span>{run.scriptName}</span>
                  <span
                    style={{
                      fontSize: "var(--text-2xs)",
                      color: "var(--color-text-soft)",
                    }}
                  >
                    {run.id}
                  </span>
                </div>
              </td>
              <td style={{ padding: "0.4rem" }}>{run.purpose}</td>
              <td style={{ padding: "0.4rem" }}>
                <Badge variant={statusVariant(run.status)}>
                  {run.status.toLowerCase()}
                </Badge>
              </td>
              <td style={{ padding: "0.4rem" }}>
                {run.outcome ?? "—"}
              </td>
              <td style={{ padding: "0.4rem" }}>
                {formatDate(run.startedAt)}
              </td>
              <td style={{ padding: "0.4rem" }}>
                {formatDate(run.endedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {loading && (
        <p
          style={{
            marginTop: "var(--space-2)",
            fontSize: "var(--text-xs)",
            color: "var(--color-text-soft)",
          }}
        >
          Updating scripted calls…
        </p>
      )}
    </div>
  );
};

