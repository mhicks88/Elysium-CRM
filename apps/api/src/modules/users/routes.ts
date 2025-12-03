// apps/api/src/modules/users/routes.ts
//
// Users admin routes for managing org hierarchy (roles, manager/doctor mapping).
// Phase 1: infra-only JSON endpoints, ADMIN-only.
//
// - GET /api/users
//   List all users in the current org with basic profile + hierarchy fields.
// - PATCH /api/users/:id
//   Update role, managerId, directorId.

import {
  Router,
  type Response,
  type NextFunction,
} from "express";
import {
  requireAuth,
  requireRole,
  Roles,
  type AuthenticatedRequest,
} from "../../middleware/auth";
import { prisma } from "../../db/client";

export const usersRouter = Router();

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
 * PATCH /api/users/:id
 *
 * ADMIN-only for now.
 * Allows updates to:
 *  - role (limited to known values)
 *  - managerId (or null)
 *  - directorId (or null)
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
        const allowedRoles = [
          "ADMIN",
          "MANAGER",
          "DIRECTOR",
          "AGENT",
          "COMPLIANCE",
          "READ_ONLY",
        ];
        if (!allowedRoles.includes(role)) {
          res
            .status(400)
            .json({ error: `Invalid role: ${role}` });
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
