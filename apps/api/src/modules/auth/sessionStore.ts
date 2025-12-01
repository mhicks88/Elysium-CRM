// Simple in-memory session store for development.
// Replace with real DB-backed implementation (session_tokens table) in production.

import crypto from "crypto";

export type SessionTokenRecord = {
  token: string;
  userId: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
  expiresAt: Date;
};

const SESSIONS = new Map<string, SessionTokenRecord>();

const REFRESH_TTL_DAYS = 14; // adjust if you want 7 / 30 etc.

function computeExpiry(): Date {
  const expires = new Date();
  expires.setDate(expires.getDate() + REFRESH_TTL_DAYS);
  return expires;
}

export function createSessionToken(
  userId: string,
  userAgent: string | null,
  ipAddress: string | null
): SessionTokenRecord {
  const token = crypto.randomBytes(48).toString("hex");
  const record: SessionTokenRecord = {
    token,
    userId,
    userAgent,
    ipAddress,
    createdAt: new Date(),
    expiresAt: computeExpiry(),
  };
  SESSIONS.set(token, record);
  return record;
}

export function findSessionToken(token: string): SessionTokenRecord | null {
  const record = SESSIONS.get(token);
  if (!record) return null;
  if (record.expiresAt < new Date()) {
    SESSIONS.delete(token);
    return null;
  }
  return record;
}

export function rotateSessionToken(
  oldToken: string
): SessionTokenRecord | null {
  const existing = findSessionToken(oldToken);
  if (!existing) return null;

  // Remove old session token
  SESSIONS.delete(oldToken);

  // Create new one with same user/device context
  return createSessionToken(
    existing.userId,
    existing.userAgent,
    existing.ipAddress
  );
}

export function revokeSessionToken(token: string): void {
  SESSIONS.delete(token);
}

export function revokeAllSessionsForUser(userId: string): void {
  for (const [token, record] of SESSIONS.entries()) {
    if (record.userId === userId) {
      SESSIONS.delete(token);
    }
  }
}

