import { logger } from "../utils/logger";
import { getGscSiteUrl, pickSearchConsoleSiteUrl } from "./config";
import { decryptGscSecret } from "./crypto";
import { refreshAccessToken } from "./oauth";
import { listSearchConsoleSites, querySearchAnalytics } from "./client";
import {
  finishSyncRun,
  getActiveConnection,
  hasRunningSync,
  markConnectionStatus,
  pruneOldStats,
  startSyncRun,
  upsertConnection,
  upsertDailyRows,
  upsertPageRows,
  upsertQueryRows,
  countStoredRows,
} from "./repository";
import type { GscPageRow, GscQueryRow } from "./types";

let syncLock = false;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function reportingWindow(): { startDate: string; endDate: string } {
  // Search Console data is delayed; exclude the most recent 2 days.
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 2);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 28);
  return { startDate: isoDate(start), endDate: isoDate(end) };
}

export async function runGscSync(
  trigger: "scheduler" | "manual" | "connect"
): Promise<{ ok: boolean; rowsUpserted: number; error?: string }> {
  if (syncLock || (await hasRunningSync())) {
    return { ok: false, rowsUpserted: 0, error: "sync_already_running" };
  }
  syncLock = true;
  let runId: string | null = null;

  try {
    const connection = await getActiveConnection();
    // Allow retry from error state when a refresh token is still present.
    if (
      !connection ||
      !connection.refresh_token_encrypted ||
      (connection.status !== "connected" && connection.status !== "error")
    ) {
      return { ok: false, rowsUpserted: 0, error: "not_connected" };
    }

    runId = await startSyncRun(trigger);
    await upsertConnection({
      site_url: connection.site_url,
      last_sync_at: new Date().toISOString(),
    });

    let accessToken: string;
    try {
      const refreshToken = decryptGscSecret(connection.refresh_token_encrypted);
      const refreshed = await refreshAccessToken(refreshToken);
      accessToken = refreshed.accessToken;
    } catch (err) {
      const code =
        err instanceof Error && "code" in err
          ? String((err as Error & { code?: string }).code || "refresh_failed")
          : "refresh_failed";
      const message =
        code === "invalid_grant"
          ? "Google Search Console authorization expired. Reconnect the integration."
          : err instanceof Error
            ? err.message
            : "Token refresh failed";
      await markConnectionStatus(code === "invalid_grant" ? "revoked" : "error", {
        code,
        message,
      });
      await finishSyncRun(runId, {
        status: "failed",
        errorCode: code,
        errorMessage: message,
      });
      return { ok: false, rowsUpserted: 0, error: message };
    }

    // Resolve the exact Google property URL (URL-prefix vs domain property).
    const sites = await listSearchConsoleSites(accessToken);
    const siteUrl =
      pickSearchConsoleSiteUrl(sites, connection.site_url) ||
      pickSearchConsoleSiteUrl(sites, getGscSiteUrl());
    if (!siteUrl) {
      const message =
        "property_unavailable — authorized account cannot access the LeadThur Search Console property";
      await markConnectionStatus("error", { code: "property_unavailable", message });
      await finishSyncRun(runId, {
        status: "failed",
        errorCode: "property_unavailable",
        errorMessage: message,
      });
      return { ok: false, rowsUpserted: 0, error: message };
    }
    if (siteUrl !== connection.site_url) {
      await upsertConnection({ site_url: siteUrl, status: "connected" });
    }

    const { startDate, endDate } = reportingWindow();
    let rowsUpserted = 0;

    const daily = await querySearchAnalytics(accessToken, {
      siteUrl,
      startDate,
      endDate,
      dimensions: ["date"],
    });
    rowsUpserted += await upsertDailyRows(
      daily
        .map((r) => ({
          report_date: String(r.keys?.[0] || ""),
          clicks: Math.round(Number(r.clicks || 0)),
          impressions: Math.round(Number(r.impressions || 0)),
          ctr: Number(r.ctr || 0),
          position: Number(r.position || 0),
        }))
        .filter((r) => r.report_date)
    );

    const pages = await querySearchAnalytics(accessToken, {
      siteUrl,
      startDate,
      endDate,
      dimensions: ["date", "page"],
    });
    const pageRows: GscPageRow[] = pages
      .map((r) => ({
        report_date: String(r.keys?.[0] || ""),
        page: String(r.keys?.[1] || ""),
        clicks: Math.round(Number(r.clicks || 0)),
        impressions: Math.round(Number(r.impressions || 0)),
        ctr: Number(r.ctr || 0),
        position: Number(r.position || 0),
      }))
      .filter((r) => r.report_date && r.page);
    rowsUpserted += await upsertPageRows(pageRows);

    const queries = await querySearchAnalytics(accessToken, {
      siteUrl,
      startDate,
      endDate,
      dimensions: ["date", "query"],
    });
    const queryRows: GscQueryRow[] = queries
      .map((r) => ({
        report_date: String(r.keys?.[0] || ""),
        query: String(r.keys?.[1] || ""),
        clicks: Math.round(Number(r.clicks || 0)),
        impressions: Math.round(Number(r.impressions || 0)),
        ctr: Number(r.ctr || 0),
        position: Number(r.position || 0),
      }))
      .filter((r) => r.report_date && r.query);
    rowsUpserted += await upsertQueryRows(queryRows);

    await pruneOldStats(400);
    const totalRows = await countStoredRows();
    const next = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await upsertConnection({
      site_url: siteUrl,
      status: "connected",
      last_successful_sync_at: new Date().toISOString(),
      last_sync_at: new Date().toISOString(),
      next_sync_at: next,
      rows_collected: totalRows,
      last_error_at: null,
      last_error_code: null,
      last_error_message: null,
    });
    await finishSyncRun(runId, { status: "success", rowsUpserted });
    logger.info("GSC sync completed", { trigger, rowsUpserted, totalRows, siteUrl });
    return { ok: true, rowsUpserted };
  } catch (err) {
    const message = err instanceof Error ? err.message : "sync_failed";
    logger.error("GSC sync failed", { error: message, trigger });
    if (runId) {
      await finishSyncRun(runId, {
        status: "failed",
        errorCode: "sync_failed",
        errorMessage: message,
      });
    }
    try {
      await markConnectionStatus("error", { code: "sync_failed", message });
    } catch {
      /* ignore */
    }
    return { ok: false, rowsUpserted: 0, error: message };
  } finally {
    syncLock = false;
  }
}
