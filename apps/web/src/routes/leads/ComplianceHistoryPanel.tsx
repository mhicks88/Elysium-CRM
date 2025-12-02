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

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        padding: "1rem",
        borderRadius: 6,
      }}
    >
      <h2>Past compliance checks</h2>

      {loading && <p>Loading history...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && !error && items.length === 0 && (
        <p style={{ fontStyle: "italic" }}>No past compliance checks.</p>
      )}

      <ul style={{ listStyle: "none", padding: 0, marginTop: "0.75rem" }}>
        {items.map((item) => (
          <li
            key={item.id}
            style={{
              padding: "0.75rem",
              borderRadius: 6,
              border: "1px solid #e5e7eb",
              marginBottom: "0.75rem",
              background: "#fff",
            }}
          >
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              {new Date(item.createdAt).toLocaleString()}
            </div>
            <div style={{ marginTop: "0.25rem" }}>
              <strong>{item.purpose}</strong> →{" "}
              <span
                style={{
                  fontWeight: 600,
                  color: item.status === "PASS" ? "#166534" : "#b91c1c",
                }}
              >
                {item.status}
              </span>
            </div>
            <pre
              style={{
                marginTop: "0.5rem",
                fontSize: 12,
                background: "#f9fafb",
                padding: "0.5rem",
                borderRadius: 4,
                overflowX: "auto",
              }}
            >
              {JSON.stringify(item.result, null, 2)}
            </pre>
          </li>
        ))}
      </ul>
    </div>
  );
};

