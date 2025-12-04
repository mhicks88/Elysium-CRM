// apps/web/src/routes/leads/ActivityTimelinePanel.tsx

import React, { useEffect, useState } from "react";
import { getAuditEvents } from "../../lib/apiClient";

interface ActivityTimelinePanelProps {
  leadId: string;
}

type AuditEvent = {
  id: string;
  eventType: string;
  createdAt: string;
  // Backend may return different shapes; keep this loose:
  actor?: {
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
  metadata?: any;
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function humanizeEventType(eventType: string): string {
  return eventType
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function getActorLabel(e: any): string {
  const actor = e.actor ?? null;
  if (actor) {
    const fullName = [actor.firstName, actor.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
    if (fullName) return fullName;
    if (actor.email) return actor.email;
  }
  if (e.actorEmail) return e.actorEmail;
  return "System";
}

export const ActivityTimelinePanel: React.FC<
  ActivityTimelinePanelProps
> = ({ leadId }) => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await getAuditEvents(leadId);
        if (!mounted) return;

        const raw = res.events ?? res ?? [];
        // Normalize a bit; we don't know exact shape for every event
        const normalized: AuditEvent[] = raw.map((e: any) => ({
          id: String(e.id ?? e.eventId ?? crypto.randomUUID()),
          eventType: String(e.eventType ?? "UNKNOWN_EVENT"),
          createdAt: String(e.createdAt ?? e.timestamp ?? new Date().toISOString()),
          actor: e.actor ?? null,
          metadata: e.metadata ?? e.eventData ?? {},
        }));

        // Sort newest first just in case backend doesn't
        normalized.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() -
            new Date(a.createdAt).getTime()
        );

        setEvents(normalized);
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message ?? "Failed to load activity timeline");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [leadId]);

  if (loading && events.length === 0 && !error) {
    return (
      <p
        style={{
          fontSize: "var(--text-sm)",
          color: "var(--color-text-soft)",
        }}
      >
        Loading activity…
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

  if (events.length === 0) {
    return (
      <p
        style={{
          fontSize: "var(--text-sm)",
          color: "var(--color-text-soft)",
          fontStyle: "italic",
        }}
      >
        No activity recorded for this lead yet.
      </p>
    );
  }

  return (
    <div
      style={{
        maxHeight: "360px",
        overflowY: "auto",
        paddingRight: "0.25rem",
      }}
    >
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        {events.map((e, idx) => {
          const actorLabel = getActorLabel(e);
          const meta = e.metadata || {};
          const metaSnippet =
            Object.keys(meta).length === 0
              ? ""
              : JSON.stringify(meta).slice(0, 120) +
                (JSON.stringify(meta).length > 120 ? "…" : "");

          return (
            <li
              key={e.id ?? `${e.eventType}-${idx}`}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: "0.5rem",
              }}
            >
              {/* Timeline rail */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
              >
                <div
                  style={{
                    width: "0.5rem",
                    height: "0.5rem",
                    borderRadius: "999px",
                    backgroundColor: "var(--color-primary)",
                  }}
                />
                {idx < events.length - 1 && (
                  <div
                    style={{
                      flex: 1,
                      width: "2px",
                      background:
                        "linear-gradient(to bottom, rgba(148,163,184,0.8), transparent)",
                    }}
                  />
                )}
              </div>

              {/* Event content */}
              <div
                style={{
                  padding: "0.35rem 0.5rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--color-border-subtle)",
                  backgroundColor: "rgba(15,23,42,0.75)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.25rem",
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
                  <span
                    style={{
                      fontSize: "var(--text-sm)",
                      fontWeight: 500,
                    }}
                  >
                    {humanizeEventType(e.eventType)}
                  </span>
                  <span
                    style={{
                      fontSize: "var(--text-2xs)",
                      color: "var(--color-text-soft)",
                    }}
                  >
                    {formatDate(e.createdAt)}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--color-text-soft)",
                  }}
                >
                  {actorLabel}
                </div>
                {metaSnippet && (
                  <div
                    style={{
                      fontSize: "var(--text-2xs)",
                      color: "var(--color-text-soft)",
                      fontFamily: "monospace",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {metaSnippet}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

