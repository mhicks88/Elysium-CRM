// apps/web/src/routes/auth/SignupOrg.tsx

import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signupOrg, setAccessToken } from "../../lib/apiClient";
import { useAuth } from "../../lib/auth";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

const SignupOrgPage: React.FC = () => {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const [organizationName, setOrganizationName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    organizationName.trim().length > 0 &&
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= 8;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        organizationName: organizationName.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
      };

      const result = await signupOrg(payload);

      // result has shape { accessToken, user: { id, email, role, organizationId } }
      if (result?.accessToken) {
        setAccessToken(result.accessToken);
      }

      if (result?.user) {
        setUser({
          id: result.user.id,
          email: result.user.email,
          role: result.user.role,
          organizationId: result.user.organizationId,
        });
      }

      // After signup, land in the main app (you can change this to /admin if you prefer)
      navigate("/leads");
    } catch (err: any) {
      setError(err?.message ?? "Signup failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-6)",
        background:
          "radial-gradient(circle at top, rgba(56,189,248,0.08), transparent 55%), radial-gradient(circle at bottom, rgba(59,130,246,0.08), transparent 55%)",
      }}
    >
      <div style={{ maxWidth: 480, width: "100%" }}>
        <Card
          title="Create your organization"
          description="Spin up a new Elysium CRM workspace with an admin account."
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
              gap: "var(--space-4)",
            }}
          >
            <Input
              label="Organization name"
              requiredLabel
              placeholder="Acme Insurance Group"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "var(--space-3)",
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
            </div>
            <Input
              label="Email"
              requiredLabel
              placeholder="jane.doe@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="Password"
              requiredLabel
              type="password"
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "var(--space-2)",
              }}
            >
              <div
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--color-text-soft)",
                }}
              >
                Already have an account?{" "}
                <Link to="/login">Log in</Link>
              </div>
              <Button
                type="submit"
                size="sm"
                isLoading={submitting}
                disabled={!canSubmit || submitting}
              >
                Create workspace
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default SignupOrgPage;

