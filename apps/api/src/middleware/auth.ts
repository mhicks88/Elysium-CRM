import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

interface JwtPayload {
  sub: string;
  role: string;
  organizationId: string;
  email: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  organizationId: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

// Central place to define known roles.
// IMPORTANT: These string values must match what's stored in your DB.
export const Roles = {
  ADMIN: "ADMIN",
  AGENT: "AGENT",
  VIEW_ONLY: "VIEW_ONLY",
} as const;

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return secret;
};

export const requireAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Missing or invalid token" },
    });
    return;
  }

  const token = header.slice("Bearer ".length).trim();

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as JwtPayload;

    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      organizationId: decoded.organizationId,
    };

    next();
  } catch {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Invalid token" },
    });
  }
};

export const requireRole =
  (...roles: string[]) =>
  (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "Missing auth context" },
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: { code: "FORBIDDEN", message: "Insufficient permissions" },
      });
      return;
    }

    next();
  };

