import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { login as apiLogin, setAccessToken } from "../../lib/apiClient";

interface LoginFormState {
  email: string;
  password: string;
}

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth() as {
    setUser: (user: any | null) => void;
  };

  const [form, setForm] = useState<LoginFormState>({
    email: "admin@example.com",
    password: "Password123!",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const data = await apiLogin({
        email: form.email,
        password: form.password,
      });

      // data should be { accessToken, user }
      setAccessToken(data.accessToken);
      setUser(data.user);

      // If we were redirected here from a protected route, go back there,
      // otherwise default to /leads
      const state = location.state as any;
      const redirectTo = state?.from?.pathname || "/leads";

      navigate(redirectTo, { replace: true });
    } catch (err: any) {
      const msg =
        err instanceof Error ? err.message : "Login failed. Please try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f3f4f6",
      }}
    >
      <div
        style={{
          maxWidth: 400,
          width: "100%",
          padding: "2rem",
          borderRadius: 8,
          background: "#ffffff",
          boxShadow: "0 10px 30px rgba(15,23,42,0.12)",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
          Elysium CRM Login
        </h1>

        {error && (
          <div
            style={{
              marginBottom: "0.75rem",
              padding: "0.5rem 0.75rem",
              borderRadius: 4,
              backgroundColor: "#fee2e2",
              color: "#b91c1c",
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "0.75rem" }}>
          <div>
            <label
              htmlFor="email"
              style={{ display: "block", marginBottom: 4, fontSize: 14 }}
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
              style={{
                width: "100%",
                padding: 8,
                borderRadius: 4,
                border: "1px solid #d1d5db",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              style={{ display: "block", marginBottom: 4, fontSize: 14 }}
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              autoComplete="current-password"
              style={{
                width: "100%",
                padding: 8,
                borderRadius: 4,
                border: "1px solid #d1d5db",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              marginTop: "0.5rem",
              padding: "0.6rem 1rem",
              borderRadius: 4,
              border: "none",
              backgroundColor: "#2563eb",
              color: "#ffffff",
              fontWeight: 500,
              cursor: submitting ? "default" : "pointer",
            }}
          >
            {submitting ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;

