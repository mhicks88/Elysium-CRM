// apps/web/src/routes/calls/CallDetail.tsx

import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Input } from "../../components/ui/Input";
import {
  getCallById,
  getCallCoachingNotes,
  addCallCoachingNote,
  setCallDisposition,
  type CallSessionDto,
  type CallCoachingNote,
  type CallDisposition,
} from "../../lib/apiClient";
import { useAuth } from "../../lib/auth";

type Role =
  | "ADMIN"
  | "AGENT"
  | "VIEW_ONLY"
  | "MANAGER"
  | "DIRECTOR"
  | "COMPLIANCE_OFFICER";

function callStatusVariant(status: string): "success" | "warning" | "danger" {
  if (status === "COMPLETED" || status === "CONNECTED") return "success";
  if (status === "FAILED" || status === "ABANDONED") return "danger";
  return "warning";
}

function callComplianceVariant(
  state: string
): "success" | "warning" | "danger" {
  if (state === "PRE_CALL_CHECKS_PASSED") return "success";
  if (state === "PRE_CALL_CHECKS_FAILED") return "danger";
  return "warning";
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

const ALL_DISPOSITIONS: CallDisposition[] = [
  "NO_ANSWER",
  "LEFT_VOICEMAIL",
  "CALLBACK",
  "NOT_INTERESTED",
  "QUALIFIED",
  "TRANSFERRED",
  "INVALID_NUMBER",
  "OTHER",
];

const CallDetailPage: React.FC = () => {
  const params = useParams<{ id: string }>();
  const callId = params.id ?? "";

  const { user } = useAuth() as { user: any | null };
  const userRole = (user?.role ?? null) as Role | null;

  // Backend rules:
  // - Disposition: ADMIN / MANAGER / DIRECTOR / AGENT / COMPLIANCE_OFFICER
  // - Coaching: ADMIN / MANAGER / DIRECTOR / COMPLIANCE_OFFICER
  const canSetDisposition =
    userRole === "ADMIN" ||
    userRole === "MANAGER" ||
    userRole === "DIRECTOR" ||
    userRole === "AGENT" ||
    userRole === "COMPLIANCE_OFFICER";

  const canAddCoaching =
    userRole === "ADMIN" ||
    userRole === "MANAGER" ||
    userRole === "DIRECTOR" ||
    userRole === "COMPLIANCE_OFFICER";

  const [call, setCall] = useState<CallSessionDto | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [notes, setNotes] = useState<CallCoachingNote[]>([]);
  const [notesLoading, setNotesLoading] = useState<boolean>(false);
  const [notesError, setNotesError] = useState<string | null>(null);

  // Disposition form state
  const [disposition, setDisposition] = useState<CallDisposition | "">("");
  const [callbackAt, setCallbackAt] = useState<string>("");
  const [dispositionNotes, setDispositionNotes] =
    useState<string>("");
  const [dispositionSaving, setDispositionSaving] =
    useState(false);
  const [dispositionError, setDispositionError] =
    useState<string | null>(null);
  const [dispositionSuccess, setDispositionSuccess] =
    useState<string | null>(null);

  // Coaching note form
  const [coachingScore, setCoachingScore] = useState<string>("");
  const [coachingBody, setCoachingBody] = useState<string>("");
  const [coachingSaving, setCoachingSaving] = useState(false);
  const [coachingError, setCoachingError] =
    useState<string | null>(null);

  useEffect(() => {
    if (!callId) return;

    let mounted = true;

    async function loadCall() {
      setLoading(true);
      setError(null);
      try {
        const c = await getCallById(callId);
        if (!mounted) return;
        setCall(c);
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message ?? "Failed to load call");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    async function loadNotes() {
      setNotesLoading(true);
      setNotesError(null);
      try {
        const res = await getCallCoachingNotes(callId);
        if (!mounted) return;
        setNotes(res.notes || []);
      } catch (err: any) {
        if (!mounted) return;
        setNotesError(
          err?.message ?? "Failed to load coaching notes for this call"
        );
      } finally {
        if (mounted) setNotesLoading(false);
      }
    }

    void loadCall();
    void loadNotes();

    return () => {
      mounted = false;
    };
  }, [callId]);

  async function handleSaveDisposition(e: React.FormEvent) {
    e.preventDefault();
    if (!callId || !disposition || !canSetDisposition) return;

    setDispositionSaving(true);
    setDispositionError(null);
    setDispositionSuccess(null);

    try {
      const payload = {
        disposition,
        callbackAt: callbackAt || null,
        notes: dispositionNotes || undefined,
      };

      const res = await setCallDisposition(callId, payload);

      let message = `Disposition "${res.disposition}" recorded`;
      if (res.createdTaskId) {
        message += " and follow-up task created";
      }
      if (res.newLeadStatus) {
        message += `; lead status updated to ${res.newLeadStatus}`;
      }
      message += ".";

      setDispositionSuccess(message);

      // Reset only the notes / callback, keep the disposition itself selected
      setCallbackAt("");
      setDispositionNotes("");
    } catch (err: any) {
      setDispositionError(err?.message ?? "Failed to record disposition");
    } finally {
      setDispositionSaving(false);
    }
  }

  async function handleAddCoachingNote(e: React.FormEvent) {
    e.preventDefault();
    if (!callId || !coachingBody.trim() || !canAddCoaching) return;

    setCoachingSaving(true);
    setCoachingError(null);

    try {
      const scoreValue =
        coachingScore.trim() === "" ? undefined : Number(coachingScore);
      const created = await addCallCoachingNote(callId, {
        notes: coachingBody.trim(),
        score: Number.isNaN(scoreValue) ? undefined : scoreValue,
      });

      // Prepend new note
      setNotes((prev) => [created, ...prev]);
      setCoachingScore("");
      setCoachingBody("");
    } catch (err: any) {
      setCoachingError(err?.message ?? "Failed to save coaching note");
    } finally {
      setCoachingSaving(false);
    }
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
        {/* Top heading + back link */}
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
            <div
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-soft)",
              }}
            >
              {call?.leadId ? (
                <Link to={`/leads/${call.leadId}`}>← Back to lead</Link>
              ) : (
                <Link to="/leads">← Back to leads</Link>
              )}
            </div>
            <h1
              style={{
                fontSize: "var(--text-2xl)",
                fontWeight: 600,
              }}
            >
              Call detail
            </h1>
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-soft)",
                maxWidth: "40rem",
              }}
            >
              Single call session view with disposition, basic metadata, and
              coaching notes for QA and training.
            </p>
          </div>

          {call && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.4rem",
                alignItems: "flex-end",
              }}
            >
              <Badge variant={callStatusVariant(call.status)}>
                {call.status.toLowerCase()}
              </Badge>
              <Badge variant={callComplianceVariant(call.complianceState)}>
                {call.complianceState}
              </Badge>
            </div>
          )}
        </div>

        {error && (
          <Card title="Unable to load call">
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-danger)",
              }}
            >
              {error}
            </p>
            <div style={{ marginTop: "var(--space-3)" }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.location.reload()}
              >
                Reload page
              </Button>
            </div>
          </Card>
        )}

        {loading && !call && !error && (
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-soft)",
            }}
          >
            Loading call…
          </p>
        )}

        {call && (
          <>
            {/* Main two-column layout */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)",
                gap: "var(--space-4)",
                alignItems: "flex-start",
              }}
            >
              {/* Left: call metadata */}
              <Card
                title="Call session"
                description="Core details for this call session."
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: "var(--space-4)",
                  }}
                >
                  <Input
                    label="Call ID"
                    value={call.id}
                    readOnly
                    hint="Internal call session identifier."
                  />
                  <Input
                    label="Lead"
                    value={call.leadId}
                    readOnly
                    hint="Lead this call is associated with."
                  />
                  <Input
                    label="Direction"
                    value={call.direction}
                    readOnly
                  />
                  <Input
                    label="Purpose"
                    value={call.purpose}
                    readOnly
                  />
                  <Input
                    label="Agent"
                    value={call.agentId}
                    readOnly
                  />
                  <Input
                    label="External call ID"
                    value={call.externalCallId}
                    readOnly
                  />
                  <Input
                    label="Started"
                    value={formatDate(call.startedAt)}
                    readOnly
                  />
                  <Input
                    label="Connected"
                    value={formatDate(call.connectedAt)}
                    readOnly
                  />
                  <Input
                    label="Ended"
                    value={formatDate(call.endedAt)}
                    readOnly
                  />
                  <Input
                    label="Created"
                    value={formatDate(call.createdAt)}
                    readOnly
                  />
                  <Input
                    label="Updated"
                    value={formatDate(call.updatedAt)}
                    readOnly
                  />
                </div>

                {call.recordingUrl && (
                  <div
                    style={{
                      marginTop: "var(--space-4)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "var(--text-sm)",
                        fontWeight: 500,
                      }}
                    >
                      Recording
                    </span>
                    <a
                      href={call.recordingUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        fontSize: "var(--text-sm)",
                        color: "var(--color-primary)",
                      }}
                    >
                      Open recording in new tab
                    </a>
                  </div>
                )}
              </Card>

              {/* Right: disposition + coaching */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-4)",
                }}
              >
                <Card
                  title="Disposition"
                  description={
                    canSetDisposition
                      ? "Record the outcome of this call and create follow-up when needed."
                      : "View the call disposition details. Your role cannot modify dispositions."
                  }
                >
                  <form
                    onSubmit={handleSaveDisposition}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "var(--space-3)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.25rem",
                      }}
                    >
                      <label
                        style={{
                          fontSize: "var(--text-xs)",
                          color: "var(--color-text-soft)",
                        }}
                      >
                        Disposition
                      </label>
                      <select
                        value={disposition}
                        onChange={(e) =>
                          setDisposition(
                            e.target.value as CallDisposition | ""
                          )
                        }
                        disabled={!canSetDisposition}
                        style={{
                          fontSize: "var(--text-xs)",
                          padding: "0.35rem 0.5rem",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid var(--color-border-subtle)",
                          backgroundColor: canSetDisposition
                            ? "var(--color-bg-subtle)"
                            : "rgba(15,23,42,0.5)",
                          color: "var(--color-text-primary)",
                        }}
                      >
                        <option value="">Select disposition…</option>
                        {ALL_DISPOSITIONS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.25rem",
                      }}
                    >
                      <label
                        style={{
                          fontSize: "var(--text-xs)",
                          color: "var(--color-text-soft)",
                        }}
                      >
                        Callback time (optional)
                      </label>
                      <input
                        type="datetime-local"
                        value={callbackAt}
                        onChange={(e) => setCallbackAt(e.target.value)}
                        disabled={!canSetDisposition}
                        style={{
                          fontSize: "var(--text-xs)",
                          padding: "0.35rem 0.5rem",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid var(--color-border-subtle)",
                          backgroundColor: canSetDisposition
                            ? "var(--color-bg-subtle)"
                            : "rgba(15,23,42,0.5)",
                          color: "var(--color-text-primary)",
                        }}
                      />
                      <span
                        style={{
                          fontSize: "var(--text-2xs)",
                          color: "var(--color-text-soft)",
                        }}
                      >
                        If left blank for callback-type dispositions, the
                        system will default to tomorrow.
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.25rem",
                      }}
                    >
                      <label
                        style={{
                          fontSize: "var(--text-xs)",
                          color: "var(--color-text-soft)",
                        }}
                      >
                        Notes (optional)
                      </label>
                      <textarea
                        value={dispositionNotes}
                        onChange={(e) =>
                          setDispositionNotes(e.target.value)
                        }
                        rows={3}
                        disabled={!canSetDisposition}
                        style={{
                          resize: "vertical",
                          fontSize: "var(--text-xs)",
                          padding: "0.45rem 0.6rem",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid var(--color-border-subtle)",
                          backgroundColor: canSetDisposition
                            ? "var(--color-bg-subtle)"
                            : "rgba(15,23,42,0.5)",
                          color: "var(--color-text-primary)",
                        }}
                      />
                    </div>

                    {dispositionError && (
                      <div
                        style={{
                          fontSize: "var(--text-sm)",
                          color: "var(--color-danger)",
                        }}
                      >
                        {dispositionError}
                      </div>
                    )}

                    {dispositionSuccess && (
                      <div
                        style={{
                          fontSize: "var(--text-sm)",
                          color: "var(--color-success)",
                        }}
                      >
                        {dispositionSuccess}
                      </div>
                    )}

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                      }}
                    >
                      <Button
                        type="submit"
                        size="sm"
                        isLoading={dispositionSaving}
                        disabled={
                          dispositionSaving ||
                          !disposition ||
                          !canSetDisposition
                        }
                      >
                        Save disposition
                      </Button>
                    </div>
                  </form>
                </Card>

                <Card
                  title="Coaching notes"
                  description={
                    canAddCoaching
                      ? "Quality and training notes attached to this call."
                      : "Review coaching notes attached to this call. Your role cannot add coaching notes."
                  }
                >
                  <form
                    onSubmit={handleAddCoachingNote}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "var(--space-3)",
                      marginBottom: "var(--space-3)",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "minmax(0, 0.5fr) minmax(0, 1.5fr)",
                        gap: "var(--space-3)",
                        alignItems: "flex-start",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.25rem",
                        }}
                      >
                        <label
                          style={{
                            fontSize: "var(--text-xs)",
                            color: "var(--color-text-soft)",
                          }}
                        >
                          Score (0–100, optional)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={coachingScore}
                          onChange={(e) =>
                            setCoachingScore(e.target.value)
                          }
                          disabled={!canAddCoaching}
                          style={{
                            fontSize: "var(--text-xs)",
                            padding: "0.35rem 0.5rem",
                            borderRadius: "var(--radius-sm)",
                            border:
                              "1px solid var(--color-border-subtle)",
                            backgroundColor: canAddCoaching
                              ? "var(--color-bg-subtle)"
                              : "rgba(15,23,42,0.5)",
                            color: "var(--color-text-primary)",
                          }}
                        />
                      </div>

                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.25rem",
                        }}
                      >
                        <label
                          style={{
                            fontSize: "var(--text-xs)",
                            color: "var(--color-text-soft)",
                          }}
                        >
                          Note
                        </label>
                        <textarea
                          value={coachingBody}
                          onChange={(e) =>
                            setCoachingBody(e.target.value)
                          }
                          rows={3}
                          disabled={!canAddCoaching}
                          style={{
                            resize: "vertical",
                            fontSize: "var(--text-xs)",
                            padding: "0.45rem 0.6rem",
                            borderRadius: "var(--radius-sm)",
                            border:
                              "1px solid var(--color-border-subtle)",
                            backgroundColor: canAddCoaching
                              ? "var(--color-bg-subtle)"
                              : "rgba(15,23,42,0.5)",
                            color: "var(--color-text-primary)",
                          }}
                        />
                      </div>
                    </div>

                    {coachingError && (
                      <div
                        style={{
                          fontSize: "var(--text-sm)",
                          color: "var(--color-danger)",
                        }}
                      >
                        {coachingError}
                      </div>
                    )}

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                      }}
                    >
                      <Button
                        type="submit"
                        size="sm"
                        isLoading={coachingSaving}
                        disabled={
                          coachingSaving ||
                          !coachingBody.trim() ||
                          !canAddCoaching
                        }
                      >
                        Add coaching note
                      </Button>
                    </div>
                  </form>

                  {notesError && (
                    <div
                      style={{
                        fontSize: "var(--text-sm)",
                        color: "var(--color-danger)",
                        marginBottom: "var(--space-2)",
                      }}
                    >
                      {notesError}
                    </div>
                  )}

                  {notesLoading && (
                    <p
                      style={{
                        fontSize: "var(--text-xs)",
                        color: "var(--color-text-soft)",
                      }}
                    >
                      Loading coaching notes…
                    </p>
                  )}

                  {!notesLoading && notes.length === 0 && !notesError && (
                    <p
                      style={{
                        fontSize: "var(--text-sm)",
                        color: "var(--color-text-soft)",
                        fontStyle: "italic",
                      }}
                    >
                      No coaching notes recorded for this call yet.
                    </p>
                  )}

                  {notes.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "var(--space-2)",
                      }}
                    >
                      {notes.map((n) => (
                        <div
                          key={n.id}
                          style={{
                            padding: "0.5rem 0.6rem",
                            borderRadius: "var(--radius-md)",
                            border:
                              "1px solid var(--color-border-subtle)",
                            backgroundColor: "rgba(15,23,42,0.6)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.25rem",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: "0.5rem",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "var(--text-xs)",
                                color: "var(--color-text-soft)",
                              }}
                            >
                              {n.coachName || n.coachEmail || "Unknown"}
                              {" • "}
                              {formatDate(n.createdAt)}
                            </div>
                            {n.score !== null && (
                              <Badge variant="secondary">
                                Score {n.score}
                              </Badge>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: "var(--text-sm)",
                              color: "var(--color-text-primary)",
                            }}
                          >
                            {n.notes}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
};

export default CallDetailPage;

