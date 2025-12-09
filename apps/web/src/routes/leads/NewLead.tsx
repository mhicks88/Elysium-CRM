// apps/web/src/routes/leads/NewLead.tsx

import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { createLead } from "../../lib/apiClient";
import { useAuth } from "../../lib/auth";

type LeadStatus = "NEW" | "IN_PROGRESS" | "ENROLLED" | "DO_NOT_CONTACT";

const NewLeadPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth() as { user: any | null };
  const currentUserId = user?.id ?? null;

  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [state, setState] = useState<string>("");
  const [zip, setZip] = useState<string>("");
  const [dob, setDob] = useState<string>(""); // YYYY-MM-DD from <input type="date">
  const [permissionToContactPhone, setPermissionToContactPhone] =
    useState<boolean>(false);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    phone.trim().length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        state: state.trim() || null,
        zip: zip.trim() || null,
        permissionToContactPhone,
        doNotContact: false,
        status: "NEW" as LeadStatus,
        // Send raw YYYY-MM-DD string; backend will parse or fall back.
        dateOfBirth: dob.trim() || null,
      };

      // IMPORTANT: assign new lead to current user so AGENT visibility works
      if (currentUserId) {
        payload.assignedToId = currentUserId;
      }

      const created = await createLead(payload);

      // Navigate to the new lead's detail page
      if (created && typeof created.id === "string") {
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
              Capture a new lead with the minimum information required to
              start a compliant outreach workflow. First name, last name,
              and phone are required.
            </p>
          </div>
        </div>

        <Card
          title="Lead details"
          description="You can always enrich this record later. Phone is required so we can tie calls and compliance checks correctly."
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
                requiredLabel
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
              <Input
                label="ZIP"
                placeholder="94105"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
              />
              <Input
                label="Date of birth"
                placeholder="YYYY-MM-DD"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                type="date"
              />
            </div>

            {/* Permission to contact */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginTop: "var(--space-2)",
              }}
            >
              <input
                id="permissionToContactPhone"
                type="checkbox"
                checked={permissionToContactPhone}
                onChange={(e) =>
                  setPermissionToContactPhone(e.target.checked)
                }
              />
              <label
                htmlFor="permissionToContactPhone"
                style={{
                  fontSize: "var(--text-sm)",
                  color: "var(--color-text-primary)",
                }}
              >
                I have captured permission to contact this lead by phone.
              </label>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "var(--space-3)",
                marginTop: "var(--space-4)",
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

