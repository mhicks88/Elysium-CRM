import express, { Application } from "express";
import cors from "cors";

import { loggingMiddleware } from "./middleware/logging";
import { errorHandler } from "./middleware/errorHandler";
import { authRouter } from "./modules/auth/routes";
import { complianceRouter } from "./modules/compliance/routes";

export function createServer(): Application {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(loggingMiddleware);

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Auth routes
  app.use("/api/auth", authRouter);

  // Compliance routes
  app.use("/api/compliance", complianceRouter);

  // Error handler (keep last)
  app.use(errorHandler);

  return app;
}
