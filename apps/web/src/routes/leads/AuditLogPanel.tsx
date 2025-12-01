import React, { useEffect, useState } from "react";
import { getAuditEvents } from "../../lib/apiClient";

type AuditEvent = {
  id: string;
  userId: string | null;
  leadId: string | null;
  eventType: string;
  eventData: Record<string, unknown>;
  createdAt: string | Date;
};

interface AuditLogPanelProps {
  leadId: string;
}

export const AuditLogPanel: React.FC<AuditLogPanelProps> = ({ leadId }) => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await getAuditEvents(leadId);
        if (!isMounted) return;

        const normalized = (res.events ?? []).map((e: any) => ({
          ...e,
          createdAt: new Date(e.createdAt),
        }));
        setEvents(normalized);
      } catch (err: any) {
        if (!isMounted) return;
        setError(err?.message || "Failed to load audit log");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (leadId) {
      load();
    }

    return () => {
      isMounted = false;
    };
  }, [leadId]);

  return (
    <div style={{ marginTop: "2rem" }}>
      <h2 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>Audit Log</h2>

      {loading && <p>Loading audit events...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && !error && events.length === 0 && (
        <p style={{ fontStyle: "italic" }}>No audit events yet for this lead.</p>
      )}

      <ul style={{ listStyle: "none", padding: 0, marginTop: "0.5rem" }}>
        {events.map((event) => (
          <li
            key={event.id}
            style={{
              padding: "0.75rem",
              marginBottom: "0.5rem",
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              background: "#fff",
            }}
          >
            <div
              style={{
                fontSize: "0.85rem",
                color: "#6b7280",
                marginBottom: "0.25rem",
              }}
            >
              {event.createdAt instanceof Date
                ? event.createdAt.toLocaleString()
                : String(event.createdAt)}
            </div>
            <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>
              {event.eventType}
            </div>
            {Object.keys(event.eventData || {}).length > 0 && (
              <pre
                style={{
                  margin: 0,
                  fontSize: "0.8rem",
                  background: "#f9fafb",
                  padding: "0.5rem",
                  borderRadius: "6px",
                  overflowX: "auto",
                }}
              >
                {JSON.stringify(event.eventData, null, 2)}
              </pre>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

