// apps/web/src/routes/leads/LeadDetail.tsx

import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Input } from "../../components/ui/Input";
import { ComplianceHistoryPanel } from "./ComplianceHistoryPanel";
import { AuditLogPanel } from "./AuditLogPanel";
import { EnrollmentPanel } from "../../components/enrollment/EnrollmentPanel";
import { TasksPanel } from "../../components/tasks/TasksPanel";
import { CallScriptPanel } from "./CallScriptPanel";
import { getLeadById, updateLead } from "../../lib/apiClient";
import { useAuth } from "../../lib/auth";

type LeadStatus = "NEW" | "IN_PROGRESS" | "ENROLLED" | "DO_NOT_CONTACT";

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
}

const statusLabel: Record<LeadStatus, string> = {
  NEW: "New",
  IN_PROGRESS: "In progress",
  ENROLLED: "Enrolled",
  DO_NOT_CONTACT: "Do Not Contact",
};

function statusBadgeVariant(status: LeadStatus) {
  switch (status) {
    case "ENROLLED":
      return "success" as const;
    case "DO_NOT_CONTACT":
      return "danger" as const;
    case "IN_PROGRESS":
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

const LeadDetailPage: React.FC = () => {
  const params = useParams<{ id: string }>();
  const leadId = params.id ?? "";

  const { user } = useAuth() as { user: any | null };
  const userRole = (user?.role ?? null) as Role | null;
  const canEditAssignee =
    userRole === "ADMIN" ||
    userRole === "MANAGER" ||
    userRole === "DIRECTOR";

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

  useEffect(() => {
    if (!leadId) return;

    let mounted = true;

    async function load() {
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

    void load();
    return () => {
      mounted = false;
    };
  }, [leadId]);

  const hasEdits =
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
    if (!lead || !hasEdits) return;

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
              compliance history, enrollment status, tasks, and scripted calls.
            </p>
          </div>

          {lead && (
            <Badge variant={statusBadgeVariant(lead.status)}>
              {statusLabel[lead.status]}
            </Badge>
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
                gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
                gap: "var(--space-4)",
                alignItems: "flex-start",
              }}
            >
              {/* Left: lead info */}
              <Card
                title="Lead information"
                description="Core contact, assignment, and status for this lead."
                actions={
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
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: "var(--space-4)",
                  }}
                >
                  <Input
                    label="First name"
                    value={isEditing ? editFirstName : lead.firstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    readOnly={!isEditing}
                  />
                  <Input
                    label="Last name"
                    value={isEditing ? editLastName : lead.lastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    readOnly={!isEditing}
                  />
                  <Input
                    label="Email"
                    value={isEditing ? editEmail : lead.email ?? ""}
                    onChange={(e) => setEditEmail(e.target.value)}
                    readOnly={!isEditing}
                  />
                  <Input
                    label="Phone"
                    value={isEditing ? editPhone : lead.phone ?? ""}
                    onChange={(e) => setEditPhone(e.target.value)}
                    readOnly={!isEditing}
                  />
                  <Input
                    label="State"
                    value={isEditing ? editState : lead.state ?? ""}
                    onChange={(e) => setEditState(e.target.value)}
                    readOnly={!isEditing}
                  />
                  <Input
                    label="Status"
                    value={statusLabel[lead.status]}
                    readOnly
                  />
                  <Input
                    label="Assigned to (userId)"
                    value={
                      isEditing ? editAssignee : lead.assignedToUserId ?? ""
                    }
                    onChange={(e) => setEditAssignee(e.target.value)}
                    readOnly={!isEditing || !canEditAssignee}
                    hint={
                      canEditAssignee
                        ? "Assign this lead to an agent by userId."
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

              {/* Right: scripted call + compliance history & audit log */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-4)",
                }}
              >
                <Card
                  title="Scripted call"
                  description="Interactive script to guide this call and capture a clean trail for compliance."
                >
                  <CallScriptPanel leadId={lead.id} />
                </Card>

                <Card
                  title="Compliance history"
                  description="Snapshot of prior compliance checks for this lead."
                >
                  <ComplianceHistoryPanel leadId={lead.id} />
                </Card>

                <Card
                  title="Audit log"
                  description="Recent actions taken on this lead."
                >
                  <AuditLogPanel leadId={lead.id} />
                </Card>
              </div>
            </div>

            {/* Bottom row: Enrollment + Tasks */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)",
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

              <Card
                title="Tasks"
                description="Operational tasks tied to this lead."
              >
                <TasksPanel leadId={lead.id} />
              </Card>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
};

export default LeadDetailPage;
