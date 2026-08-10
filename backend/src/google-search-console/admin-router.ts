import { Router, type Request, type Response } from "express";
import { requireAdminAuth } from "../middleware/admin-auth";
import { verifyAdminToken } from "../utils/jwt";
import { logger } from "../utils/logger";
import { config } from "../config/env";
import { getGscConfigStatus, getGscSiteUrl, isGscConfigured } from "./config";
import { decryptGscSecret } from "./crypto";
import { beginOAuthConnect, completeOAuthCallback, revokeRefreshToken } from "./oauth";
import {
  clearRefreshToken,
  countStoredRows,
  getActiveConnection,
  getOverview,
  getTopPages,
  getTopQueries,
  getTrends,
  upsertConnection,
} from "./repository";
import { runGscSync } from "./sync";
import { listContentOpportunities } from "./insights";

export const googleSearchConsoleRouter = Router();

function adminEmailFromReq(req: Request): string | null {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) return null;
    const payload = verifyAdminToken(authHeader.slice(7));
    return payload.email;
  } catch {
    return null;
  }
}

function frontendRedirect(path: string): string {
  const base = config.FRONTEND_URL.replace(/\/$/, "");
  return `${base}${path}`;
}

/** Admin-only: start OAuth. */
googleSearchConsoleRouter.get(
  "/connect",
  requireAdminAuth,
  async (req: Request, res: Response) => {
    try {
      if (!isGscConfigured()) {
        res.status(503).json({ error: "Google Search Console is not configured" });
        return;
      }
      const email = adminEmailFromReq(req);
      if (!email) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const { url } = await beginOAuthConnect(email);
      res.json({ authorizeUrl: url });
    } catch (err) {
      logger.error("GSC connect failed", {
        error: err instanceof Error ? err.message : "unknown",
      });
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to start OAuth",
      });
    }
  }
);

/**
 * Google OAuth callback — NOT behind requireAdminAuth.
 * Security is provided by one-time, expiring, hashed OAuth state.
 */
googleSearchConsoleRouter.get("/callback", async (req: Request, res: Response) => {
  try {
    const code = typeof req.query.code === "string" ? req.query.code : null;
    const state = typeof req.query.state === "string" ? req.query.state : null;
    const error = typeof req.query.error === "string" ? req.query.error : null;

    const result = await completeOAuthCallback({ code, state, error });
    if (!result.ok) {
      res.redirect(
        frontendRedirect(
          `/admin/search-console?error=${encodeURIComponent(result.reason)}`
        )
      );
      return;
    }

    // Kick off initial sync without blocking the redirect.
    void runGscSync("connect");
    res.redirect(frontendRedirect("/admin/search-console?connected=1"));
  } catch (err) {
    logger.error("GSC callback handler failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.redirect(
      frontendRedirect(
        `/admin/search-console?error=${encodeURIComponent("callback_failed")}`
      )
    );
  }
});

googleSearchConsoleRouter.get(
  "/status",
  requireAdminAuth,
  async (_req: Request, res: Response) => {
    try {
      const [connection, rows, configStatus] = await Promise.all([
        getActiveConnection(),
        countStoredRows(),
        Promise.resolve(getGscConfigStatus()),
      ]);

      const connected = connection?.status === "connected";
      res.json({
        config: configStatus,
        connection: connection
          ? {
              status: connection.status,
              siteUrl: connection.site_url,
              googleAccountEmail: connection.google_account_email,
              connectedAt: connection.connected_at,
              lastSyncAt: connection.last_sync_at,
              lastSuccessfulSyncAt: connection.last_successful_sync_at,
              nextSyncAt: connection.next_sync_at,
              lastErrorAt: connection.last_error_at,
              lastErrorCode: connection.last_error_code,
              lastErrorMessage: connection.last_error_message,
              rowsCollected: connection.rows_collected || rows,
              // Never include refresh_token_encrypted
            }
          : {
              status: "disconnected",
              siteUrl: getGscSiteUrl(),
              rowsCollected: rows,
            },
        syncHealth: connected
          ? connection?.last_error_at &&
            (!connection.last_successful_sync_at ||
              new Date(connection.last_error_at) >
                new Date(connection.last_successful_sync_at))
            ? "Error"
            : "Healthy"
          : "Warning",
        indexing: {
          available: false,
          note: "URL Inspection / indexing claims are not exposed. Search Analytics only.",
        },
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to load status",
      });
    }
  }
);

