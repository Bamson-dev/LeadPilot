import { getTopPages, getTopQueries, getTrends } from "../google-search-console/repository";
import {
  listPublishedBlogPosts,
  publicBlogUrl,
  upsertOpportunity,
} from "./repository";
import type { SeoOpportunity, SeoQueryEvidence } from "./types";

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    let path = u.pathname.replace(/\/$/, "") || "/";
    return `${u.origin}${path}`.toLowerCase();
  } catch {
    return url.replace(/\/$/, "").toLowerCase();
  }
}

function blogSlugFromUrl(url: string): string | null {
  const m = url.match(/\/blog\/([^/?#]+)/i);
  if (!m?.[1]) return null;
  const slug = decodeURIComponent(m[1]).toLowerCase();
  if (slug === "category" || slug === "tag" || slug === "page") return null;
  // Only article paths: /blog/{slug} (reject /blog/category/x etc.)
  if (/\/blog\/[^/]+\/./i.test(url)) return null;
  return slug;
}

function scoreOpportunity(input: {
  type: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  impressionsPrev?: number;
  clicksPrev?: number;
}): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  if (input.impressions >= 500) {
    score += 25;
    reasons.push(`${input.impressions.toLocaleString()} impressions`);
  } else if (input.impressions >= 100) {
    score += 15;
    reasons.push(`${input.impressions.toLocaleString()} impressions`);
  } else if (input.impressions >= 20) {
    score += 8;
    reasons.push(`${input.impressions} impressions (limited sample)`);
  }

  if (input.position >= 4 && input.position <= 20) {
    score += 20;
    reasons.push(`average position ${input.position.toFixed(1)} (ranking opportunity band)`);
  } else if (input.position > 1 && input.position < 4) {
    score += 8;
    reasons.push(`strong position ${input.position.toFixed(1)}`);
  }

  if (input.ctr < 0.02 && input.impressions >= 50) {
    score += 22;
    reasons.push(`CTR ${(input.ctr * 100).toFixed(2)}% below typical visibility`);
  } else if (input.ctr < 0.05 && input.impressions >= 50) {
    score += 12;
    reasons.push(`CTR ${(input.ctr * 100).toFixed(2)}% may have snippet room`);
  }

  if (input.clicks >= 10) {
    score += 8;
    reasons.push(`${input.clicks} clicks show existing demand`);
  }

  if (
    input.clicksPrev != null &&
    input.impressionsPrev != null &&
    input.impressionsPrev >= 20 &&
    input.clicks < input.clicksPrev * 0.7
  ) {
    score += 15;
    reasons.push("clicks declined vs previous comparable window");
  }

  if (input.type === "rising_content") {
    score = Math.min(score, 40);
    reasons.push("rising content — protect from unnecessary rewrites");
  }

  return { score: Math.max(0, Math.min(100, Math.round(score))), reasons };
}

export async function analyzeSeoOpportunities(days = 28): Promise<{
  created: number;
  opportunities: SeoOpportunity[];
}> {
  const half = Math.max(7, Math.floor(days / 2));
  const [pages, queries, trends, posts] = await Promise.all([
    getTopPages(days, "impressions", 250),
    getTopQueries(days, "impressions", 100),
    getTrends(days),
    listPublishedBlogPosts(300),
  ]);

  const postBySlug = new Map(posts.map((p) => [p.slug.toLowerCase(), p]));
  const postByUrl = new Map(
    posts.map((p) => [normalizeUrl(publicBlogUrl(p.slug)), p])
  );

  const recent = trends.slice(-half);
  const previous = trends.slice(0, Math.max(0, trends.length - half));
  const sum = (rows: typeof trends, key: "clicks" | "impressions") =>
    rows.reduce((a, r) => a + Number(r[key] || 0), 0);

  const siteClicksRecent = sum(recent, "clicks");
  const siteClicksPrev = sum(previous, "clicks");
  const siteDeclining =
    siteClicksPrev >= 20 && siteClicksRecent < siteClicksPrev * 0.75;

  const out: SeoOpportunity[] = [];

  for (const page of pages) {
    const url = page.page;
    const slug = blogSlugFromUrl(url);
    if (!slug) continue; // Only optimize blog articles in this phase.
    const post =
      postBySlug.get(slug.toLowerCase()) ||
      postByUrl.get(normalizeUrl(url)) ||
      null;
    if (!post) continue;

    const relatedQueries: SeoQueryEvidence[] = queries
      .filter((q) => q.impressions >= 1)
      .slice(0, 12)
      .map((q) => ({
        query: q.query,
        clicks: q.clicks,
        impressions: q.impressions,
        ctr: q.ctr,
        position: q.position,
      }));

    // Rising content — record protectively, do not push for rewrite.
    if (
      page.clicks >= 20 &&
      page.ctr >= 0.05 &&
      page.position > 0 &&
      page.position <= 5 &&
      page.impressions >= 50
    ) {
      const scored = scoreOpportunity({
        type: "rising_content",
        impressions: page.impressions,
        clicks: page.clicks,
        ctr: page.ctr,
        position: page.position,
      });
      out.push(
        await upsertOpportunity({
          blog_post_id: post.id,
          page_url: publicBlogUrl(post.slug),
          opportunity_type: "rising_content",
          opportunity_score: scored.score,
          score_reasons: scored.reasons,
          clicks: page.clicks,
          impressions: page.impressions,
          ctr: page.ctr,
          position: page.position,
          top_queries: relatedQueries.slice(0, 5),
          recommended_action: "Do nothing — protect improving article",
          evidence: { note: "Strong CTR and position; avoid unnecessary rewrite" },
        })
      );
      continue;
    }

    if (page.impressions >= 50 && page.ctr < 0.02) {
      const scored = scoreOpportunity({
        type: "high_impression_low_ctr",
        impressions: page.impressions,
        clicks: page.clicks,
        ctr: page.ctr,
        position: page.position,
      });
      out.push(
        await upsertOpportunity({
          blog_post_id: post.id,
          page_url: publicBlogUrl(post.slug),
          opportunity_type: "high_impression_low_ctr",
          opportunity_score: scored.score,
          score_reasons: scored.reasons,
          clicks: page.clicks,
          impressions: page.impressions,
          ctr: page.ctr,
          position: page.position,
          top_queries: relatedQueries.slice(0, 8),
          recommended_action: "Review title, meta description, and introduction for search intent",
          evidence: { page },
        })
      );
    } else if (page.impressions >= 2 && page.ctr < 0.05) {
      // Blog articles often start with low volume — still surface SEO opportunities.
      const scored = scoreOpportunity({
        type: "high_impression_low_ctr",
        impressions: page.impressions,
        clicks: page.clicks,
        ctr: page.ctr,
        position: page.position,
      });
      out.push(
        await upsertOpportunity({
          blog_post_id: post.id,
          page_url: publicBlogUrl(post.slug),
          opportunity_type: "high_impression_low_ctr",
          opportunity_score: Math.max(scored.score, 35),
          score_reasons: [
            ...scored.reasons,
            "early blog visibility with weak CTR — SEO opportunity (not a ranking guarantee)",
          ],
          clicks: page.clicks,
          impressions: page.impressions,
          ctr: page.ctr,
          position: page.position,
          top_queries: relatedQueries.slice(0, 8),
          recommended_action: "Improve title/meta and opening for emerging query intent",
          evidence: { page, lowVolume: true },
        })
      );
    }

    if (page.position >= 4 && page.position <= 20 && page.impressions >= 20) {
      const scored = scoreOpportunity({
        type: "positions_4_to_20",
        impressions: page.impressions,
        clicks: page.clicks,
        ctr: page.ctr,
        position: page.position,
      });
      out.push(
        await upsertOpportunity({
          blog_post_id: post.id,
          page_url: publicBlogUrl(post.slug),
          opportunity_type: "positions_4_to_20",
          opportunity_score: scored.score,
          score_reasons: scored.reasons,
          clicks: page.clicks,
          impressions: page.impressions,
          ctr: page.ctr,
          position: page.position,
          top_queries: relatedQueries.slice(0, 8),
          recommended_action: "Strengthen content depth and intent coverage for ranking opportunity",
          evidence: { page },
        })
      );
    } else if (page.position >= 4 && page.position <= 30 && page.impressions >= 2) {
      const scored = scoreOpportunity({
        type: "positions_4_to_20",
        impressions: page.impressions,
        clicks: page.clicks,
        ctr: page.ctr,
        position: page.position,
      });
      out.push(
        await upsertOpportunity({
          blog_post_id: post.id,
          page_url: publicBlogUrl(post.slug),
          opportunity_type: "positions_4_to_20",
          opportunity_score: Math.max(scored.score, 30),
          score_reasons: [
            ...scored.reasons,
            "blog article in extended ranking opportunity band",
          ],
          clicks: page.clicks,
          impressions: page.impressions,
          ctr: page.ctr,
          position: page.position,
          top_queries: relatedQueries.slice(0, 8),
          recommended_action: "Targeted content and snippet improvements for ranking opportunity",
          evidence: { page, extendedBand: true },
        })
      );
    }

    if (page.impressions >= 100 && page.clicks <= 1) {
      const scored = scoreOpportunity({
        type: "content_depth_gap",
        impressions: page.impressions,
        clicks: page.clicks,
        ctr: page.ctr,
        position: page.position,
      });
      out.push(
        await upsertOpportunity({
          blog_post_id: post.id,
          page_url: publicBlogUrl(post.slug),
          opportunity_type: "content_depth_gap",
          opportunity_score: scored.score,
          score_reasons: [...scored.reasons, "very low clicks relative to impressions"],
          clicks: page.clicks,
          impressions: page.impressions,
          ctr: page.ctr,
          position: page.position,
          top_queries: relatedQueries.slice(0, 8),
          recommended_action: "Expand useful sections and clarify search intent answers",
          evidence: { page },
        })
      );
    }

    if (siteDeclining && page.clicks >= 5) {
      const scored = scoreOpportunity({
        type: "declining_performance",
        impressions: page.impressions,
        clicks: page.clicks,
        ctr: page.ctr,
        position: page.position,
        clicksPrev: Math.round(page.clicks * 1.4),
        impressionsPrev: page.impressions,
      });
      out.push(
        await upsertOpportunity({
          blog_post_id: post.id,
          page_url: publicBlogUrl(post.slug),
          opportunity_type: "declining_performance",
          opportunity_score: Math.min(scored.score, 75),
          score_reasons: [
            ...scored.reasons,
            `site clicks recent ${siteClicksRecent} vs prior ${siteClicksPrev}`,
          ],
          clicks: page.clicks,
          impressions: page.impressions,
          ctr: page.ctr,
          position: page.position,
          clicks_prev: siteClicksPrev,
          impressions_prev: sum(previous, "impressions"),
          top_queries: relatedQueries.slice(0, 5),
          recommended_action: "Inspect for outdated sections before making content changes",
          evidence: { siteClicksRecent, siteClicksPrev },
        })
      );
    }
  }

  // Query-level opportunities mapped to best matching published article by slug token overlap.
  for (const q of queries) {
    if (!(q.impressions >= 50 && q.ctr < 0.02)) continue;
    const tokens = q.query.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
    let best: { postId: string; slug: string; hits: number } | null = null;
    for (const post of posts) {
      const hay = `${post.title} ${post.slug} ${post.excerpt || ""}`.toLowerCase();
      const hits = tokens.filter((t) => hay.includes(t)).length;
      if (hits >= 2 && (!best || hits > best.hits)) {
        best = { postId: post.id, slug: post.slug, hits };
      }
    }
    if (!best) continue;
    const scored = scoreOpportunity({
      type: "high_impression_query_low_ctr",
      impressions: q.impressions,
      clicks: q.clicks,
      ctr: q.ctr,
      position: q.position,
    });
    out.push(
      await upsertOpportunity({
        blog_post_id: best.postId,
        page_url: publicBlogUrl(best.slug),
        opportunity_type: "high_impression_query_low_ctr",
        opportunity_score: scored.score,
        score_reasons: [...scored.reasons, `query "${q.query}"`],
        clicks: q.clicks,
        impressions: q.impressions,
        ctr: q.ctr,
        position: q.position,
        top_queries: [
          {
            query: q.query,
            clicks: q.clicks,
            impressions: q.impressions,
            ctr: q.ctr,
            position: q.position,
          },
        ],
        recommended_action: "Align title/intro with this query intent without keyword stuffing",
        evidence: { query: q, matchedTokens: best.hits },
      })
    );
  }

  return { created: out.length, opportunities: out };
}
