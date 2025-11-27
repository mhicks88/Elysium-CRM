import { Router } from "express";
import { loginHandler, meHandler } from "./service";
import { requireAuth } from "../../middleware/auth";

export const authRouter = Router();

// POST /api/auth/login
authRouter.post("/login", (req, res) => {
  void loginHandler(req, res);
});

// GET /api/auth/me
authRouter.get("/me", requireAuth, (req, res) => {
  void meHandler(req as any, res);
});
