// apps/api/src/modules/leadImport/routes.ts
//
// Routes for lead import / ingestion.
// Phase 1: JSON-based endpoints for manual and API-based ingest.
// Later we can add multipart/form-data upload for CSV/XLSX and call
// the same service with parsed rows.

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
import {
  importLeadsForOrganization,
  type RawImportedLeadRow,
  type ImportSourceType,
} from "./service";
import { prisma } from "../../db/client";

export const leadImportRouter = Router();

/**
 * POST /api/lead-import/manual
 *
 * Manual import of leads by ADMIN or MANAGER.
 * Body:
 *   {
 *     "rows": RawImportedLeadRow[],
 *     "label"?: string
 *   }
 *
 * RawImportedLeadRow = {
 *   name: string;
 *   phone: string;
 *   source: string;
 *   email?: string | null;
 *   state?: string | null;
 * }
 */
leadImportRouter.post(
  "/manual",
  requireAuth,
  requireRole(Roles.ADMIN, Roles.MANAGER),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const organizationId = user.organizationId;
      const userId = user.id;

      const { rows, label } = req.body ?? {};

      if (!Array.isArray(rows)) {
        res.status(400).json({ error: "rows array is required" });
        return;
      }

      const typedRows: RawImportedLeadRow[] = rows.map((r: any) => ({
        name: String(r.name ?? "").trim(),
        phone: String(r.phone ?? "").trim(),
        source: String(r.source ?? "").trim(),
        email: r.email ?? null,
        state: r.state ?? null,
      }));

      const summary = await importLeadsForOrganization({
        organizationId,
        userId,
        rows: typedRows,
        importSource: "MANUAL_UPLOAD",
        importLabel: label,
      });

      res.status(201).json({
        success: true,
        ...summary,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/lead-import/ingest
 *
 * API-based ingestion endpoint for external lead-gen systems or
 * internal automated flows.
 *
 * Body:
 *   {
 *     "rows": RawImportedLeadRow[],
 *     "sourceLabel"?: string
 *   }
 *
 * Requires ADMIN or MANAGER (for now). In the future, this could
 * also support API key-based auth for partners.
 */
leadImportRouter.post(
  "/ingest",
  requireAuth,
  requireRole(Roles.ADMIN, Roles.MANAGER),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const organizationId = user.organizationId;
      const userId = user.id;

      const { rows, sourceLabel } = req.body ?? {};

      if (!Array.isArray(rows)) {
        res.status(400).json({ error: "rows array is required" });
        return;
      }

      const typedRows: RawImportedLeadRow[] = rows.map((r: any) => ({
        name: String(r.name ?? "").trim(),
        phone: String(r.phone ?? "").trim(),
        source: String(r.source ?? "").trim(),
        email: r.email ?? null,
        state: r.state ?? null,
      }));

      const summary = await importLeadsForOrganization({
        organizationId,
        userId,
        rows: typedRows,
        importSource: "API_INGEST",
        importLabel: sourceLabel,
      });

      res.status(201).json({
        success: true,
        ...summary,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/lead-import/recent
 *
 * List recent lead import jobs for the current org.
 * Mirrors the shape of /api/leads/import/jobs so the admin/import UIs
 * can share the same LeadImportJobSummary type.
 */
leadImportRouter.get(
  "/recent",
  requireAuth,
  requireRole(Roles.ADMIN, Roles.MANAGER),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      if (!user.organizationId) {
        return res.status(400).json({ error: "User has no organization" });
      }

      const limitParam = req.query.limit as string | undefined;
      const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 10, 50) : 10;

      const jobs = await prisma.leadImportJob.findMany({
        where: { organizationId: user.organizationId },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          createdByUser: true,
        },
      });

      const jobDtos = jobs.map((job) => ({
        id: job.id,
        filename: job.filename,
        source: job.source,
        totalRows: job.totalRows,
        createdCount: job.createdCount,
        duplicateCount: job.duplicateCount,
        failedCount: job.failedCount,
        status: job.status,
        createdAt: job.createdAt.toISOString(),
        startedAt: job.startedAt ? job.startedAt.toISOString() : null,
        finishedAt: job.finishedAt ? job.finishedAt.toISOString() : null,
        createdBy: job.createdByUser
          ? {
              id: job.createdByUser.id,
              email: job.createdByUser.email,
              name:
                [job.createdByUser.firstName, job.createdByUser.lastName]
                  .filter(Boolean)
                  .join(" ") || job.createdByUser.email,
            }
          : null,
      }));

      res.json({ jobs: jobDtos });
    } catch (err) {
      next(err);
    }
  }
);

