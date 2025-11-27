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
