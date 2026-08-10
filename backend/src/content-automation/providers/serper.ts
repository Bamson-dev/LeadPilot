import { getSerperApiKey } from "./../config";
import type { ContentSourceRow } from "./../types";
import { logger } from "../../utils/logger";

export async function researchWithSerper(
  query: string,
  options: { maxResults?: number } = {}
): Promise<{ ok: true; sources: ContentSourceRow[] } | { ok: false; reason: string }> {
  const apiKey = getSerperApiKey();
  if (!apiKey) return { ok: false, reason: "missing_key" };

  const maxResults = options.maxResults ?? 6;
  const started = Date.now();

  try {
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({
        q: query,
        num: maxResults,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      logger.error("Serper research failed", {
        status: response.status,
        body: body.slice(0, 300),
        latencyMs: Date.now() - started,
      });
      return { ok: false, reason: response.status === 401 ? "auth_error" : "api_error" };
    }

    const data = (await response.json()) as {
      organic?: Array<{ title?: string; link?: string; snippet?: string }>;
    };

    const sources: ContentSourceRow[] = (data.organic || [])
      .filter((r) => r.link && r.title)
      .map((r) => ({
        provider: "serper" as const,
        title: String(r.title),
        url: String(r.link),
        snippet: String(r.snippet || "").slice(0, 800),
      }));

    logger.info("Serper research completed", {
      resultCount: sources.length,
      latencyMs: Date.now() - started,
    });

    return { ok: true, sources };
  } catch (err) {
    logger.error("Serper research error", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return { ok: false, reason: "api_error" };
  }
}
