import { Navigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import type { ReactNode } from "react";

type Role = "ADMIN" | "AGENT" | "VIEW_ONLY" | "MANAGER" | "COMPLIANCE_OFFICER";

interface RequireRoleProps {
  roles: Role[];
  children: ReactNode;
}

/**
 * RequireRole
 *
 * Frontend guard to ensure only users with the specified roles
 * can see the wrapped content.
 */
export function RequireRole({ roles, children }: RequireRoleProps) {
  const { user } = useAuth() as { user: { role?: Role } | null };

  // Not logged in → bounce to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const userRole = user.role;

  // Logged in but role not allowed
  if (!userRole || !roles.includes(userRole)) {
    return (
      <div style={{ padding: "2rem" }}>
        <h1>Access denied</h1>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  // Authorized
  return <>{children}</>;
}

export default function Admin() {
  return (
    <RequireRole roles={["ADMIN"]}>
      <div style={{ padding: "2rem" }}>
        <h1>Admin</h1>
        <p>
          User management, dialer integrations, scripts, and audit logs will be
          managed here.
        </p>
      </div>
    </RequireRole>
  );
}

