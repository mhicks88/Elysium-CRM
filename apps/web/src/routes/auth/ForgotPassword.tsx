// apps/web/src/routes/auth/ForgotPassword.tsx

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devResetToken, setDevResetToken] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSuccess(false);
    setError(null);
    setDevResetToken(null);

    try {
      const res = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        // The backend returns { ok: true } even for unknown emails,
        // so non-2xx here is a real error.
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Unable to process password reset request");
      } else {
        const data = await res.json().catch(() => ({}));
        setSuccess(true);

        // In non-production, the API returns { ok: true, resetToken }
        if (data.resetToken) {
          setDevResetToken(data.resetToken as string);
        }
      }
    } catch (err) {
      console.error("Password reset request failed", err);
      setError("Unexpected error requesting password reset");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell title="Forgot password">
      <div className="max-w-md mx-auto mt-8">
        <Card>
          <h1 className="text-xl font-semibold mb-4">Forgot your password?</h1>
          <p className="text-sm text-gray-600 mb-4">
            Enter the email address associated with your account. If we find a
            matching user, we&apos;ll send a password reset link.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block text-sm font-medium">
              Email
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1"
              />
            </label>

            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            {success && (
              <p className="text-sm text-green-700">
                If an account exists for that email, a reset link has been
                sent.
              </p>
            )}

            <Button type="submit" disabled={submitting || !email}>
              {submitting ? "Sending..." : "Send reset link"}
            </Button>
          </form>

          <div className="mt-4 text-sm">
            <Link to="/login" className="text-blue-600 hover:underline">
              Back to login
            </Link>
          </div>

          {devResetToken && (
            <div className="mt-6 border-t pt-4 text-xs text-gray-700">
              <p className="font-semibold mb-1">Dev-only reset token</p>
              <p className="break-all select-all">{devResetToken}</p>
              <p className="mt-1">
                In development, paste this token into the{" "}
                <code>/reset-password</code> page query string as{" "}
                <code>?token=...</code>.
              </p>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
};

export default ForgotPasswordPage;

