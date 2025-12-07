// apps/web/src/routes/auth/ResetPassword.tsx

import React, { useState, useMemo } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";

function useQueryParam(name: string): string | null {
  const location = useLocation();
  return useMemo(() => {
    const params = new URLSearchParams(location.search);
    const value = params.get(name);
    return value ?? null;
  }, [location.search, name]);
}

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const token = useQueryParam("token");

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const tokenMissing = !token;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Missing or invalid reset token");
      return;
    }

    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== passwordConfirm) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          newPassword: password,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Unable to reset password");
      } else {
        setSuccess(true);
        // After a short delay, send user back to login so they can sign in.
        setTimeout(() => {
          navigate("/login");
        }, 1500);
      }
    } catch (err) {
      console.error("Password reset confirm failed", err);
      setError("Unexpected error resetting password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell title="Reset password">
      <div className="max-w-md mx-auto mt-8">
        <Card>
          <h1 className="text-xl font-semibold mb-4">Reset your password</h1>

          {tokenMissing && (
            <p className="text-sm text-red-700 mb-4">
              This reset link is missing a token or has been used incorrectly.
              Please request a new password reset from the{" "}
              <Link to="/forgot-password" className="text-blue-600 underline">
                Forgot password
              </Link>{" "}
              page.
            </p>
          )}

          {!tokenMissing && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block text-sm font-medium">
                New password
                <Input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1"
                />
              </label>

              <label className="block text-sm font-medium">
                Confirm new password
                <Input
                  type="password"
                  required
                  minLength={8}
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
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
                  Password updated. Redirecting you to the login page…
                </p>
              )}

              <Button type="submit" disabled={submitting || tokenMissing}>
                {submitting ? "Updating..." : "Update password"}
              </Button>
            </form>
          )}

          <div className="mt-4 text-sm">
            <Link to="/login" className="text-blue-600 hover:underline">
              Back to login
            </Link>
          </div>
        </Card>
      </div>
    </AppShell>
  );
};

export default ResetPasswordPage;

