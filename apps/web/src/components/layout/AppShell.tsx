// apps/web/src/components/layout/AppShell.tsx
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "../ui/Button";
import { useAuth } from "../../lib/auth";

export interface AppShellProps {
  children: React.ReactNode;
}

type Role =
  | "ADMIN"
  | "AGENT"
  | "VIEW_ONLY"
  | "MANAGER"
  | "DIRECTOR"
  | "COMPLIANCE"
  | "READ_ONLY";

/**
 * AppShell
 *
 * Main application chrome: sidebar + top bar + content area.
 * Use this to wrap any authenticated, in-app pages (leads, admin, etc.).
 */
export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const location = useLocation();
  const { user } = useAuth() as { user: any | null };
  const userRole = (user?.role ?? null) as Role | null;
  const userEmail = user?.email ?? "user@example.com";

  const isAdminLike =
    userRole === "ADMIN" ||
    userRole === "MANAGER" ||
    userRole === "DIRECTOR" ||
    userRole === "COMPLIANCE";

  const baseNav: Array<{ label: string; path: string }> = [
    { label: "Dashboard", path: "/dashboard" },
    { label: "Leads", path: "/leads" },
    { label: "Tasks", path: "/tasks" },
  ];

  const reportsNav: Array<{ label: string; path: string }> = [];

  // Expose compliance reports to COMPLIANCE, ADMIN, MANAGER, DIRECTOR
  if (
    userRole === "COMPLIANCE" ||
    userRole === "ADMIN" ||
    userRole === "MANAGER" ||
    userRole === "DIRECTOR"
  ) {
    reportsNav.push({
      label: "Reports",
      path: "/reports/compliance",
    });
  }

  const adminExtras: Array<{ label: string; path: string }> = isAdminLike
    ? [
        { label: "Coaching", path: "/calls/coaching" },
        { label: "Admin", path: "/admin" },
      ]
    : [];

  const navItems = [...baseNav, ...reportsNav, ...adminExtras];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "260px minmax(0, 1fr)",
        minHeight: "100vh",
        backgroundColor: "var(--color-bg)",
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          borderRight: "1px solid var(--color-border-subtle)",
          padding: "var(--space-6) var(--space-4)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-6)",
        }}
      >
        <Link
          to="/dashboard"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <div
            style={{
              width: "2rem",
              height: "2rem",
              borderRadius: "999px",
              background:
                "radial-gradient(circle at 30% 30%, #60a5fa, #1d4ed8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.9rem",
              fontWeight: 700,
              color: "var(--color-text-on-accent)",
              boxShadow: "var(--shadow-md)",
            }}
          >
            E
          </div>
          <div>
            <div
              style={{
                fontWeight: 600,
                fontSize: "var(--text-md)",
              }}
            >
              Elysium CRM
            </div>
            <div
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--color-text-soft)",
              }}
            >
              Compliance-first workflows
            </div>
          </div>
        </Link>

        <nav
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          {navItems.map((item) => {
            const isActive =
              location.pathname === item.path ||
              location.pathname.startsWith(item.path + "/");

            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  borderRadius: "999px",
                  padding: "0.4rem 0.8rem",
                  fontSize: "var(--text-sm)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  color: isActive
                    ? "var(--color-text)"
                    : "var(--color-text-soft)",
                  backgroundColor: isActive
                    ? "rgba(37, 99, 235, 0.16)"
                    : "transparent",
                  border: isActive
                    ? "1px solid rgba(37, 99, 235, 0.4)"
                    : "1px solid transparent",
                  textDecoration: "none",
                  transition:
                    "background-color 120ms ease-out, border-color 120ms ease-out, color 120ms ease-out",
                }}
              >
                <span>{item.label}</span>
                {isActive && (
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "999px",
                      backgroundColor: "var(--color-brand)",
                    }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div
          style={{
            marginTop: "auto",
            fontSize: "var(--text-xs)",
            color: "var(--color-text-soft)",
          }}
        >
          <div>Compliance-ready by design.</div>
          <div>Audit, enroll, and track without losing your license.</div>
        </div>
      </aside>

      {/* Main column: top bar + content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
        }}
      >
        {/* Top bar */}
        <header
          style={{
            borderBottom: "1px solid var(--color-border-subtle)",
            padding: "var(--space-4) var(--space-6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-4)",
            position: "sticky",
            top: 0,
            zIndex: 10,
            backdropFilter: "blur(16px)",
            background:
              "linear-gradient(to bottom, rgba(15,23,42,0.88), rgba(15,23,42,0.7))",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
            }}
          >
            <div
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-soft)",
              }}
            >
              Logged in
            </div>
            <div
              style={{
                fontSize: "var(--text-md)",
                fontWeight: 500,
              }}
            >
              Elysium Agent Workspace
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {/* Placeholder for future global activity view */}
            <Button variant="ghost" size="sm">
              Activity
            </Button>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.25rem 0.5rem",
                borderRadius: "999px",
                border: "1px solid var(--color-border-subtle)",
                backgroundColor: "rgba(15,23,42,0.7)",
              }}
            >
              <div
                style={{
                  width: "1.75rem",
                  height: "1.75rem",
                  borderRadius: "999px",
                  background:
                    "linear-gradient(135deg, #22c55e, #16a34a, #15803d)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "#ecfdf5",
                  textTransform: "uppercase",
                }}
              >
                {userEmail.charAt(0) || "U"}
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  lineHeight: 1.2,
                }}
              >
                <span
                  style={{
                    fontSize: "var(--text-sm)",
                    fontWeight: 500,
                  }}
                >
                  {userEmail}
                </span>
                <span
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--color-text-soft)",
                  }}
                >
                  {userRole ?? "User"}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main
          style={{
            padding: "var(--space-6)",
            flex: 1,
            minHeight: 0,
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
};

