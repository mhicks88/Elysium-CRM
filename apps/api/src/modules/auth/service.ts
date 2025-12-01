import jwt from "jsonwebtoken";
import { Request } from "express";
import {
  createSessionToken,
  rotateSessionToken,
  findSessionToken,
  revokeAllSessionsForUser,
} from "./sessionStore";

const ACCESS_TOKEN_TTL = "1h"; // adjust if needed
const JWT_SECRET = process.env.JWT_SECRET || "CHANGE_ME_IN_PROD";

export type User = {
  id: string;
  email: string;
  role: "ADMIN" | "AGENT" | "VIEW_ONLY" | "MANAGER" | "COMPLIANCE_OFFICER";
  organizationId: string;
};

export type AccessTokenPayload = {
  sub: string;
  email: string;
  role: User["role"];
  organizationId: string;
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

export function createSessionForUser(user: User, req: Request) {
  const userAgent = req.header("user-agent") ?? null;
  const ipAddress = (req.headers["x-forwarded-for"] as string) || req.ip || null;

  return createSessionToken(user.id, userAgent, ipAddress);
}

export function rotateSession(refreshToken: string) {
  return rotateSessionToken(refreshToken);
}

export function getSession(refreshToken: string) {
  return findSessionToken(refreshToken);
}

export function revokeAllUserSessions(userId: string) {
  revokeAllSessionsForUser(userId);
}

