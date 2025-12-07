// apps/api/src/modules/users/routes.ts
//
// Users admin routes for managing org hierarchy (roles, manager/doctor mapping).
// Phase 1: infra-only JSON endpoints, ADMIN-only.
//
// - GET /api/users
//   List all users in the current org with basic profile + hierarchy fields.
// - POST /api/users
//   Create a new user in the current org (ADMIN-only).
// - PATCH /api/users/:id
//   Update role, managerId, directorId, isActive.

import {
  Router,
  type Response,
  type NextFunction,
} from "express";
import bcrypt from "bcryptjs";
import {
  requireAuth,
  requireRole,
  Roles,
  type AuthenticatedRequest,
} from "../../middleware/auth";
import { prisma } from "../../db/client";

export const usersRouter = Router();

const ALLOWED_ROLES = [
  "ADMIN",
  "MANAGER",
  "DIRECTOR",
  "AGENT",
  "COMPLIANCE",
  "READ_ONLY",
] as const;

type AllowedRole = (typeof ALLOWED_ROLES)[number];

/**
 * GET /api/users
 *
 * ADMIN-only for now.
 * Returns all users in the current org with:
 *  - id, firstName, lastName, email, role, isActive
 *  - managerId, directorId
 */
usersRouter.get(
  "/",
  requireAuth,
  requireRole(Roles.ADMIN),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const orgId = user.organizationId;

      const users = await prisma.user.findMany({
        where: {
          organizationId: orgId,
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          isActive: true,
          managerId: true,
          directorId: true,
        },
      });

      res.json({ users });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/users
 *
 * ADMIN-only.
 * Creates a new user in the current org.
 *
 * Body:
 *  - email (required)
 *  - firstName (required)
 *  - lastName (required)
 *  - role (required; one of ALLOWED_ROLES)
 *  - initialPassword (required; plain text, will be hashed)
 *  - managerId (optional)
 *  - directorId (optional)
 */
usersRouter.post(
  "/",
  requireAuth,
  requireRole(Roles.ADMIN),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const admin = req.user!;
      const orgId = admin.organizationId;

      const {
        email,
        firstName,
        lastName,
        role,
        initialPassword,
        managerId,
        directorId,
      } = req.body ?? {};

      if (!email || !firstName || !lastName || !role || !initialPassword) {
        res.status(400).json({
          error:
            "email, firstName, lastName, role, and initialPassword are required",
        });
        return;
      }

      const normalizedEmail = String(email).trim().toLowerCase();

      if (!ALLOWED_ROLES.includes(role as AllowedRole)) {
        res.status(400).json({ error: `Invalid role: ${role}` });
        return;
      }

      const existing = await prisma.user.findFirst({
        where: {
          email: normalizedEmail,
          organizationId: orgId,
        },
      });

      if (existing) {
        res
          .status(409)
          .json({ error: "A user with that email already exists in this org" });
        return;
      }

      const passwordHash = await bcrypt.hash(String(initialPassword), 10);

      const newUser = await prisma.user.create({
        data: {
          email: normalizedEmail,
          firstName: String(firstName).trim(),
          lastName: String(lastName).trim(),
          role: role as AllowedRole,
          passwordHash,
          organizationId: orgId,
          managerId:
            managerId && String(managerId).trim().length > 0
              ? String(managerId).trim()
              : null,
          directorId:
            directorId && String(directorId).trim().length > 0
              ? String(directorId).trim()
              : null,
          isActive: true,
        },
      });

      res.status(201).json({
        id: newUser.id,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        role: newUser.role,
        isActive: newUser.isActive,
        managerId: newUser.managerId,
        directorId: newUser.directorId,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/users/:id
 *
 * ADMIN-only for now.
 * Allows updates to:
 *  - role (limited to known values)
 *  - managerId (or null)
 *  - directorId (or null)
 *  - isActive
 */
usersRouter.patch(
  "/:id",
  requireAuth,
  requireRole(Roles.ADMIN),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const admin = req.user!;
      const orgId = admin.organizationId;
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ error: "id is required" });
        return;
      }

      const existing = await prisma.user.findFirst({
        where: {
          id,
          organizationId: orgId,
        },
      });

      if (!existing) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const { role, managerId, directorId, isActive } = req.body ?? {};

      const data: any = {};

      // Role change (optional)
      if (typeof role === "string") {
        if (!ALLOWED_ROLES.includes(role as AllowedRole)) {
          res.status(400).json({ error: `Invalid role: ${role}` });
          return;
        }
        data.role = role;
      }

      // managerId: string or null
      if (managerId !== undefined) {
        data.managerId =
          managerId && String(managerId).trim().length > 0
            ? String(managerId).trim()
            : null;
      }

      // directorId: string or null
      if (directorId !== undefined) {
        data.directorId =
          directorId && String(directorId).trim().length > 0
            ? String(directorId).trim()
            : null;
      }

      // isActive: optional boolean
      if (typeof isActive === "boolean") {
        data.isActive = isActive;
      }

      // If nothing to change, return existing
      if (Object.keys(data).length === 0) {
        res.json({
          id: existing.id,
          firstName: existing.firstName,
          lastName: existing.lastName,
          email: existing.email,
          role: existing.role,
          isActive: existing.isActive,
          managerId: existing.managerId,
          directorId: existing.directorId,
        });
        return;
      }

      const updated = await prisma.user.update({
        where: { id: existing.id },
        data,
      });

      res.json({
        id: updated.id,
        firstName: updated.firstName,
        lastName: updated.lastName,
        email: updated.email,
        role: updated.role,
        isActive: updated.isActive,
        managerId: updated.managerId,
        directorId: updated.directorId,
      });
    } catch (err) {
      next(err);
    }
  }
);

