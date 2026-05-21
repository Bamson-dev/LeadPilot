import type { Request, Response, NextFunction } from "express";
import { verifyAdminToken } from "../utils/jwt";
import { logger } from "../utils/logger";

export function requireAdminAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const token = authHeader.split(" ")[1];
    const payload = verifyAdminToken(token);

    if (payload.role !== "admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    next();
  } catch (err) {
    logger.warn("Invalid admin token", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
