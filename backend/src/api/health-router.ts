import { Router } from "express";

const router = Router();

/** Fast liveness — must respond in under 5s for Coolify/Docker. */
router.get("/", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

/** Readiness — lightweight JSON (deep Playwright check optional via scraper pool). */
router.get("/ready", (_req, res) => {
  res.status(200).json({ status: "ready", timestamp: new Date().toISOString() });
});

export default router;
