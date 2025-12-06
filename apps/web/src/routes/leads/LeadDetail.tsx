// apps/web/src/routes/leads/LeadDetail.tsx

import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Input } from "../../components/ui/Input";
import { ComplianceHistoryPanel } from "./ComplianceHistoryPanel";
import { EnrollmentPanel } from "../../components/enrollment/EnrollmentPanel";
import { TasksPanel } from "../../components/tasks/TasksPanel";
import { CallScriptPanel } from "./CallScriptPanel";
import { NotesPanel } from "./NotesPanel";
import { PreCallCompliancePanel } from "./PreCallCompliancePanel";
import { CallScriptHistoryPanel } from "./CallScriptHistoryPanel";
import { ActivityTimelinePanel } from "./ActivityTimelinePanel";
import {
  getLeadById,
  updateLead,
  getCalls,
  createCall,
  getNextLead,
  type CallSessionDto,
} from "../../lib/apiClient";
import { useAuth } from "../../lib/auth";

// Match backend LeadStatus enum
type LeadStatus =
  | "NEW"
  | "CONTACT_ATTEMPTED"
  | "CONTACTED"
  | "SOA_REQUIRED"
  | "SOA_COMPLETED"
  | "IN_DISCUSSION"
  | "ENROLLED"
  | "NOT_INTERESTED"
  | "DO_NOT_CONTACT";

type Role =
  | "ADMIN"
  | "AGENT"
  | "VIEW_ONLY"
  | "MANAGER"
  | "DIRECTOR"
  | "COMPLIANCE_OFFICER";

interface LeadDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  state: string | null;
  status: LeadStatus;
  createdAt: string;
  updatedAt: string;
  permissionToContactPhone: boolean;
  doNotContact: boolean;
  assignedToUserId?: string | null;
  assignedToName?: string | null;
}

const statusLabel: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACT_ATTEMPTED: "Contact attempted",
  CONTACTED: "Contacted",
  SOA_REQUIRED: "SOA required",
  SOA_COMPLETED: "SOA completed",
  IN_DISCUSSION: "In discussion",
  ENROLLED: "Enrolled",
  NOT_INTERESTED: "Not interested",
  DO_NOT_CONTACT: "Do Not Contact",
};

function statusBadgeVariant(status: LeadStatus) {
  switch (status) {
    case "ENROLLED":
      return "success" as const;
    case "DO_NOT_CONTACT":
    case "NOT_INTERESTED":
      return "danger" as const;
    case "CONTACT_ATTEMPTED":
    case "CONTACTED":
    case "SOA_REQUIRED":
    case "SOA_COMPLETED":
    case "IN_DISCUSSION":
      return "warning" as const;
    case "NEW":
    default:
      return "neutral" as const;
  }
}

/**
 * Fetch a single lead by ID using the dedicated API.
 */
async function fetchLeadById(leadId: string): Promise<LeadDetail> {
  const data = await getLeadById(leadId);
  return data as LeadDetail;
}

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

