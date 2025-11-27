import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { LoginResponseDto } from '../../../../packages/shared-types/src/dto/auth';

export interface StoredSession {
  token: string;
  user: LoginResponseDto['user'];
}

const STORAGE_KEY = 'elysium_crm_auth';

interface AuthContextValue {
  user: LoginResponseDto['user'] | null;
  token: string | null;
  login: (session: LoginResponseDto) => void;
  logout: () => void;
  getToken: () => string | null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function getStoredSession(): StoredSession | null {
  const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<StoredSession | null>(() => getStoredSession());

  useEffect(() => {
    if (session) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [session]);

  const value = useMemo<AuthContextValue>(() => ({
    user: session?.user ?? null,
    token: session?.token ?? null,
    login: (payload: LoginResponseDto) => {
      setSession({ token: payload.token, user: payload.user });
    },
    logout: () => setSession(null),
    getToken: () => session?.token ?? null
  }), [session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

export function readStoredToken(): string | null {
  return getStoredSession()?.token ?? null;
import { useState } from 'react';

export type UserSession = {
  token: string;
  email: string;
  role: string;
  organizationId: string;
};

const storageKey = 'elysium_crm_token';

export function useAuth() {
  const stored = localStorage.getItem(storageKey);
  const [user, setUser] = useState<UserSession | null>(stored ? JSON.parse(stored) : null);

  const login = (session: UserSession) => {
    localStorage.setItem(storageKey, JSON.stringify(session));
    setUser(session);
  };

  const logout = () => {
    localStorage.removeItem(storageKey);
    setUser(null);
  };

  return { user, login, logout };
}
