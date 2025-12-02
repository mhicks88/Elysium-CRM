import React, { createContext, useContext, useState, useEffect } from "react";

type Role = "ADMIN" | "AGENT" | "VIEW_ONLY" | "MANAGER" | "COMPLIANCE_OFFICER";

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  organizationId?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<AuthUser | null>(null);

  // Optional: restore from localStorage
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("elysium_auth_user");
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      if (user) {
        window.localStorage.setItem("elysium_auth_user", JSON.stringify(user));
      } else {
        window.localStorage.removeItem("elysium_auth_user");
      }
    } catch {
      // ignore
    }
  }, [user]);

  const value: AuthContextValue = {
    user,
    setUser,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

