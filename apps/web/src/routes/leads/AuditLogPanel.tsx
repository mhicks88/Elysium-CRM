import React, { useEffect, useState } from "react";
import { getAuditEvents } from "../../lib/apiClient";

type AuditEvent = {
  id: string;
  organizationId: string;
  entityType: string;
  entityId: string;
  eventType: string;
  actorUserId: string | null;
  metadata: Record<string, unknown> | null;
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

        const normalized: AuditEvent[] = (res.events ?? []).map((e: any) => ({
          id: e.id,
          organizationId: e.organizationId,
          entityType: e.entityType,
          entityId: e.entityId,
          eventType: e.eventType,
          actorUserId: e.actorUserId ?? null,
          metadata: (e.metadata ?? null) as Record<string, unknown> | null,
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
      void load();
    }

    return () => {
      isMounted = false;
    };
  }, [leadId]);

  function formatEventTitle(event: AuditEvent): string {
    // You can refine this over time; for now, basic mapping + fallback.
    switch (event.eventType) {
      case "COMPLIANCE_CHECK":
        return "Compliance check";
      case "COMPLIANCE_CHECK_BEFORE_SCRIPT":
        return "Pre-call compliance before scripted call";
      case "CALL_SCRIPT_RUN_STARTED":
        return "Scripted call started";
      case "CALL_SCRIPT_STEP":
        return "Scripted call step";
      case "CALL_SCRIPT_RUN_ENDED":
        return "Scripted call ended";
      default:
        return event.eventType;
    }
  }

  function formatEventSummary(event: AuditEvent): string | null {
    const md = event.metadata || {};
    switch (event.eventType) {
      case "COMPLIANCE_CHECK":
      case "COMPLIANCE_CHECK_BEFORE_SCRIPT": {
        const status = (md as any)?.result?.status;
        const purpose = (md as any)?.purpose;
        if (!status && !purpose) return null;
        return `Status: ${status ?? "unknown"}${purpose ? ` • Purpose: ${purpose}` : ""}`;
      }
      case "CALL_SCRIPT_RUN_STARTED": {
        const scriptId = (md as any)?.scriptId;
        const purpose = (md as any)?.purpose;
        return `Script: ${scriptId ?? "unknown"}${purpose ? ` • Purpose: ${purpose}` : ""}`;
      }
      case "CALL_SCRIPT_STEP": {
        const optionId = (md as any)?.optionId;
        const nextNodeId = (md as any)?.nextNodeId;
        const newStatus = (md as any)?.newStatus;
        return `Option: ${optionId ?? "unknown"}${nextNodeId ? ` • Next node: ${nextNodeId}` : ""}${
          newStatus ? ` • Status: ${newStatus}` : ""
        }`;
      }
      case "CALL_SCRIPT_RUN_ENDED": {
        const status = (md as any)?.status;
        const outcome = (md as any)?.outcome;
        return `Status: ${status ?? "unknown"}${outcome ? ` • Outcome: ${outcome}` : ""}`;
      }
      default:
        return null;
    }
  }

  return (
    <div>
      {loading && <p>Loading audit events...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && !error && events.length === 0 && (
        <p style={{ fontStyle: "italic" }}>No audit events yet for this lead.</p>
      )}

      <ul style={{ listStyle: "none", padding: 0, marginTop: "0.5rem" }}>
        {events.map((event) => {
          const created =
            event.createdAt instanceof Date
              ? event.createdAt.toLocaleString()
              : String(event.createdAt);
          const title = formatEventTitle(event);
          const summary = formatEventSummary(event);

          return (
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
                {created}
              </div>
              <div style={{ fontWeight: 600, marginBottom: "0.1rem" }}>
                {title}
              </div>
              {summary && (
                <div
                  style={{
                    fontSize: "0.8rem",
                    color: "#4b5563",
                    marginBottom: "0.25rem",
                  }}
                >
                  {summary}
                </div>
              )}
              {event.metadata && Object.keys(event.metadata).length > 0 && (
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
                  {JSON.stringify(event.metadata, null, 2)}
                </pre>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