const LeadDetailPage: React.FC = () => {
  const params = useParams<{ id: string }>();
  const leadId = params.id ?? "";
  const navigate = useNavigate();

  const { user } = useAuth() as { user: any | null };
  const userRole = (user?.role ?? null) as Role | null;

  const readOnlyRole =
    userRole === "VIEW_ONLY" || userRole === "COMPLIANCE_OFFICER";
  const canEditAssigneeRole =
    userRole === "ADMIN" ||
    userRole === "MANAGER" ||
    userRole === "DIRECTOR";
  const canEditLead = !readOnlyRole;

  const canEditAssignee = canEditAssigneeRole;

  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editState, setEditState] = useState("");
  const [editAssignee, setEditAssignee] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Calls for this lead
  const [calls, setCalls] = useState<CallSessionDto[]>([]);
  const [callsLoading, setCallsLoading] =
    useState<boolean>(false);
  const [callsError, setCallsError] = useState<string | null>(null);

  // Log call form state
  const [newCallDirection, setNewCallDirection] = useState<
    "INBOUND" | "OUTBOUND"
  >("OUTBOUND");
  const [newCallPurpose, setNewCallPurpose] = useState<
    "EDUCATION" | "MARKETING" | "ENROLLMENT" | "SERVICE"
  >("ENROLLMENT");
  const [newCallStatus, setNewCallStatus] = useState<
    "COMPLETED" | "FAILED" | "ABANDONED"
  >("COMPLETED");
  const [logCallLoading, setLogCallLoading] =
    useState<boolean>(false);
  const [logCallError, setLogCallError] =
    useState<string | null>(null);

  // Next lead flow
  const [nextLoading, setNextLoading] =
    useState<boolean>(false);
  const [nextError, setNextError] = useState<string | null>(null);

  useEffect(() => {
    if (!leadId) return;

    let mounted = true;

    async function loadLead() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchLeadById(leadId);
        if (!mounted) return;
        setLead(data);
        // Initialize edit fields
        setEditFirstName(data.firstName);
        setEditLastName(data.lastName);
        setEditEmail(data.email ?? "");
        setEditPhone(data.phone ?? "");
        setEditState(data.state ?? "");
        setEditAssignee(data.assignedToUserId ?? "");
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message ?? "Failed to load lead");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    async function loadCalls() {
      setCallsLoading(true);
      setCallsError(null);
      try {
        const res = await getCalls({ leadId, limit: 10 });
        if (!mounted) return;
        setCalls(res.calls || []);
      } catch (err: any) {
        if (!mounted) return;
        setCallsError(
          err?.message ?? "Failed to load calls for this lead"
        );
      } finally {
        if (mounted) setCallsLoading(false);
      }
    }

    void loadLead();
    void loadCalls();

    return () => {
      mounted = false;
    };
  }, [leadId]);

  const hasEdits =
    canEditLead &&
    lead &&
    (editFirstName !== lead.firstName ||
      editLastName !== lead.lastName ||
      (editEmail || "") !== (lead.email || "") ||
      (editPhone || "") !== (lead.phone || "") ||
      (editState || "") !== (lead.state || "") ||
      (canEditAssignee &&
        (editAssignee || "") !== (lead.assignedToUserId || "")));

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!lead || !hasEdits || !canEditLead) return;

    setSaving(true);
    setSaveError(null);

    try {
      const payload: Record<string, unknown> = {
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        email: editEmail.trim() || null,
        phone: editPhone.trim() || null,
        state: editState.trim() || null,
      };

      if (canEditAssignee) {
        payload.assignedToUserId = editAssignee.trim() || null;
      }

      await updateLead(lead.id, payload);

      // Update local state to reflect the changes
      const updated: LeadDetail = {
        ...lead,
        firstName: payload.firstName as string,
        lastName: payload.lastName as string,
        email: payload.email as string | null,
        phone: payload.phone as string | null,
        state: payload.state as string | null,
        assignedToUserId: canEditAssignee
          ? ((payload.assignedToUserId ?? null) as string | null)
          : lead.assignedToUserId ?? null,
        updatedAt: new Date().toISOString(),
      };
      setLead(updated);
      setIsEditing(false);
    } catch (err: any) {
      setSaveError(err?.message ?? "Failed to save lead changes");
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    if (!lead) return;
    setEditFirstName(lead.firstName);
    setEditLastName(lead.lastName);
    setEditEmail(lead.email ?? "");
    setEditPhone(lead.phone ?? "");
    setEditState(lead.state ?? "");
    setEditAssignee(lead.assignedToUserId ?? "");
    setSaveError(null);
    setIsEditing(false);
  }

  async function handleLogCall(e: React.FormEvent) {
    e.preventDefault();
    if (!lead) return;

    setLogCallLoading(true);
    setLogCallError(null);

    try {
      const created = await createCall({
        leadId: lead.id,
        direction: newCallDirection,
        purpose: newCallPurpose,
        status: newCallStatus,
      });

      // Prepend newly created call into list (keep at most 10)
      setCalls((prev) => [created, ...prev].slice(0, 10));
    } catch (err: any) {
      setLogCallError(err?.message ?? "Failed to log call");
    } finally {
      setLogCallLoading(false);
    }
  }

  async function handleNextLead() {
    setNextLoading(true);
    setNextError(null);
    try {
      const next = await getNextLead();
      if (next && next.id) {
        navigate(`/leads/${next.id}`);
      } else {
        setNextError("No next lead available in your queue.");
      }
    } catch (err: any) {
      setNextError(err?.message ?? "Failed to fetch next lead");
    } finally {
      setNextLoading(false);
    }
  }

  function renderContactComplianceBanner(l: LeadDetail) {
    if (l.doNotContact) {
      return (
        <div
          style={{
            borderRadius: "var(--radius-md)",
            border: "1px solid rgba(248,113,113,0.5)",
            backgroundColor: "rgba(127,29,29,0.3)",
            padding: "var(--space-3)",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          <span
            style={{
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              color: "var(--color-danger)",
            }}
          >
            Do Not Contact (DNC)
          </span>
          <span
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--color-text-soft)",
            }}
          >
            This lead is marked as DO NOT CONTACT. Outbound calls and
            marketing outreach should not be initiated without formal
            remediation and legal approval.
          </span>
        </div>
      );
    }

    if (!l.permissionToContactPhone) {
      return (
        <div
          style={{
            borderRadius: "var(--radius-md)",
            border: "1px solid rgba(251,191,36,0.6)",
            backgroundColor: "rgba(120,53,15,0.35)",
            padding: "var(--space-3)",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          <span
            style={{
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              color: "var(--color-warning)",
            }}
          >
            No phone permission on file
          </span>
          <span
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--color-text-soft)",
            }}
          >
            This lead has not granted permission to be contacted by phone.
            Ensure that permission is captured and documented before placing
            outbound calls.
          </span>
        </div>
      );
    }

    return (
      <div
        style={{
          borderRadius: "var(--radius-md)",
          border: "1px solid rgba(34,197,94,0.5)",
          backgroundColor: "rgba(6,95,70,0.35)",
          padding: "var(--space-3)",
          display: "flex",
          flexDirection: "column",
          gap: "0.25rem",
        }}
      >
        <span
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: 600,
            color: "var(--color-success)",
          }}
        >
          Contact permitted
        </span>
        <span
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--color-text-soft)",
          }}
        >
          This lead has granted permission to be contacted by phone and is not
          marked as Do Not Contact.
        </span>
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
              <Link to="/leads">← Back to leads</Link>
            </div>
            <h1
              style={{
                fontSize: "var(--text-2xl)",
                fontWeight: 600,
              }}
            >
              Lead detail
            </h1>
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-soft)",
                maxWidth: "40rem",
              }}
            >
              Single-lead view that ties together information, assignment,
              compliance history, enrollment status, tasks, call history,
              notes, and scripted calls.
            </p>
          </div>

          {lead && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                alignItems: "flex-end",
              }}
            >
              <Badge variant={statusBadgeVariant(lead.status)}>
                {statusLabel[lead.status]}
              </Badge>
              <Button
                size="sm"
                isLoading={nextLoading}
                disabled={nextLoading}
                onClick={() => {
                  void handleNextLead();
                }}
              >
                Next lead
              </Button>
              {nextError && (
                <div
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--color-danger)",
                    maxWidth: "16rem",
                    textAlign: "right",
                  }}
                >
                  {nextError}
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <Card title="Unable to load lead">
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

        {loading && !lead && !error && (
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-soft)",
            }}
          >
            Loading lead…
          </p>
        )}

        {lead && (
          <>
            {/* Contact compliance banner */}
            {renderContactComplianceBanner(lead)}

            {/* Main two-column layout */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(0, 1.4fr) minmax(0, 1fr)",
                gap: "var(--space-4)",
                alignItems: "flex-start",
              }}
            >
              {/* Left: lead info */}
              <Card
                title="Lead information"
                description="Core contact, assignment, and status for this lead."
                actions={
                  canEditLead && (
                    <div
                      style={{
                        display: "flex",
                        gap: "0.5rem",
                        alignItems: "center",
                      }}
                    >
                      {isEditing ? (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={saving}
                            onClick={handleCancelEdit}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            isLoading={saving}
                            disabled={saving || !hasEdits}
                            onClick={handleSave}
                          >
                            Save changes
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setIsEditing(true)}
                        >
                          Edit
                        </Button>
                      )}
                    </div>
                  )
                }
              >
                {saveError && (
                  <div
                    style={{
                      marginBottom: "var(--space-3)",
                      fontSize: "var(--text-sm)",
                      color: "var(--color-danger)",
                    }}
                  >
                    {saveError}
                  </div>
                )}

                <form
                  onSubmit={handleSave}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(2, minmax(0, 1fr))",
                    gap: "var(--space-4)",
                  }}
                >
                  <Input
                    label="First name"
                    value={
                      isEditing ? editFirstName : lead.firstName
                    }
                    onChange={(e) =>
                      setEditFirstName(e.target.value)
                    }
                    readOnly={!isEditing || !canEditLead}
                  />
                  <Input
                    label="Last name"
                    value={
                      isEditing ? editLastName : lead.lastName
                    }
                    onChange={(e) =>
                      setEditLastName(e.target.value)
                    }
                    readOnly={!isEditing || !canEditLead}
                  />
                  <Input
                    label="Email"
                    value={isEditing ? editEmail : lead.email ?? ""}
                    onChange={(e) =>
                      setEditEmail(e.target.value)
                    }
                    readOnly={!isEditing || !canEditLead}
                  />
                  <Input
                    label="Phone"
                    value={isEditing ? editPhone : lead.phone ?? ""}
                    onChange={(e) =>
                      setEditPhone(e.target.value)
                    }
                    readOnly={!isEditing || !canEditLead}
                  />
                  <Input
                    label="State"
                    value={isEditing ? editState : lead.state ?? ""}
                    onChange={(e) =>
                      setEditState(e.target.value)
                    }
                    readOnly={!isEditing || !canEditLead}
                  />
                  <Input
                    label="Status"
                    value={statusLabel[lead.status]}
                    readOnly
                  />
                  <Input
                    label="Assigned to (userId)"
                    value={
                      isEditing
                        ? editAssignee
                        : lead.assignedToUserId ?? ""
                    }
                    onChange={(e) =>
                      setEditAssignee(e.target.value)
                    }
                    readOnly={!isEditing || !canEditAssignee}
                    hint={
                      canEditAssignee
                        ? lead.assignedToName
                          ? `Currently assigned to: ${lead.assignedToName}. Change by userId.`
                          : "Assign this lead to an agent by userId."
                        : "Only admins, directors, and managers can change assignment."
                    }
                  />
                </form>

                <div
                  style={{
                    marginTop: "var(--space-4)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "var(--space-3)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-soft)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.15rem",
                    }}
                  >
                    <span>
                      Created:{" "}
                      {new Date(
                        lead.createdAt
                      ).toLocaleString()}
                    </span>
                    <span>
                      Last updated:{" "}
                      {new Date(
                        lead.updatedAt
                      ).toLocaleString()}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Right: pre-call compliance + scripted call + script history + calls + compliance history & activity timeline */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-4)",
                }}
              >
                <Card
                  title="Pre-call compliance"
                  description="Run a pre-call compliance check before you dial."
                >
                  <PreCallCompliancePanel leadId={lead.id} />
                </Card>

                <Card
                  title="Scripted call"
                  description="Interactive script to guide this call and capture a clean trail for compliance."
                >
                  <CallScriptPanel leadId={lead.id} />
                </Card>

                <Card
                  title="Scripted call history"
                  description="Previous scripted call runs for this lead."
                >
                  <CallScriptHistoryPanel leadId={lead.id} />
                </Card>

                <Card
                  title="Recent calls"
                  description="Call sessions logged for this lead. Log manual calls below."
                >
                  {/* Log call mini-form */}
                  <form
                    onSubmit={handleLogCall}
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(3, minmax(0, 1fr))",
                      gap: "var(--space-3)",
                      marginBottom: "var(--space-3)",
                      alignItems: "flex-end",
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
                        Direction
                      </label>
                      <select
                        value={newCallDirection}
                        onChange={(e) =>
                          setNewCallDirection(
                            e.target.value === "INBOUND"
                              ? "INBOUND"
                              : "OUTBOUND"
                          )
                        }
                        style={{
                          fontSize: "var(--text-xs)",
                          padding:
                            "0.35rem 0.5rem",
                          borderRadius:
                            "var(--radius-sm)",
                          border:
                            "1px solid var(--color-border-subtle)",
                          backgroundColor:
                            "var(--color-bg-subtle)",
                          color:
                            "var(--color-text-primary)",
                        }}
                      >
                        <option value="OUTBOUND">
                          OUTBOUND
                        </option>
                        <option value="INBOUND">
                          INBOUND
                        </option>
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
                        Purpose
                      </label>
                      <select
                        value={newCallPurpose}
                        onChange={(e) =>
                          setNewCallPurpose(
                            e.target.value as
                              | "EDUCATION"
                              | "MARKETING"
                              | "ENROLLMENT"
                              | "SERVICE"
                          )
                        }
                        style={{
                          fontSize: "var(--text-xs)",
                          padding:
                            "0.35rem 0.5rem",
                          borderRadius:
                            "var(--radius-sm)",
                          border:
                            "1px solid var(--color-border-subtle)",
                          backgroundColor:
                            "var(--color-bg-subtle)",
                          color:
                            "var(--color-text-primary)",
                        }}
                      >
                        <option value="ENROLLMENT">
                          ENROLLMENT
                        </option>
                        <option value="EDUCATION">
                          EDUCATION
                        </option>
                        <option value="MARKETING">
                          MARKETING
                        </option>
                        <option value="SERVICE">
                          SERVICE
                        </option>
                      </select>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        gap: "0.5rem",
                        alignItems: "flex-end",
                      }}
                    >
                      <div
                        style={{
                          flex: 1,
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
                          Outcome
                        </label>
                        <select
                          value={newCallStatus}
                          onChange={(e) =>
                            setNewCallStatus(
                              e.target.value as
                                | "COMPLETED"
                                | "FAILED"
                                | "ABANDONED"
                            )
                          }
                          style={{
                            fontSize: "var(--text-xs)",
                            padding:
                              "0.35rem 0.5rem",
                            borderRadius:
                              "var(--radius-sm)",
                            border:
                              "1px solid var(--color-border-subtle)",
                            backgroundColor:
                              "var(--color-bg-subtle)",
                            color:
                              "var(--color-text-primary)",
                          }}
                        >
                          <option value="COMPLETED">
                            COMPLETED
                          </option>
                          <option value="FAILED">
                            FAILED
                          </option>
                          <option value="ABANDONED">
                            ABANDONED
                          </option>
                        </select>
                      </div>
                      <Button
                        type="submit"
                        size="sm"
                        isLoading={logCallLoading}
                        disabled={logCallLoading}
                      >
                        Log call
                      </Button>
                    </div>
                  </form>

                  {logCallError && (
                    <div
                      style={{
                        marginBottom:
                          "var(--space-2)",
                        fontSize: "var(--text-sm)",
                        color: "var(--color-danger)",
                      }}
                    >
                      {logCallError}
                    </div>
                  )}

                  {callsError && (
                    <div
                      style={{
                        marginBottom:
                          "var(--space-2)",
                        fontSize: "var(--text-sm)",
                        color: "var(--color-danger)",
                      }}
                    >
                      {callsError}
                    </div>
                  )}

                  {calls.length === 0 &&
                  !callsLoading &&
                  !callsError ? (
                    <p
                      style={{
                        fontSize: "var(--text-sm)",
                        color:
                          "var(--color-text-soft)",
                        fontStyle: "italic",
                      }}
                    >
                      No call sessions recorded for this lead yet.
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
                          borderCollapse:
                            "collapse",
                          fontSize:
                            "var(--text-xs)",
                        }}
                      >
                        <thead>
                          <tr
                            style={{
                              textAlign: "left",
                              color:
                                "var(--color-text-soft)",
                              borderBottom:
                                "1px solid var(--color-border-subtle)",
                            }}
                          >
                            <th
                              style={{
                                padding: "0.4rem",
                              }}
                            >
                              Call
                            </th>
                            <th
                              style={{
                                padding: "0.4rem",
                              }}
                            >
                              Direction
                            </th>
                            <th
                              style={{
                                padding: "0.4rem",
                              }}
                            >
                              Purpose
                            </th>
                            <th
                              style={{
                                padding: "0.4rem",
                              }}
                            >
                              Status
                            </th>
                            <th
                              style={{
                                padding: "0.4rem",
                              }}
                            >
                              Compliance
                            </th>
                            <th
                              style={{
                                padding: "0.4rem",
                              }}
                            >
                              Started
                            </th>
                            <th
                              style={{
                                padding: "0.4rem",
                              }}
                            >
                              Ended
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {calls.map((call) => (
                            <tr
                              key={call.id}
                              style={{
                                borderBottom:
                                  "1px solid rgba(15,23,42,0.6)",
                              }}
                            >
                              <td
                                style={{
                                  padding: "0.4rem",
                                }}
                              >
                                <Link
                                  to={`/calls/${call.id}`}
                                  style={{
                                    color:
                                      "var(--color-primary)",
                                    textDecoration:
                                      "none",
                                  }}
                                >
                                  {call.id.slice(0, 8)}…
                                </Link>
                              </td>
                              <td
                                style={{
                                  padding: "0.4rem",
                                }}
                              >
                                {call.direction}
                              </td>
                              <td
                                style={{
                                  padding: "0.4rem",
                                }}
                              >
                                {call.purpose}
                              </td>
                              <td
                                style={{
                                  padding: "0.4rem",
                                }}
                              >
                                <Badge
                                  variant={callStatusVariant(
                                    call.status
                                  )}
                                >
                                  {call.status.toLowerCase()}
                                </Badge>
                              </td>
                              <td
                                style={{
                                  padding: "0.4rem",
                                }}
                              >
                                <Badge
                                  variant={callComplianceVariant(
                                    call.complianceState
                                  )}
                                >
                                  {call.complianceState}
                                </Badge>
                              </td>
                              <td
                                style={{
                                  padding: "0.4rem",
                                }}
                              >
                                {formatDate(call.startedAt)}
                              </td>
                              <td
                                style={{
                                  padding: "0.4rem",
                                }}
                              >
                                {formatDate(call.endedAt)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {callsLoading && (
                    <p
                      style={{
                        marginTop: "var(--space-2)",
                        fontSize: "var(--text-xs)",
                        color: "var(--color-text-soft)",
                      }}
                    >
                      Loading calls…
                    </p>
                  )}
                </Card>

                <Card
                  title="Compliance history"
                  description="Snapshot of prior compliance checks for this lead."
                >
                  <ComplianceHistoryPanel leadId={lead.id} />
                </Card>

                <Card
                  title="Activity timeline"
                  description="Audit trail of key actions taken on this lead."
                >
                  <ActivityTimelinePanel leadId={lead.id} />
                </Card>
              </div>
            </div>

            {/* Bottom row: Enrollment + Tasks + Notes */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(0, 1.2fr) minmax(0, 1fr)",
                gap: "var(--space-4)",
                alignItems: "flex-start",
              }}
            >
              <Card
                title="Enrollment journey"
                description="Track where this lead is in the enrollment pipeline."
              >
                <EnrollmentPanel leadId={lead.id} />
              </Card>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-4)",
                }}
              >
                <Card
                  title="Tasks"
                  description="Operational tasks tied to this lead."
                >
                  <TasksPanel leadId={lead.id} />
                </Card>

                <Card
                  title="Internal notes"
                  description="Internal-only notes and collaboration for this lead."
                >
                  <NotesPanel leadId={lead.id} />
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
};

export default LeadDetailPage;

