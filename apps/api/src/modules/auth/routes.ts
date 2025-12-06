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

// POST /api/auth/signup-org
//
// Create a new organization and its initial ADMIN user, then log them in.
// Body:
// {
//   organizationName: string;
//   firstName: string;
//   lastName: string;
//   email: string;
//   password: string;
// }
authRouter.post(
  "/signup-org",
  async (req: Request, res: Response) => {
    const {
      organizationName,
      firstName,
      lastName,
      email,
      password,
    } = req.body ?? {};

    if (
      !organizationName ||
      !firstName ||
      !lastName ||
      !email ||
      !password
    ) {
      return res.status(400).json({
        error:
          "organizationName, firstName, lastName, email, and password are required",
      });
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const trimmedOrgName = String(organizationName).trim();
    const trimmedFirstName = String(firstName).trim();
    const trimmedLastName = String(lastName).trim();

    if (!trimmedOrgName) {
      return res.status(400).json({ error: "organizationName is required" });
    }

    if (!trimmedFirstName || !trimmedLastName) {
      return res
        .status(400)
        .json({ error: "firstName and lastName are required" });
    }

    // Basic sanity check on password length (you can tighten this later)
    if (String(password).length < 8) {
      return res.status(400).json({
        error: "password must be at least 8 characters long",
      });
    }

    // Ensure email is not already used
    const existingUser = await prisma.user.findUnique({
      where: { email: trimmedEmail },
    });

    if (existingUser) {
      return res
        .status(409)
        .json({ error: "A user with that email already exists" });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);

    // Create org + admin user in a single transaction
    const [organization, adminUser] = await prisma.$transaction([
      prisma.organization.create({
        data: {
          name: trimmedOrgName,
          settings: {}, // start with empty JSON settings; can be customized later
        },
      }),
      // We'll create the user after we know org id, but inside the same tx
    ]).then(async ([org]) => {
      const user = await prisma.user.create({
        data: {
          organizationId: org.id,
          firstName: trimmedFirstName,
          lastName: trimmedLastName,
          email: trimmedEmail,
          passwordHash,
          role: UserRole.ADMIN,
          isActive: true,
        },
      });

      return [org, user] as const;
    });

    const authRole = mapDbRoleToAuthRole(adminUser.role);

    const user: User = {
      id: adminUser.id,
      email: adminUser.email,
      role: authRole,
      organizationId: organization.id,
    };

    const accessToken = signAccessToken(user);
    const session = createSessionForUser(user, req);

    setRefreshCookie(res, session.token);

    return res.status(201).json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
      },
    });
  }
);

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

