// apps/web/src/routes/leads/NewLead.tsx
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

type LeadStatus = "NEW" | "IN_PROGRESS" | "ENROLLED" | "DO_NOT_CONTACT";

interface CreateLeadPayload {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  state?: string | null;
  status?: LeadStatus;
}

/**
 * Local helper to create a lead via the API.
 * We keep apiClient.ts untouched and just POST directly.
 */
async function createLead(payload: CreateLeadPayload) {
  const res = await fetch("/api/leads", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let message = `Failed to create lead (status ${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const data = await res.json();
  return data as { id: string };
}

const NewLeadPage: React.FC = () => {
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [state, setState] = useState<string>("");

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    firstName.trim().length > 0 && lastName.trim().length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);

    try {
      const payload: CreateLeadPayload = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        state: state.trim() || null,
        status: "NEW",
      };

      const created = await createLead(payload);

      // Navigate to the new lead's detail page
      if (created?.id) {
        navigate(`/leads/${created.id}`);
      } else {
        navigate("/leads");
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to create lead");
    } finally {
      setSubmitting(false);
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
        {/* Header */}
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
              New lead
            </h1>
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-soft)",
                maxWidth: "40rem",
              }}
            >
              Capture a new lead with just the minimum information required to
              start a compliant outreach workflow.
            </p>
          </div>
        </div>

        <Card
          title="Lead details"
          description="You can always enrich this record later. First and last name are required."
        >
          {error && (
            <div
              style={{
                marginBottom: "var(--space-3)",
                fontSize: "var(--text-sm)",
                color: "var(--color-danger)",
              }}
            >
              {error}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-5)",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "var(--space-4)",
              }}
            >
              <Input
                label="First name"
                requiredLabel
                placeholder="Jane"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
              <Input
                label="Last name"
                requiredLabel
                placeholder="Doe"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
              <Input
                label="Email"
                placeholder="jane.doe@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                label="Phone"
                placeholder="+1 (555) 555-1234"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <Input
                label="State"
                placeholder="CA"
                value={state}
                onChange={(e) => setState(e.target.value)}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "var(--space-3)",
              }}
            >
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => navigate("/leads")}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                isLoading={submitting}
                disabled={submitting || !canSubmit}
              >
                Create lead
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
};

export default NewLeadPage;

