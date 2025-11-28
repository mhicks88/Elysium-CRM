import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  LeadDetailDto,
  LeadStatus,
  UpdateLeadRequestDto,
} from "@elysium-crm/shared-types/dto/lead";
import {
  PlannedCallPurpose,
  PreCallCheckResultDto,
} from "@elysium-crm/shared-types/dto/compliance";

import { getLeadById, runPreCallCheck, updateLead } from "../../lib/apiClient";

const statusOptions = Object.values(LeadStatus);
const purposeOptions: PlannedCallPurpose[] = [
  "EDUCATION",
  "MARKETING",
  "ENROLLMENT",
  "SERVICE",
];

const LeadDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lead, setLead] = useState<LeadDetailDto | null>(null);
  const [form, setForm] = useState<UpdateLeadRequestDto>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [purpose, setPurpose] = useState<PlannedCallPurpose>("EDUCATION");
  const [complianceResult, setComplianceResult] =
    useState<PreCallCheckResultDto | null>(null);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [complianceError, setComplianceError] = useState<string | null>(null);

  const syncFormFromLead = (data: LeadDetailDto) => {
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
    const fetchLead = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const data = await getLeadById(id);
        setLead(data);
        syncFormFromLead(data);
        setPurpose("EDUCATION");
        setComplianceResult(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load lead";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void fetchLead();
  }, [id]);

  const updateField = <K extends keyof UpdateLeadRequestDto>(
    key: K,
    value: UpdateLeadRequestDto[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    setSaveMessage(null);
    setError(null);
    try {
      const updated = await updateLead(id, form);
      setLead(updated);
      syncFormFromLead(updated);
      setSaveMessage("Saved");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save lead";
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
      const result = await runPreCallCheck({ leadId: id, purpose });
      setComplianceResult(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to run check";
      setComplianceError(message);
    } finally {
      setComplianceLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: "1.5rem" }}>Loading lead...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: "1.5rem" }}>
        <p style={{ color: "red" }}>{error}</p>
        <button onClick={() => navigate(-1)} style={{ marginTop: "0.5rem" }}>
          Go back
        </button>
      </div>
    );
  }

  if (!lead) {
    return null;
  }

  return (
    <div style={{ padding: "1.5rem", display: "grid", gap: "1.5rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <h1>
            {lead.firstName} {lead.lastName}
          </h1>
          <p style={{ color: "#6b7280" }}>Status: {lead.status.replace(/_/g, " ")}</p>
          <p style={{ color: "#6b7280" }}>
            Assigned to: {lead.assignedToName ?? "Unassigned"}
          </p>
        </div>
      </header>

      <section
        style={{
          border: "1px solid #e5e7eb",
          padding: "1rem",
          borderRadius: 6,
        }}
      >
        <h2>Lead details</h2>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "0.75rem", maxWidth: 720 }}>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="firstName" style={{ display: "block", marginBottom: 4 }}>
                First name
              </label>
              <input
                id="firstName"
                type="text"
                value={form.firstName ?? ""}
                onChange={(e) => updateField("firstName", e.target.value)}
                style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #ccc" }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor="lastName" style={{ display: "block", marginBottom: 4 }}>
                Last name
              </label>
              <input
                id="lastName"
                type="text"
                value={form.lastName ?? ""}
                onChange={(e) => updateField("lastName", e.target.value)}
                style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #ccc" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="email" style={{ display: "block", marginBottom: 4 }}>
                Email
              </label>
              <input
                id="email"
                type="email"
                value={form.email ?? ""}
                onChange={(e) => updateField("email", e.target.value)}
                style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #ccc" }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor="phone" style={{ display: "block", marginBottom: 4 }}>
                Phone
              </label>
              <input
                id="phone"
                type="tel"
                value={form.phone ?? ""}
                onChange={(e) => updateField("phone", e.target.value)}
                style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #ccc" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="state" style={{ display: "block", marginBottom: 4 }}>
                State
              </label>
              <input
                id="state"
                type="text"
                value={form.state ?? ""}
                onChange={(e) => updateField("state", e.target.value)}
                style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #ccc" }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor="zip" style={{ display: "block", marginBottom: 4 }}>
                ZIP
              </label>
              <input
                id="zip"
                type="text"
                value={form.zip ?? ""}
                onChange={(e) => updateField("zip", e.target.value)}
                style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #ccc" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="timezone" style={{ display: "block", marginBottom: 4 }}>
                Timezone
              </label>
              <input
                id="timezone"
                type="text"
                value={form.timezone ?? ""}
                onChange={(e) => updateField("timezone", e.target.value)}
                style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #ccc" }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor="status" style={{ display: "block", marginBottom: 4 }}>
                Status
              </label>
              <select
                id="status"
                value={form.status ?? LeadStatus.NEW}
                onChange={(e) => updateField("status", e.target.value as LeadStatus)}
                style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #ccc" }}
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
            <label htmlFor="notes" style={{ display: "block", marginBottom: 4 }}>
              Notes
            </label>
            <textarea
              id="notes"
              value={form.notes ?? ""}
              onChange={(e) => updateField("notes", e.target.value)}
              rows={4}
              style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #ccc" }}
            />
          </div>

          <div style={{ display: "flex", gap: "1.5rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                checked={Boolean(form.permissionToContactPhone)}
                onChange={(e) => updateField("permissionToContactPhone", e.target.checked)}
              />
              Permission to contact by phone
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                checked={Boolean(form.doNotContact)}
                onChange={(e) => updateField("doNotContact", e.target.checked)}
              />
              Do not contact
            </label>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "0.6rem 1.25rem",
                borderRadius: 4,
                border: "none",
                backgroundColor: "#2563eb",
                color: "white",
                cursor: "pointer",
              }}
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
            {saveMessage && <span style={{ color: "green" }}>{saveMessage}</span>}
          </div>
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
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginTop: "0.5rem" }}>
          <select
            value={purpose}
            onChange={(e) => setPurpose(e.target.value as PlannedCallPurpose)}
            style={{ padding: "0.5rem", borderRadius: 4, border: "1px solid #ccc" }}
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
              cursor: "pointer",
            }}
          >
            {complianceLoading ? "Checking..." : "Run check"}
          </button>
        </div>
        {complianceError && (
          <p style={{ color: "red", marginTop: "0.5rem" }}>{complianceError}</p>
        )}
        {complianceResult && (
          <div style={{ marginTop: "0.75rem" }}>
            <p>
              Overall status: <strong>{complianceResult.status}</strong>
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
                    <strong>{check.type}:</strong> {check.status}
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
