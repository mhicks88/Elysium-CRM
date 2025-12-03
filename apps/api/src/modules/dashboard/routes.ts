// apps/api/src/modules/dashboard/routes.ts
//
// Role-based dashboard endpoint.
// GET /api/dashboard
//
// Returns a JSON summary tailored to the current user's role.

import { Router, type Response, type NextFunction } from "express";
import { requireAuth, type AuthenticatedRequest } from "../../middleware/auth";
import { getDashboardForUser } from "./service";

export const dashboardRouter = Router();

dashboardRouter.get(
  "/",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const organizationId = user.organizationId;
      const userId = user.id;
      const role = user.role as any;

      const data = await getDashboardForUser({
        organizationId,
        userId,
        role,
      });

      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

