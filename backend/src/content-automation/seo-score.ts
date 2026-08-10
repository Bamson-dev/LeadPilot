import { countWords } from "./config";
import type { ContentBrief, ContentMeta } from "./types";

export type SeoReadinessResult = {
  score: number;
  breakdown: Record<string, number>;
  notes: string[];
};

/**
 * Technical/content SEO readiness — not a ranking guarantee.
 */
export function computeSeoReadiness(input: {
  html: string;
  brief: ContentBrief;
  meta: ContentMeta;
  hasImage: boolean;
  imageAlt?: string | null;
  sourceCount: number;
}): SeoReadinessResult {
  const notes: string[] = [];
  const words = countWords(input.html);
  const h2 = (input.html.match(/<h2/gi) || []).length;
  const hasFaq = /frequently asked questions/i.test(input.html);
  const hasSources = /https?:\/\//i.test(input.html) || input.sourceCount > 0;
  const hasInternal = /\/blog\//i.test(input.html);
  const titleLen = (input.meta.title || input.brief.proposedTitle || "").length;
  const metaDescLen = (input.meta.metaDescription || input.meta.excerpt || "").length;
  const slugOk = Boolean(input.meta.slug && /^[a-z0-9-]+$/.test(input.meta.slug));

  const breakdown: Record<string, number> = {
    title: titleLen >= 30 && titleLen <= 70 ? 12 : titleLen > 15 ? 8 : 3,
    metaDescription: metaDescLen >= 110 && metaDescLen <= 165 ? 12 : metaDescLen > 40 ? 7 : 3,
    slug: slugOk ? 8 : 2,
    headings: h2 >= 3 ? 12 : h2 >= 1 ? 6 : 2,
    depth: words >= 2500 ? 14 : words >= 1500 ? 9 : 4,
    sources: hasSources ? 10 : 3,
    internalLinks: hasInternal ? 10 : 3,
    image: input.hasImage ? 8 : 3,
    imageAlt: input.hasImage && input.imageAlt ? 6 : input.hasImage ? 2 : 3,
    intent: input.brief.searchIntent ? 8 : 4,
  };

  if (hasFaq) breakdown.faq = 5;
  else {
    breakdown.faq = 2;
    notes.push("No FAQ section — optional for this intent");
  }
  if (!hasInternal) notes.push("Add contextual internal links");
  if (!hasSources) notes.push("Add cited external sources");
  if (!input.hasImage) notes.push("Featured image missing");
  if (titleLen < 30 || titleLen > 70) notes.push("Tune SEO title length");
  if (metaDescLen < 110 || metaDescLen > 165) notes.push("Tune meta description length");

  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(Object.values(breakdown).reduce((a, b) => a + b, 0))
    )
  );

  return { score, breakdown, notes };
}
