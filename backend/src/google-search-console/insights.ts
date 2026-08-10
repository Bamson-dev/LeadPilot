/**
 * Content Intelligence read models for future Content Automation consumption.
 * Intentionally not wired into content automation yet.
 */
import { getTopPages, getTopQueries } from "./repository";

export type ContentOpportunity = {
  type:
    | "high_impression_low_ctr"
    | "positions_4_to_20"
    | "strong_performer"
    | "underperformer";
  page?: string;
  query?: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export async function listContentOpportunities(
  days = 28
): Promise<ContentOpportunity[]> {
  const [pages, queries] = await Promise.all([
    getTopPages(days, "impressions", 100),
    getTopQueries(days, "impressions", 100),
  ]);

  const out: ContentOpportunity[] = [];

  for (const p of pages) {
    if (p.impressions >= 50 && p.ctr < 0.02) {
      out.push({
        type: "high_impression_low_ctr",
        page: p.page,
        clicks: p.clicks,
        impressions: p.impressions,
        ctr: p.ctr,
        position: p.position,
      });
    }
    if (p.position >= 4 && p.position <= 20 && p.impressions >= 20) {
      out.push({
        type: "positions_4_to_20",
        page: p.page,
        clicks: p.clicks,
        impressions: p.impressions,
        ctr: p.ctr,
        position: p.position,
      });
    }
    if (p.clicks >= 10 && p.ctr >= 0.05) {
      out.push({
        type: "strong_performer",
        page: p.page,
        clicks: p.clicks,
        impressions: p.impressions,
        ctr: p.ctr,
        position: p.position,
      });
    }
    if (p.impressions >= 100 && p.clicks <= 1) {
      out.push({
        type: "underperformer",
        page: p.page,
        clicks: p.clicks,
        impressions: p.impressions,
        ctr: p.ctr,
        position: p.position,
      });
    }
  }

  for (const q of queries) {
    if (q.impressions >= 50 && q.ctr < 0.02) {
      out.push({
        type: "high_impression_low_ctr",
        query: q.query,
        clicks: q.clicks,
        impressions: q.impressions,
        ctr: q.ctr,
        position: q.position,
      });
    }
  }

  return out;
}
