// apps/web/src/routes/leads/ComplianceHistoryPanel.tsx

import React, { useEffect, useState } from "react";
import { getComplianceHistory } from "../../lib/apiClient";

type ComplianceHistoryItem = {
  id: string;
  leadId: string;
  userId: string;
  purpose: string;
  status: "PASS" | "FAIL";
  result: any;
  createdAt: string;
};

interface ComplianceHistoryPanelProps {
  leadId: string;
}

export const ComplianceHistoryPanel: React.FC<ComplianceHistoryPanelProps> = ({
  leadId,
}) => {
  const [items, setItems] = useState<ComplianceHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await getComplianceHistory(leadId);
        if (!mounted) return;
        const history = (res.history ?? []) as ComplianceHistoryItem[];
        setItems(history);
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message || "Failed to load compliance history");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (leadId) {
      void load();
    }

    return () => {
      mounted = false;
    };
  }, [leadId]);

  if (loading && items.length === 0 && !error) {
    return (
      <p
        style={{
          fontSize: "var(--text-sm)",
          color: "var(--color-text-soft)",
        }}
      >
        Loading history…
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

  if (!loading && !error && items.length === 0) {
    return (
      <p
        style={{
          fontSize: "var(--text-sm)",
          color: "var(--color-text-soft)",
          fontStyle: "italic",
        }}
      >
        No past compliance checks recorded for this lead.
      </p>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        maxHeight: "320px",
        overflowY: "auto",
        paddingRight: "0.25rem",
      }}
    >
      {items.map((item) => {
        const createdLabel = new Date(item.createdAt).toLocaleString();
        const isPass = item.status === "PASS";
        const statusColor = isPass ? "var(--color-success)" : "var(--color-danger)";
        const statusBg = isPass
          ? "rgba(22, 163, 74, 0.1)"
          : "rgba(220, 38, 38, 0.1)";

        // Keep result JSON but truncate visually for readability
        const resultString = JSON.stringify(item.result ?? {}, null, 2);
        const isLong = resultString.length > 600;
        const displayResult = isLong
          ? resultString.slice(0, 600) + "\n…"
          : resultString;

        return (
          <div
            key={item.id}
            style={{
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border-subtle)",
              backgroundColor: "rgba(15,23,42,0.85)",
              padding: "0.6rem 0.75rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.35rem",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: "0.5rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.15rem",
                }}
              >
                <span
                  style={{
                    fontSize: "var(--text-sm)",
                    fontWeight: 500,
                  }}
                >
                  {item.purpose}
                </span>
                <span
                  style={{
                    fontSize: "var(--text-2xs)",
                    color: "var(--color-text-soft)",
                  }}
                >
                  {createdLabel}
                </span>
              </div>

              <span
                style={{
                  fontSize: "var(--text-xs)",
                  fontWeight: 600,
                  padding: "0.1rem 0.45rem",
                  borderRadius: "999px",
                  color: statusColor,
                  backgroundColor: statusBg,
                }}
              >
                {item.status}
              </span>
            </div>

            <div
              style={{
                fontSize: "var(--text-2xs)",
                color: "var(--color-text-soft)",
                borderRadius: "var(--radius-sm)",
                border: "1px solid rgba(148,163,184,0.4)",
                backgroundColor: "rgba(15,23,42,0.9)",
                padding: "0.45rem 0.5rem",
                maxHeight: "140px",
                overflow: "auto",
              }}
            >
              <pre
                style={{
                  margin: 0,
                  fontFamily: "monospace",
                  fontSize: "0.7rem",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {displayResult}
              </pre>
            </div>
          </div>
        );
      })}
    </div>
  );
};

