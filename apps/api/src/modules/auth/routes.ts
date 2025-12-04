import { Router, Response, Request } from "express";
import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";

import {
  signAccessToken,
  createSessionForUser,
  getSession,
  rotateSession,
  type User,
} from "./service";

const prisma = new PrismaClient();
export const authRouter = Router();

// Utility: set refresh cookie
function setRefreshCookie(res: Response, token: string) {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/auth", // only sent to auth endpoints
  });
}

// Map DB enum roles → auth/frontend roles
function mapDbRoleToAuthRole(dbRole: UserRole): User["role"] {
  switch (dbRole) {
    case UserRole.COMPLIANCE:
      return "COMPLIANCE_OFFICER";
    case UserRole.READ_ONLY:
      return "VIEW_ONLY";
    default:
      // ADMIN, MANAGER, DIRECTOR, AGENT map 1:1
      return dbRole as User["role"];
  }
}

async function authenticateUser(
  email: string,
  password: string
): Promise<User | null> {
  const dbUser = await prisma.user.findUnique({
    where: { email },
  });

  if (!dbUser || !dbUser.isActive) {
    return null;
  }

  const passwordOk = await bcrypt.compare(password, dbUser.passwordHash);
  if (!passwordOk) {
    return null;
  }

  const role = mapDbRoleToAuthRole(dbUser.role);

  const user: User = {
    id: dbUser.id,
    email: dbUser.email,
    role,
    organizationId: dbUser.organizationId,
  };

  return user;
}

async function findUserById(userId: string): Promise<User | null> {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!dbUser || !dbUser.isActive) {
    return null;
  }

  const role = mapDbRoleToAuthRole(dbUser.role);

  const user: User = {
    id: dbUser.id,
    email: dbUser.email,
    role,
    organizationId: dbUser.organizationId,
  };

  return user;
}

// POST /api/auth/login
authRouter.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const user = await authenticateUser(email, password);
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const accessToken = signAccessToken(user);
  const session = createSessionForUser(user, req);

  setRefreshCookie(res, session.token);

  return res.json({
    accessToken,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    },
  });
});

// POST /api/auth/refresh
authRouter.post("/refresh", async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ error: "No refresh token" });
  }

  const session = getSession(refreshToken);
  if (!session) {
    return res.status(401).json({ error: "Invalid refresh token" });
  }

  // Rotate session token
  const newSession = rotateSession(refreshToken);
  if (!newSession) {
    return res.status(401).json({ error: "Unable to rotate session" });
  }

  const user = await findUserById(newSession.userId);
  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }

  const accessToken = signAccessToken(user);
  setRefreshCookie(res, newSession.token);

  return res.json({
    accessToken,
  });
});

// POST /api/auth/logout
authRouter.post("/logout", (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;
  // If you want, you can revoke the specific session here using refreshToken.

  res.clearCookie("refreshToken", {
    path: "/api/auth",
  });

  return res.status(204).send();
});

