// apps/web/src/lib/auth.tsx

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
} from "react";
import { setAccessToken } from "./apiClient";

type Role =
  | "ADMIN"
  | "AGENT"
  | "VIEW_ONLY"
  | "MANAGER"
  | "COMPLIANCE_OFFICER";

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
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(
  undefined
);

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
        window.localStorage.setItem(
          "elysium_auth_user",
          JSON.stringify(user)
        );
      } else {
        window.localStorage.removeItem("elysium_auth_user");
      }
    } catch {
      // ignore
    }
  }, [user]);

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore network errors on logout
    } finally {
      // Clear client-side auth state regardless
      setAccessToken(null);
      setUser(null);
      try {
        window.localStorage.removeItem("elysium_auth_user");
      } catch {
        // ignore
      }
    }
  };

  const value: AuthContextValue = {
    user,
    setUser,
    isAuthenticated: !!user,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

