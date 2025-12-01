import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../modules/auth/service";

export enum Roles {
  ADMIN = "ADMIN",
  AGENT = "AGENT",
  VIEW_ONLY = "VIEW_ONLY",
  MANAGER = "MANAGER",
  COMPLIANCE_OFFICER = "COMPLIANCE_OFFICER",
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Roles;
  // Multi-tenant – routes expect this to exist
  organizationId: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

// Basic auth guard – validates access token and attaches user to req
export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.substring("Bearer ".length);

  try {
    const payload: any = verifyAccessToken(token);

    req.user = {
      id: payload.sub ?? payload.id,
      email: payload.email,
      role: payload.role,
      organizationId: payload.organizationId,
    };

    return next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

// Role-based access control middleware
export function requireRole(...allowedRoles: Roles[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    return next();
  };
}

