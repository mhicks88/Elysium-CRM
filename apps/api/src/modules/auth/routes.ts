import { Router, Response, Request } from "express";
import {
  signAccessToken,
  createSessionForUser,
  getSession,
  rotateSession,
  type User,
} from "./service";

export const authRouter = Router();

// In-memory dev users.
// TODO: replace with real DB lookup.
type UserWithPassword = User & { password: string };

const DEV_USERS: UserWithPassword[] = [
  {
    id: "admin-1",
    email: "admin@example.com",
    role: "ADMIN",
    organizationId: "org-1",
    password: "Password123!",
  },
];

// Utility: set refresh cookie
function setRefreshCookie(res: Response, token: string) {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/auth", // only sent to auth endpoints
  });
}

async function authenticateUser(
  email: string,
  password: string
): Promise<User | null> {
  const found = DEV_USERS.find(
    (u) => u.email === email && u.password === password
  );
  if (!found) return null;

  // Strip password before returning
  const { password: _pw, ...user } = found;
  return user;
}

function findUserById(userId: string): User | null {
  const found = DEV_USERS.find((u) => u.id === userId);
  if (!found) return null;
  const { password: _pw, ...user } = found;
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

  const user = findUserById(newSession.userId);
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

