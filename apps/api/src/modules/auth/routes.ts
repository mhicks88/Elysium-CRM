// apps/api/src/modules/auth/routes.ts

import { Router, Response, Request } from "express";
import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";

import {
  signAccessToken,
  signPasswordResetToken,
  verifyPasswordResetToken,
  createSessionForUser,
  getSession,
  rotateSession,
  revokeAllUserSessions,
  type User,
} from "./service";

const prisma = new PrismaClient();
export const authRouter = Router();

function setRefreshCookie(res: Response, refreshToken: string) {
  const isProd = process.env.NODE_ENV === "production";

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });
}

// Helper to map Prisma User + Organization into our JWT User type
function mapDbUserToUser(dbUser: any): User {
  const role =
    dbUser.role === UserRole.COMPLIANCE
      ? "COMPLIANCE_OFFICER"
      : (dbUser.role as User["role"]);

  return {
    id: dbUser.id,
    email: dbUser.email,
    role,
    organizationId: dbUser.organizationId,
  };
}

// POST /api/auth/login
authRouter.post(
  "/login",
  async (req: Request, res: Response): Promise<Response | void> => {
    try {
      const { email, password } = req.body ?? {};
      if (!email || !password) {
        return res
          .status(400)
          .json({ error: "email and password are required" });
      }

      const normalizedEmail = String(email).trim().toLowerCase();

      const dbUser = await prisma.user.findFirst({
        where: { email: normalizedEmail },
        include: { organization: true },
      });

      if (!dbUser || !dbUser.passwordHash) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const passwordOk = await bcrypt.compare(
        String(password),
        dbUser.passwordHash
      );

      if (!passwordOk) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const user = mapDbUserToUser(dbUser);

      const accessToken = signAccessToken(user);
      const refreshToken = createSessionForUser(user, req);
      setRefreshCookie(res, refreshToken);

      return res.json({
        accessToken,
        user: {
          id: dbUser.id,
          email: dbUser.email,
          role: user.role,
          organizationId: dbUser.organizationId,
          organizationName: dbUser.organization?.name ?? null,
          firstName: dbUser.firstName,
          lastName: dbUser.lastName,
        },
      });
    } catch (err) {
      console.error("Login error", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// POST /api/auth/refresh
authRouter.post(
  "/refresh",
  async (req: Request, res: Response): Promise<Response | void> => {
    try {
      const refreshToken = req.cookies?.refreshToken;
      if (!refreshToken) {
        return res.status(401).json({ error: "No refresh token" });
      }

      const session = getSession(refreshToken);
      if (!session) {
        return res.status(401).json({ error: "Invalid session" });
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: session.userId },
        include: { organization: true },
      });

      if (!dbUser) {
        return res.status(401).json({ error: "User not found" });
      }

      const user = mapDbUserToUser(dbUser);
      const accessToken = signAccessToken(user);

      // Rotate refresh token for better security
      const newRefreshToken = rotateSession(refreshToken);
      setRefreshCookie(res, newRefreshToken);

      return res.json({ accessToken });
    } catch (err) {
      console.error("Refresh error", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// POST /api/auth/signup-org
//
// Create a new organization and its initial ADMIN user, then log them in.
authRouter.post(
  "/signup-org",
  async (req: Request, res: Response): Promise<Response | void> => {
    try {
      const {
        organizationName,
        firstName,
        lastName,
        email,
        password,
      } = req.body ?? {};

      if (!organizationName || !firstName || !lastName || !email || !password) {
        return res.status(400).json({
          error:
            "organizationName, firstName, lastName, email, and password are required",
        });
      }

      const trimmedOrgName = String(organizationName).trim();
      if (!trimmedOrgName) {
        return res
          .status(400)
          .json({ error: "Organization name cannot be empty" });
      }

      const normalizedEmail = String(email).trim().toLowerCase();

      const existingUser = await prisma.user.findFirst({
        where: { email: normalizedEmail },
      });

      if (existingUser) {
        return res
          .status(409)
          .json({ error: "A user with that email already exists" });
      }

      const passwordHash = await bcrypt.hash(String(password), 10);

      const organization = await prisma.organization.create({
        data: {
          name: trimmedOrgName,
          settings: {}, // start with empty JSON settings; can be customized later
        },
      });

      const adminUser = await prisma.user.create({
        data: {
          email: normalizedEmail,
          firstName: String(firstName).trim(),
          lastName: String(lastName).trim(),
          role: UserRole.ADMIN,
          passwordHash,
          organizationId: organization.id,
        },
        include: {
          organization: true,
        },
      });

      const user: User = {
        id: adminUser.id,
        email: adminUser.email,
        role: "ADMIN",
        organizationId: organization.id,
      };

      const accessToken = signAccessToken(user);
      const refreshToken = createSessionForUser(user, req);
      setRefreshCookie(res, refreshToken);

      return res.status(201).json({
        accessToken,
        user: {
          id: adminUser.id,
          email: adminUser.email,
          role: user.role,
          organizationId: organization.id,
          organizationName: organization.name,
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
        },
      });
    } catch (err) {
      console.error("Signup-org error", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// POST /api/auth/password-reset/request
authRouter.post(
  "/password-reset/request",
  async (req: Request, res: Response): Promise<Response | void> => {
    try {
      const { email } = req.body ?? {};
      if (!email) {
        return res.status(400).json({ error: "email is required" });
      }

      const normalizedEmail = String(email).trim().toLowerCase();

      const dbUser = await prisma.user.findFirst({
        where: { email: normalizedEmail },
        include: { organization: true },
      });

      if (!dbUser) {
        // Do not reveal whether the email exists
        return res.json({ ok: true });
      }

      const user = mapDbUserToUser(dbUser);
      const token = signPasswordResetToken(user);

      // TODO: integrate real email service. For now, in non-production,
      // return the token so dev can copy-paste the link.
      const isProd = process.env.NODE_ENV === "production";

      if (!isProd) {
        return res.json({
          ok: true,
          resetToken: token,
        });
      }

      // In production you'd send an email here.
      return res.json({ ok: true });
    } catch (err) {
      console.error("Password reset request error", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// POST /api/auth/password-reset/confirm
authRouter.post(
  "/password-reset/confirm",
  async (req: Request, res: Response): Promise<Response | void> => {
    try {
      const { token, newPassword } = req.body ?? {};
      if (!token || !newPassword) {
        return res
          .status(400)
          .json({ error: "token and newPassword are required" });
      }

      const decoded = verifyPasswordResetToken(String(token));
      if (!decoded) {
        return res.status(400).json({ error: "Invalid or expired token" });
      }

      const userId = decoded.sub;

      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!dbUser) {
        return res.status(400).json({ error: "Invalid token" });
      }

      const passwordHash = await bcrypt.hash(String(newPassword), 10);

      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      });

      // Invalidate existing sessions for this user
      revokeAllUserSessions(userId);

      return res.status(204).send();
    } catch (err) {
      console.error("Password reset confirm error", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// GET /api/auth/me
//
// Return the current authenticated user based on the refreshToken cookie.
// Used by the web app to restore auth state on reload.
authRouter.get(
  "/me",
  async (req: Request, res: Response): Promise<Response | void> => {
    try {
      const refreshToken = req.cookies?.refreshToken;
      if (!refreshToken) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const session = getSession(refreshToken);
      if (!session) {
        return res.status(401).json({ error: "Invalid session" });
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: session.userId },
        include: { organization: true },
      });

      if (!dbUser) {
        return res.status(401).json({ error: "User not found" });
      }

      const user = mapDbUserToUser(dbUser);

      return res.json({
        id: dbUser.id,
        email: dbUser.email,
        role: user.role,
        organizationId: dbUser.organizationId,
        organizationName: dbUser.organization?.name ?? null,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
      });
    } catch (err) {
      console.error("Auth me error", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// POST /api/auth/logout
authRouter.post("/logout", (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;
  if (refreshToken) {
    try {
      const session = getSession(refreshToken);
      if (session) {
        revokeAllUserSessions(session.userId);
      }
    } catch {
      // ignore errors during logout
    }
  }

  res.clearCookie("refreshToken", {
    path: "/api/auth",
  });

  return res.status(204).send();
});

