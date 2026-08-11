import type { BlogPostRecord, OptimizationProposal } from "./types";

export function buildOptimizationPrompt(input: {
  post: BlogPostRecord;
  opportunityType: string;
  scoreReasons: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  topQueries: Array<{ query: string; impressions: number; clicks: number }>;
  researchSummary?: string;
  internalLinks: Array<{ title: string; slug: string }>;
}): string {
  return `You are optimizing an existing LeadThur blog article using Search Console evidence.
This is an SEO opportunity analysis — not a ranking guarantee.

Return ONLY valid JSON:
{
  "title": "string",
  "metaDescription": "string",
  "excerpt": "string",
  "contentHtml": "string (full article HTML with h2/h3/p/ul/li/a only)",
  "optimizationTypes": ["title"|"meta"|"introduction"|"content_expansion"|"content_update"|"internal_links"|"faq"|"structure"],
  "reasoning": "short plain explanation",
  "changes": ["bullet list of concrete changes"]
}

Rules:
- Keep the same article URL/slug intent. Do not invent a new slug.
- Prefer targeted improvements over full rewrites.
- Natural human writing. No generic AI openers. No keyword stuffing. No fake stats.
- Only use internal links from the provided list. Format as /blog/{slug}.
- Do not remove LeadThur mentions if present.
- Do not claim Google will rank the article.
- Keep useful existing content; improve weak sections.
- Title length ideally 30-70 chars. Meta description ideally 110-165 chars.

Opportunity type: ${input.opportunityType}
Evidence reasons: ${input.scoreReasons.join("; ")}
Clicks: ${input.clicks}
Impressions: ${input.impressions}
CTR: ${(input.ctr * 100).toFixed(2)}%
Average position: ${input.position.toFixed(1)}
Top queries: ${JSON.stringify(input.topQueries.slice(0, 8))}
Allowed internal links: ${JSON.stringify(input.internalLinks.slice(0, 12))}
Research summary: ${input.researchSummary || "none"}

Current title: ${input.post.title}
Current meta description: ${input.post.meta_description || ""}
Current excerpt: ${input.post.excerpt || ""}

Current HTML:
${input.post.content.slice(0, 14000)}
`;
}

export function parseOptimizationProposal(raw: string): OptimizationProposal | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as Partial<OptimizationProposal>;
    if (
      typeof parsed.title !== "string" ||
      typeof parsed.contentHtml !== "string" ||
      parsed.contentHtml.length < 400
    ) {
      return null;
    }
    return {
      title: parsed.title.trim().slice(0, 120),
      metaDescription: String(parsed.metaDescription || "").trim().slice(0, 180),
      excerpt: String(parsed.excerpt || "").trim().slice(0, 220),
      contentHtml: parsed.contentHtml.trim(),
      optimizationTypes: Array.isArray(parsed.optimizationTypes)
        ? parsed.optimizationTypes.map(String)
        : [],
      reasoning: String(parsed.reasoning || "").slice(0, 2000),
      changes: Array.isArray(parsed.changes) ? parsed.changes.map(String).slice(0, 20) : [],
    };
  } catch {
    return null;
  }
}
