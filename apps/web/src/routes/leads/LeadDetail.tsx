import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getLeadById, runPreCallCheck, updateLead } from "../../lib/apiClient";

// Local types (mirror the API payloads) so we don't depend on shared-types.

type LeadStatus = "NEW" | "IN_PROGRESS" | "ENROLLED" | "DO_NOT_CONTACT";

interface LeadDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  state: string | null;
  zip: string | null;
  status: LeadStatus;
  notes: string | null;
  timezone: string | null;
  permissionToContactPhone: boolean;
  doNotContact: boolean;
  createdAt: string;
  updatedAt: string;
  assignedToId: string | null;
  assignedToName: string | null;
}

interface UpdateLeadRequest {
  firstName?: string;
  lastName?: string;
  email?: string | null;
  phone?: string | null;
  state?: string | null;
  zip?: string | null;
  status?: LeadStatus;
  notes?: string | null;
  timezone?: string | null;
  permissionToContactPhone?: boolean;
  doNotContact?: boolean;
  assignedToId?: string | null;
}

type PlannedCallPurpose =
  | "EDUCATION"
  | "MARKETING"
  | "ENROLLMENT"
  | "SERVICE";

type PreCallCheckStatus = "PASS" | "FAIL";

interface PreCallCheckResult {
  status: PreCallCheckStatus;
  reasons: string[];
  checks: {
    type: string;
    status: "PASS" | "FAIL" | "SKIPPED";
    message?: string;
  }[];
}

const statusOptions: LeadStatus[] = [
  "NEW",
  "IN_PROGRESS",
  "ENROLLED",
  "DO_NOT_CONTACT",
];

const purposeOptions: PlannedCallPurpose[] = [
  "EDUCATION",
  "MARKETING",
  "ENROLLMENT",
  "SERVICE",
];

const LeadDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [form, setForm] = useState<UpdateLeadRequest>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [isDirty, setIsDirty] = useState(false); // tracks unsaved edits

  const [purpose, setPurpose] = useState<PlannedCallPurpose>("EDUCATION");
  const [complianceResult, setComplianceResult] =
    useState<PreCallCheckResult | null>(null);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [complianceError, setComplianceError] = useState<string | null>(null);

  const syncFormFromLead = (data: LeadDetail) => {
    setForm({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      state: data.state,
      zip: data.zip,
      status: data.status,
      notes: data.notes,
      timezone: data.timezone,
      permissionToContactPhone: data.permissionToContactPhone,
      doNotContact: data.doNotContact,
      assignedToId: data.assignedToId,
    });
  };

  useEffect(() => {
    if (!id) return;

    const fetchLead = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = (await getLeadById(id)) as LeadDetail;
        setLead(data);
        syncFormFromLead(data);
        setPurpose("EDUCATION");
        setComplianceResult(null);
        setIsEditing(false);
        setIsDirty(false);
        setSaveMessage(null);
      } catch (err: any) {
        const message =
          err instanceof Error ? err.message : "Failed to load lead";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void fetchLead();
  }, [id]);

  const updateField =
    <K extends keyof UpdateLeadRequest>(key: K) =>
    (value: UpdateLeadRequest[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      if (isEditing) {
        setIsDirty(true);
      }
    };

  const handleStartEdit = () => {
    if (!lead) return;
    syncFormFromLead(lead);
    setSaveMessage(null);
    setError(null);
    setIsEditing(true);
    setIsDirty(false);
  };

  const handleCancelEdit = () => {
    if (!lead) return;
    syncFormFromLead(lead);
    setIsEditing(false);
    setSaving(false);
    setError(null);
    setIsDirty(false);
    // keep last "Saved" message if there was one
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !isEditing) return;

    setSaving(true);
    setSaveMessage(null);
    setError(null);

    try {
      const updated = (await updateLead(id, form)) as LeadDetail;
      setLead(updated);
      syncFormFromLead(updated);
      setSaveMessage("Changes saved");
      setIsEditing(false);
      setIsDirty(false);
    } catch (err: any) {
      const message =
        err instanceof Error ? err.message : "Failed to save lead";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleComplianceCheck = async () => {
    if (!id) return;

    setComplianceLoading(true);
    setComplianceError(null);
    setComplianceResult(null);

    try {
      const result = (await runPreCallCheck({
        leadId: id,
        purpose,
      })) as PreCallCheckResult;
      setComplianceResult(result);
    } catch (err: any) {
      const message =
        err instanceof Error ? err.message : "Failed to run check";
      setComplianceError(message);
    } finally {
      setComplianceLoading(false);
    }
  };

  const hasUnsavedChanges = isEditing && isDirty;

  // Tab close / refresh protection
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  const confirmNavigateAway = () => {
    if (!hasUnsavedChanges) return true;
    return window.confirm(
      "You have unsaved changes. Are you sure you want to leave this page?"
    );
  };

  const handleBackToLeads = () => {
    if (!confirmNavigateAway()) return;
    navigate(-1);
  };

  const handleErrorGoBack = () => {
    if (!confirmNavigateAway()) return;
    navigate(-1);
  };

  if (loading) {
    return <div style={{ padding: "1.5rem" }}>Loading lead...</div>;
  }

  if (error && !lead) {
    return (
      <div style={{ padding: "1.5rem" }}>
        <p style={{ color: "red" }}>{error}</p>
        <button
          onClick={handleErrorGoBack}
          style={{ marginTop: "0.5rem" }}
        >
          Go back
        </button>
      </div>
    );
  }

  if (!lead) {
    return null;
  }

  const inputBorder = isEditing ? "#2563eb" : "#ccc";
  const inputBg = isEditing ? "#ffffff" : "#f9fafb";

  return (
    <div style={{ padding: "1.5rem", display: "grid", gap: "1.5rem" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h1>
            {lead.firstName} {lead.lastName}
          </h1>
          <p style={{ color: "#6B7280" }}>
            Status: {lead.status.replace(/_/g, " ")}
          </p>
          <p style={{ color: "#6B7280" }}>
            Assigned to: {lead.assignedToName ?? "Unassigned"}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={handleBackToLeads}>Back to leads</button>
        </div>
      </header>

      <section
        style={{
          border: "1px solid #e5e7eb",
          padding: "1rem",
          borderRadius: 6,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "0.75rem",
          }}
        >
          <h2>Lead details</h2>
          {!isEditing ? (
            <button
              type="button"
              onClick={handleStartEdit}
              style={{
                padding: "0.4rem 0.9rem",
                borderRadius: 4,
                border: "1px solid #2563eb",
                backgroundColor: "#2563eb",
                color: "#fff",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Edit
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCancelEdit}
              style={{
                padding: "0.4rem 0.9rem",
                borderRadius: 4,
                border: "1px solid #d1d5db",
                backgroundColor: "#f9fafb",
                color: "#374151",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Cancel edit
            </button>
          )}
        </div>

        {error && (
          <div
            style={{
              marginBottom: "0.75rem",
              padding: "0.75rem",
              borderRadius: 4,
              backgroundColor: "#fee2e2",
              color: "#b91c1c",
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        {saveMessage && !isEditing && (
          <div
            style={{
              marginBottom: "0.75rem",
              padding: "0.5rem 0.75rem",
              borderRadius: 4,
              backgroundColor: "#dcfce7",
              color: "#166534",
              fontSize: 13,
            }}
          >
            {saveMessage}
          </div>
        )}

        {hasUnsavedChanges && (
          <div
            style={{
              marginBottom: "0.75rem",
              padding: "0.5rem 0.75rem",
              borderRadius: 4,
              backgroundColor: "#fef9c3",
              color: "#854d0e",
              fontSize: 13,
            }}
          >
            You have unsaved changes.
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          style={{ display: "grid", gap: "0.75rem", maxWidth: 720 }}
        >
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <div style={{ flex: 1 }}>
              <label
                htmlFor="firstName"
                style={{ display: "block", marginBottom: 4 }}
              >
                First name
              </label>
              <input
                id="firstName"
                type="text"
                value={form.firstName ?? ""}
                onChange={(e) => updateField("firstName")(e.target.value)}
                disabled={!isEditing}
                style={{
                  width: "100%",
                  padding: 8,
                  borderRadius: 4,
                  border: `1px solid ${inputBorder}`,
                  backgroundColor: inputBg,
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label
                htmlFor="lastName"
                style={{ display: "block", marginBottom: 4 }}
              >
                Last name
              </label>
              <input
                id="lastName"
                type="text"
                value={form.lastName ?? ""}
                onChange={(e) => updateField("lastName")(e.target.value)}
                disabled={!isEditing}
                style={{
                  width: "100%",
                  padding: 8,
                  borderRadius: 4,
                  border: `1px solid ${inputBorder}`,
                  backgroundColor: inputBg,
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <div style={{ flex: 1 }}>
              <label
                htmlFor="email"
                style={{ display: "block", marginBottom: 4 }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={form.email ?? ""}
                onChange={(e) => updateField("email")(e.target.value)}
                disabled={!isEditing}
                style={{
                  width: "100%",
                  padding: 8,
                  borderRadius: 4,
                  border: `1px solid ${inputBorder}`,
                  backgroundColor: inputBg,
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label
                htmlFor="phone"
                style={{ display: "block", marginBottom: 4 }}
              >
                Phone
              </label>
              <input
                id="phone"
                type="tel"
                value={form.phone ?? ""}
                onChange={(e) => updateField("phone")(e.target.value)}
                disabled={!isEditing}
                style={{
                  width: "100%",
                  padding: 8,
                  borderRadius: 4,
                  border: `1px solid ${inputBorder}`,
                  backgroundColor: inputBg,
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <div style={{ flex: 1 }}>
              <label
                htmlFor="state"
                style={{ display: "block", marginBottom: 4 }}
              >
                State
              </label>
              <input
                id="state"
                type="text"
                value={form.state ?? ""}
                onChange={(e) => updateField("state")(e.target.value)}
                disabled={!isEditing}
                style={{
                  width: "100%",
                  padding: 8,
                  borderRadius: 4,
                  border: `1px solid ${inputBorder}`,
                  backgroundColor: inputBg,
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label
                htmlFor="zip"
                style={{ display: "block", marginBottom: 4 }}
              >
                ZIP
              </label>
              <input
                id="zip"
                type="text"
                value={form.zip ?? ""}
                onChange={(e) => updateField("zip")(e.target.value)}
                disabled={!isEditing}
                style={{
                  width: "100%",
                  padding: 8,
                  borderRadius: 4,
                  border: `1px solid ${inputBorder}`,
                  backgroundColor: inputBg,
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <div style={{ flex: 1 }}>
              <label
                htmlFor="timezone"
                style={{ display: "block", marginBottom: 4 }}
              >
                Timezone
              </label>
              <input
                id="timezone"
                type="text"
                value={form.timezone ?? ""}
                onChange={(e) => updateField("timezone")(e.target.value)}
                disabled={!isEditing}
                style={{
                  width: "100%",
                  padding: 8,
                  borderRadius: 4,
                  border: `1px solid ${inputBorder}`,
                  backgroundColor: inputBg,
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label
                htmlFor="status"
                style={{ display: "block", marginBottom: 4 }}
              >
                Status
              </label>
              <select
                id="status"
                value={form.status ?? "NEW"}
                onChange={(e) =>
                  updateField("status")(e.target.value as LeadStatus)
                }
                disabled={!isEditing}
                style={{
                  width: "100%",
                  padding: 8,
                  borderRadius: 4,
                  border: `1px solid ${inputBorder}`,
                  backgroundColor: inputBg,
                }}
              >
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="notes"
              style={{ display: "block", marginBottom: 4 }}
            >
              Notes
            </label>
            <textarea
              id="notes"
              value={form.notes ?? ""}
              onChange={(e) => updateField("notes")(e.target.value)}
              rows={4}
              disabled={!isEditing}
              style={{
                width: "100%",
                padding: 8,
                borderRadius: 4,
                border: `1px solid ${inputBorder}`,
                backgroundColor: inputBg,
              }}
            />
          </div>

          <div style={{ display: "flex", gap: "1.5rem" }}>
            <label
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <input
                type="checkbox"
                checked={!!form.permissionToContactPhone}
                onChange={(e) =>
                  updateField("permissionToContactPhone")(e.target.checked)
                }
                disabled={!isEditing}
              />
              Permission to contact by phone
            </label>
            <label
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <input
                type="checkbox"
                checked={!!form.doNotContact}
                onChange={(e) =>
                  updateField("doNotContact")(e.target.checked)
                }
                disabled={!isEditing}
              />
              Do not contact
            </label>
          </div>

          {isEditing && (
            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                alignItems: "center",
                marginTop: "0.5rem",
              }}
            >
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: "0.6rem 1.25rem",
                  borderRadius: 4,
                  border: "none",
                  backgroundColor: "#2563eb",
                  color: "white",
                  cursor: saving ? "default" : "pointer",
                }}
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={saving}
                style={{
                  padding: "0.6rem 1.1rem",
                  borderRadius: 4,
                  border: "1px solid #d1d5db",
                  backgroundColor: "#f9fafb",
                  color: "#374151",
                  cursor: saving ? "default" : "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </form>
      </section>

      <section
        style={{
          border: "1px solid #e5e7eb",
          padding: "1rem",
          borderRadius: 6,
        }}
      >
        <h2>Pre-call compliance check</h2>
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            alignItems: "center",
            marginTop: "0.5rem",
          }}
        >
          <select
            value={purpose}
            onChange={(e) =>
              setPurpose(e.target.value as PlannedCallPurpose)
            }
            style={{
              padding: "0.5rem",
              borderRadius: 4,
              border: "1px solid #ccc",
            }}
          >
            {purposeOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <button
            onClick={handleComplianceCheck}
            disabled={complianceLoading}
            style={{
              padding: "0.6rem 1rem",
              borderRadius: 4,
              border: "none",
              backgroundColor: "#111827",
              color: "white",
              cursor: complianceLoading ? "default" : "pointer",
            }}
          >
            {complianceLoading ? "Checking..." : "Run check"}
          </button>
        </div>

        {complianceError && (
          <p style={{ color: "red", marginTop: "0.5rem" }}>
            {complianceError}
          </p>
        )}

        {complianceResult && (
          <div style={{ marginTop: "0.75rem" }}>
            <p>
              Overall status:{" "}
              <strong>{complianceResult.status}</strong>
            </p>

            {complianceResult.reasons.length > 0 && (
              <ul>
                {complianceResult.reasons.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            )}

            <div style={{ marginTop: "0.5rem" }}>
              {complianceResult.checks.map((check) => (
                <div
                  key={check.type}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 4,
                    padding: "0.5rem",
                    marginBottom: "0.5rem",
                  }}
                >
                  <div>
                    <strong>{check.type}</strong>: {check.status}
                  </div>
                  {check.message && <div>{check.message}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default LeadDetailPage;

