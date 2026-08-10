import { researchWithTavily } from "./providers/tavily";
import { researchWithSerper } from "./providers/serper";
import type { ContentSourceRow } from "./types";
import { logger } from "../utils/logger";

export async function gatherResearchSources(
  topic: string,
  depth: "light" | "standard" | "deep" = "standard"
): Promise<{ sources: ContentSourceRow[]; providersUsed: string[]; errors: string[] }> {
  const maxResults = depth === "light" ? 4 : depth === "deep" ? 10 : 6;
  const queries = [
    topic,
    `${topic} best practices`,
    `${topic} for small businesses`,
  ].slice(0, depth === "light" ? 1 : depth === "deep" ? 3 : 2);

  const sources: ContentSourceRow[] = [];
  const providersUsed: string[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const query of queries) {
    const tavily = await researchWithTavily(query, { maxResults });
    if (tavily.ok && tavily.sources.length > 0) {
      providersUsed.push("tavily");
      for (const s of tavily.sources) {
        if (seen.has(s.url)) continue;
        seen.add(s.url);
        sources.push(s);
      }
    } else {
      errors.push(`tavily:${tavily.ok ? "empty" : tavily.reason}`);
      logger.warn("Tavily unavailable/empty; trying Serper", {
        reason: tavily.ok ? "empty" : tavily.reason,
      });
    }

    // Serper always as secondary validation/supplement for standard+ depth
    if (depth !== "light" || !tavily.ok || tavily.sources.length < Math.ceil(maxResults / 2)) {
      const serper = await researchWithSerper(query, { maxResults });
      if (serper.ok) {
        providersUsed.push("serper");
        for (const s of serper.sources) {
          if (seen.has(s.url)) continue;
          seen.add(s.url);
          sources.push(s);
        }
      } else {
        errors.push(`serper:${serper.reason}`);
      }
    }
  }

  return { sources: sources.slice(0, maxResults * 2), providersUsed: [...new Set(providersUsed)], errors };
}
