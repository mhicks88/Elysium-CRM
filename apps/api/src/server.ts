// apps/api/src/server.ts
import http from "http";
import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

// Routers
import { authRouter } from "./modules/auth/routes";
import * as leadsModule from "./modules/leads/routes";
import { complianceRouter } from "./modules/compliance/routes";
import { complianceHistoryRouter } from "./modules/complianceHistory/routes";
import { complianceAdminRouter } from "./modules/complianceAdmin/routes";
import { auditRouter } from "./modules/audit/routes";
import { enrollmentRouter } from "./modules/enrollment/routes";
import { tasksRouter } from "./modules/tasks/routes";
import { callScriptsRouter } from "./modules/callScripts/routes";
import { leadImportRouter } from "./modules/leadImport/routes";
import { dashboardRouter } from "./modules/dashboard/routes";
import { usersRouter } from "./modules/users/routes";

// Make the leads router import robust regardless of how the module exports it.
const leadsRouter =
  (leadsModule as any).leadsRouter ||
  (leadsModule as any).default ||
  leadsModule;

/**
 * Build and configure the Express app instance.
 */
export function createApp(): Application {
  const app = express();

  // Basic middleware
  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(cookieParser());

  // Health check
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  // Core API routes
  app.use("/api/auth", authRouter);
  app.use("/api/leads", leadsRouter);

  // Compliance main routes
  app.use("/api/compliance", complianceRouter);
  app.use(complianceRouter); // backward compatibility for any older routes using /api/compliance internally

  // Compliance history routes
  app.use("/api/compliance/history", complianceHistoryRouter);

  // Compliance admin analytics routes
  app.use("/api/compliance/admin", complianceAdminRouter);

  // Audit routes
  app.use("/api/audit", auditRouter);

  // Enrollment & Tasks
  app.use("/api/enrollment", enrollmentRouter);
  app.use("/api/tasks", tasksRouter);

  // Interactive Call Scripts
  app.use("/api/call-scripts", callScriptsRouter);

  // Lead Import (manual + API ingest)
  app.use("/api/lead-import", leadImportRouter);

  // Role-based Home Dashboard
  app.use("/api/dashboard", dashboardRouter);

  // Users admin (org hierarchy management)
  app.use("/api/users", usersRouter);

  // 404 handler for unknown API routes
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api/")) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    next();
  });

  // Generic error handler
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use(
    (err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error("API error:", err);
      const status = err?.status ?? 500;
      const message = err?.message ?? "Internal server error";
      res.status(status).json({ error: message });
    }
  );

  return app;
}

/**
 * createServer
 *
 * This matches what src/index.ts expects: a function that returns
 * an HTTP server instance.
 */
export function createServer(): http.Server {
  const app = createApp();
  return http.createServer(app);
}
