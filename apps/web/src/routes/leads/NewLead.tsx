// apps/web/src/routes/leads/NewLead.tsx

import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createLead,
} from "../../lib/apiClient";

interface FormState {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  state: string;
  zip: string;
  timezone: string;
  notes: string;
  permissionToContactPhone: boolean;
  doNotContact: boolean;
}

export default function NewLead() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    state: "",
    zip: "",
    timezone: "",
    notes: "",
    permissionToContactPhone: false,
    doNotContact: false,
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.firstName.trim() || !form.lastName.trim() || !form.phone.trim()) {
      setError("First name, last name, and phone are required.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        state: form.state.trim() || null,
        zip: form.zip.trim() || null,
        timezone: form.timezone.trim() || null,
        notes: form.notes.trim() || null,
        permissionToContactPhone: form.permissionToContactPhone,
        doNotContact: form.doNotContact,
        assignedToId: null,
      };

      const created = await createLead(payload);

      // Navigate to the new lead's detail page
      navigate(`/leads/${created.id}`);
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Failed to create lead.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "1.5rem" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
        Create New Lead
      </h1>

      {error && (
        <div
          style={{
            marginBottom: "1rem",
            padding: "0.75rem 1rem",
            borderRadius: 4,
            border: "1px solid #f87171",
            backgroundColor: "#fef2f2",
            color: "#b91c1c",
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "0.75rem" }}>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: "0.875rem" }}>
              First Name *
            </label>
            <input
              name="firstName"
              value={form.firstName}
              onChange={handleChange}
              required
              style={{ width: "100%", padding: "0.5rem" }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: "0.875rem" }}>
              Last Name *
            </label>
            <input
              name="lastName"
              value={form.lastName}
              onChange={handleChange}
              required
              style={{ width: "100%", padding: "0.5rem" }}
            />
          </div>
        </div>

        <div>
          <label style={{ display: "block", fontSize: "0.875rem" }}>
            Phone *
          </label>
          <input
            name="phone"
            value={form.phone}
            onChange={handleChange}
            required
            style={{ width: "100%", padding: "0.5rem" }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: "0.875rem" }}>
            Email
          </label>
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            style={{ width: "100%", padding: "0.5rem" }}
          />
        </div>

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: "0.875rem" }}>
              State
            </label>
            <input
              name="state"
              value={form.state}
              onChange={handleChange}
              style={{ width: "100%", padding: "0.5rem" }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: "0.875rem" }}>
              ZIP
            </label>
            <input
              name="zip"
              value={form.zip}
              onChange={handleChange}
              style={{ width: "100%", padding: "0.5rem" }}
            />
          </div>
        </div>

        <div>
          <label style={{ display: "block", fontSize: "0.875rem" }}>
            Timezone
          </label>
          <input
            name="timezone"
            value={form.timezone}
            onChange={handleChange}
            placeholder="e.g. America/New_York"
            style={{ width: "100%", padding: "0.5rem" }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: "0.875rem" }}>
            Notes
          </label>
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows={3}
            style={{ width: "100%", padding: "0.5rem" }}
          />
        </div>

        <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.5rem" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              type="checkbox"
              name="permissionToContactPhone"
              checked={form.permissionToContactPhone}
              onChange={handleChange}
            />
            Permission to contact by phone
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              type="checkbox"
              name="doNotContact"
              checked={form.doNotContact}
              onChange={handleChange}
            />
            Do not contact
          </label>
        </div>

        <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: 4,
              border: "none",
              backgroundColor: submitting ? "#9ca3af" : "#2563eb",
              color: "white",
              cursor: submitting ? "default" : "pointer",
            }}
          >
            {submitting ? "Creating..." : "Create Lead"}
          </button>

          <button
            type="button"
            onClick={() => navigate("/leads")}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: 4,
              border: "1px solid #d1d5db",
              backgroundColor: "white",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

