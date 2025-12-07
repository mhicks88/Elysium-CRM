// apps/web/src/routes/auth/Login.tsx

import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { login, setAccessToken } from "../../lib/apiClient";
import { useAuth } from "../../lib/auth";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);

    try {
      const result = await login({
        email: email.trim(),
        password,
      });

      // result should be { accessToken, user: { id, email, role, organizationId } }
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

      // After login, send them to main app view
      navigate("/leads");
    } catch (err: any) {
      setError(err?.message ?? "Login failed");
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
      <div style={{ maxWidth: 420, width: "100%" }}>
        <Card
          title="Sign in to Elysium"
          description="Log in to access your compliance-first CRM workspace."
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
              label="Email"
              requiredLabel
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="Password"
              requiredLabel
              type="password"
              placeholder="Your password"
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
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  fontSize: "var(--text-xs)",
                  color: "var(--color-text-soft)",
                }}
              >
                <span>
                  Need a new org? <Link to="/signup">Create one</Link>
                </span>
                <span>
                  Forgot your password?{" "}
                  <Link to="/forgot-password">Reset it</Link>
                </span>
              </div>

              <Button
                type="submit"
                size="sm"
                isLoading={submitting}
                disabled={!canSubmit || submitting}
              >
                Sign in
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;

