import express, { Application } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import { loggingMiddleware } from "./middleware/logging";
import { errorHandler } from "./middleware/errorHandler";
import { authRouter } from "./modules/auth/routes";
import { complianceRouter } from "./modules/compliance/routes";
import { leadsRouter } from "./modules/leads/routes";
import { auditRouter } from "./modules/audit/routes";
import { complianceHistoryRouter } from "./modules/complianceHistory/routes";
import { complianceAdminRouter } from "./modules/complianceHistory/adminRoutes";

const FRONTEND_ORIGIN =
  process.env.FRONTEND_ORIGIN || "http://localhost:5173";

export function createServer(): Application {
  const app = express();

  // CORS – allow frontend to send cookies (refreshToken)
  app.use(
    cors({
      origin: FRONTEND_ORIGIN,
      credentials: true,
    })
  );

  // Parse cookies so req.cookies.refreshToken works
  app.use(cookieParser());

  // Parse JSON bodies
  app.use(express.json());

  // Your existing logging
  app.use(loggingMiddleware);

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Auth routes (/api/auth/login, /api/auth/refresh, etc.)
  app.use("/api/auth", authRouter);

  // Compliance routes
  app.use("/api/compliance", complianceRouter);

  // Compliance history routes (per lead)
  app.use("/api/compliance/history", complianceHistoryRouter);

  // Compliance admin routes (aggregated)
  app.use("/api/compliance/admin", complianceAdminRouter);

  // Leads routes
  app.use("/api/leads", leadsRouter);

  // Audit routes
  app.use("/api/audit", auditRouter);

  // Error handler (keep last)
  app.use(errorHandler);

  return app;
}

