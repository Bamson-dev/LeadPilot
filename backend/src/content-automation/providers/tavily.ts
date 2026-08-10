import { getTavilyApiKey } from "../config";
import type { ContentSourceRow } from "../types";
import { logger } from "../../utils/logger";

export async function researchWithTavily(
  query: string,
  options: { maxResults?: number } = {}
): Promise<{ ok: true; sources: ContentSourceRow[] } | { ok: false; reason: string }> {
  const apiKey = getTavilyApiKey();
  if (!apiKey) return { ok: false, reason: "missing_key" };

  const maxResults = options.maxResults ?? 6;
  const started = Date.now();

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "advanced",
        include_answer: true,
        include_raw_content: false,
        max_results: maxResults,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      logger.error("Tavily research failed", {
        status: response.status,
        body: body.slice(0, 300),
        latencyMs: Date.now() - started,
      });
      return { ok: false, reason: response.status === 401 ? "auth_error" : "api_error" };
    }

    const data = (await response.json()) as {
      results?: Array<{ title?: string; url?: string; content?: string; score?: number }>;
      answer?: string;
    };

    const sources: ContentSourceRow[] = (data.results || [])
      .filter((r) => r.url && r.title)
      .map((r) => ({
        provider: "tavily" as const,
        title: String(r.title),
        url: String(r.url),
        snippet: String(r.content || data.answer || "").slice(0, 800),
        score: typeof r.score === "number" ? r.score : undefined,
      }));

    logger.info("Tavily research completed", {
      resultCount: sources.length,
      latencyMs: Date.now() - started,
    });

    return { ok: true, sources };
  } catch (err) {
    logger.error("Tavily research error", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return { ok: false, reason: "api_error" };
  }
}
