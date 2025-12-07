// apps/api/src/modules/auth/service.ts

import jwt from "jsonwebtoken";
import { Request } from "express";
import {
  createSessionToken,
  rotateSessionToken,
  findSessionToken,
  revokeAllSessionsForUser,
} from "./sessionStore";

const ACCESS_TOKEN_TTL = "1h"; // adjust if needed
const PASSWORD_RESET_TTL = "1h";
const JWT_SECRET = process.env.JWT_SECRET || "CHANGE_ME_IN_PROD";

export type User = {
  id: string;
  email: string;
  // This is the role shape we expose to the frontend / JWT.
  // It intentionally uses VIEW_ONLY / COMPLIANCE_OFFICER to match existing UI code.
  role:
    | "ADMIN"
    | "AGENT"
    | "VIEW_ONLY"
    | "MANAGER"
    | "COMPLIANCE_OFFICER"
    | "DIRECTOR";
  organizationId: string;
};

export type AccessTokenPayload = {
  sub: string;
  email: string;
  role: User["role"];
  organizationId: string;
};

type PasswordResetTokenPayload = {
  sub: string;
  purpose: "password_reset";
};

export function signAccessToken(user: User): string {
  const payload: AccessTokenPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, JWT_SECRET) as AccessTokenPayload;
}

/**
 * Create a refresh session for the user and return the *string* token.
 * sessionStore.createSessionToken() returns a record; we normalize to string here.
 */
export function createSessionForUser(user: User, req: Request): string {
  const userAgent = req.header("user-agent") ?? null;
  const ipAddress =
    (req.headers["x-forwarded-for"] as string) || req.ip || null;

  const sessionRecord = createSessionToken(user.id, userAgent, ipAddress) as
    | { token: string }
    | string;

  // Support both shapes defensively
  if (typeof sessionRecord === "string") {
    return sessionRecord;
  }

  return sessionRecord.token;
}

/**
 * Rotate a refresh token and return the *string* token to send back to the client.
 * If rotation fails (null), we conservatively fall back to the original token so
 * the caller isn't forced to handle null.
 */
export function rotateSession(refreshToken: string): string {
  const rotated = rotateSessionToken(refreshToken) as
    | { token: string }
    | string
    | null;

  if (!rotated) {
    // Fallback: keep using the existing token
    return refreshToken;
  }

  if (typeof rotated === "string") {
    return rotated;
  }

  return rotated.token;
}

/**
 * Get the underlying session record (used by routes to look up userId etc).
 */
export function getSession(refreshToken: string) {
  return findSessionToken(refreshToken);
}

/**
 * Revoke all sessions for a given user (used on password reset & logout).
 */
export function revokeAllUserSessions(userId: string) {
  revokeAllSessionsForUser(userId);
}

export function signPasswordResetToken(user: User): string {
  const payload: PasswordResetTokenPayload = {
    sub: user.id,
    purpose: "password_reset",
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: PASSWORD_RESET_TTL,
  });
}

export function verifyPasswordResetToken(
  token: string
): PasswordResetTokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as PasswordResetTokenPayload;
    if (decoded.purpose !== "password_reset") {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