googleSearchConsoleRouter.post(
  "/sync",
  requireAdminAuth,
  async (_req: Request, res: Response) => {
    try {
      const result = await runGscSync("manual");
      if (!result.ok && result.error === "sync_already_running") {
        res.status(409).json({ error: "A sync is already running" });
        return;
      }
      if (!result.ok && result.error === "not_connected") {
        res.status(400).json({ error: "Connect Google Search Console first" });
        return;
      }
      res.json({
        success: result.ok,
        rowsUpserted: result.rowsUpserted,
        error: result.error || null,
        finishedAt: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Sync failed",
      });
    }
  }
);

googleSearchConsoleRouter.post(
  "/disconnect",
  requireAdminAuth,
  async (_req: Request, res: Response) => {
    try {
      const connection = await getActiveConnection();
      if (connection?.refresh_token_encrypted) {
        try {
          const token = decryptGscSecret(connection.refresh_token_encrypted);
          await revokeRefreshToken(token);
        } catch {
          /* still clear local credential */
        }
      }
      await clearRefreshToken();
      await upsertConnection({
        site_url: getGscSiteUrl(),
        status: "disconnected",
        google_account_email: null,
        next_sync_at: null,
        last_error_at: null,
        last_error_code: null,
        last_error_message: null,
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Disconnect failed",
      });
    }
  }
);

googleSearchConsoleRouter.get(
  "/overview",
  requireAdminAuth,
  async (req: Request, res: Response) => {
    try {
      const days = Math.min(90, Math.max(7, Number(req.query.days) || 28));
      const overview = await getOverview(days);
      res.json({ overview });
    } catch (err) {
      res.status(500).json({ error: "Failed to load overview" });
    }
  }
);

googleSearchConsoleRouter.get(
  "/pages",
  requireAdminAuth,
  async (req: Request, res: Response) => {
    try {
      const days = Math.min(90, Math.max(7, Number(req.query.days) || 28));
      const sortBy = (["clicks", "impressions", "ctr", "position"] as const).includes(
        req.query.sortBy as never
      )
        ? (req.query.sortBy as "clicks" | "impressions" | "ctr" | "position")
        : "clicks";
      const pages = await getTopPages(days, sortBy, 100);
      res.json({ pages, days, sortBy });
    } catch (err) {
      res.status(500).json({ error: "Failed to load pages" });
    }
  }
);

googleSearchConsoleRouter.get(
  "/queries",
  requireAdminAuth,
  async (req: Request, res: Response) => {
    try {
      const days = Math.min(90, Math.max(7, Number(req.query.days) || 28));
      const sortBy = (["clicks", "impressions", "ctr", "position"] as const).includes(
        req.query.sortBy as never
      )
        ? (req.query.sortBy as "clicks" | "impressions" | "ctr" | "position")
        : "clicks";
      const queries = await getTopQueries(days, sortBy, 100);
      res.json({ queries, days, sortBy });
    } catch (err) {
      res.status(500).json({ error: "Failed to load queries" });
    }
  }
);

googleSearchConsoleRouter.get(
  "/trends",
  requireAdminAuth,
  async (req: Request, res: Response) => {
    try {
      const days = Math.min(90, Math.max(7, Number(req.query.days) || 28));
      const trends = await getTrends(days);
      res.json({ trends, days });
    } catch (err) {
      res.status(500).json({ error: "Failed to load trends" });
    }
  }
);

/** Read-only content intelligence for future automation consumers. */
googleSearchConsoleRouter.get(
  "/opportunities",
  requireAdminAuth,
  async (req: Request, res: Response) => {
    try {
      const days = Math.min(90, Math.max(7, Number(req.query.days) || 28));
      const opportunities = await listContentOpportunities(days);
      res.json({ opportunities, days });
    } catch (err) {
      res.status(500).json({ error: "Failed to load opportunities" });
    }
  }
);
