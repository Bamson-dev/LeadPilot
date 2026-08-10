import { callDeepSeekChat } from "../services/deepseek-client";
import { safeJsonParse, countWords, slugify } from "./config";
import { LEADTHUR_PRODUCT_FACTS, pickLeadThurCapability } from "./product-facts";
import type { ContentBrief, ContentSourceRow, QualityResult } from "./types";

const EDITOR_SYSTEM = `You are a senior business editor writing for LeadThur's public blog.
Write natural, specific, useful editorial content. Avoid generic AI filler.
Never invent statistics, quotes, case studies, or product features.
Only use LeadThur capabilities that are explicitly provided.
Prefer concrete advice over motivational language.
Vary sentence length. Keep paragraphs short where helpful.
Do not start with "In today's digital world" or similar clichés.`;

export async function buildContentBrief(input: {
  topic: string;
  cluster?: string | null;
  intent?: string | null;
  audience?: string | null;
  sources: ContentSourceRow[];
  existingInternalLinks: Array<{ title: string; slug: string }>;
  minWords: number;
  maxWords: number;
  categoryOptions: string[];
}): Promise<ContentBrief> {
  const capability = pickLeadThurCapability(input.topic, input.cluster || undefined);
  const sourceBlock = input.sources
    .slice(0, 10)
    .map((s, i) => `${i + 1}. ${s.title}\nURL: ${s.url}\nNotes: ${s.snippet}`)
    .join("\n\n");

  const internalBlock = input.existingInternalLinks
    .slice(0, 12)
    .map((p) => `- ${p.title} (/blog/${p.slug})`)
    .join("\n");

  const result = await callDeepSeekChat(
    `Create a detailed content brief for this blog topic.

Topic: ${input.topic}
Cluster: ${input.cluster || "General"}
Intent: ${input.intent || "informational"}
Audience: ${input.audience || "business owners and sales teams"}
Target words: ${input.minWords}-${input.maxWords}
Allowed categories: ${input.categoryOptions.join(", ")}

LeadThur capability to mention factually:
${capability.label}: ${capability.summary}
CTA: ${capability.cta} -> ${capability.href}

Existing internal posts:
${internalBlock || "(none)"}

Research sources:
${sourceBlock || "(limited research — rely on practical expertise, no invented stats)"}

Return JSON only with keys:
topic, searchIntent, targetReader, readerProblem, proposedTitle, articleAngle,
outline (array), keyQuestions (array), importantFacts (array),
statistics (array of {claim, sourceUrl}), researchSources (array of {title,url,snippet}),
examples (array), leadthurCapability, potentialCta, internalLinkSuggestions (array of {title,slug,reason}),
externalReferences (array of {title,url}), imageConcept, category, tags (array), targetWordCount`,
    { max_tokens: 3500, temperature: 0.4, system: EDITOR_SYSTEM }
  );

  if (!result.ok) {
    throw new Error(`Brief generation failed: ${result.reason}`);
  }

  const parsed = safeJsonParse<Partial<ContentBrief>>(result.content);
  if (!parsed?.proposedTitle) {
    throw new Error("Brief generation returned invalid JSON");
  }

  return {
    topic: parsed.topic || input.topic,
    searchIntent: parsed.searchIntent || input.intent || "informational",
    targetReader: parsed.targetReader || input.audience || "business owners",
    readerProblem: parsed.readerProblem || "Need a clearer practical approach",
    proposedTitle: parsed.proposedTitle,
    articleAngle: parsed.articleAngle || "Practical guide",
    outline: parsed.outline || ["Introduction", "Core steps", "Examples", "Conclusion"],
    keyQuestions: parsed.keyQuestions || [],
    importantFacts: parsed.importantFacts || [],
    statistics: parsed.statistics || [],
    researchSources: parsed.researchSources || input.sources,
    examples: parsed.examples || [],
    leadthurCapability: parsed.leadthurCapability || capability.summary,
    potentialCta: parsed.potentialCta || capability.cta,
    internalLinkSuggestions: parsed.internalLinkSuggestions || [],
    externalReferences: parsed.externalReferences || [],
    imageConcept:
      parsed.imageConcept ||
      `Editorial illustration about ${input.topic}, clean professional style, no text`,
    category:
      input.categoryOptions.find((c) => c === parsed.category) ||
      input.categoryOptions[0] ||
      "Lead Generation",
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 8) : [],
    targetWordCount: Math.min(
      input.maxWords,
      Math.max(input.minWords, Number(parsed.targetWordCount) || input.minWords)
    ),
  };
}

export async function generateArticleHtml(brief: ContentBrief): Promise<string> {
  const capability = pickLeadThurCapability(brief.topic, brief.category);
  const result = await callDeepSeekChat(
    `Write a complete blog article as clean semantic HTML (use h2/h3/p/ul/ol/table/blockquote where useful).
No markdown fences. No html/body wrappers.

Title: ${brief.proposedTitle}
Angle: ${brief.articleAngle}
Reader: ${brief.targetReader}
Problem: ${brief.readerProblem}
Target length: about ${brief.targetWordCount} words (quality over padding)

Outline:
${brief.outline.map((x, i) => `${i + 1}. ${x}`).join("\n")}

Facts you may use (do not invent extras):
${brief.importantFacts.map((f) => `- ${f}`).join("\n") || "- Use practical guidance only"}

Statistics (only if source present):
${brief.statistics.map((s) => `- ${s.claim}${s.sourceUrl ? ` (${s.sourceUrl})` : ""}`).join("\n") || "- none"}

Sources to cite naturally where relevant:
${brief.researchSources
  .slice(0, 8)
  .map((s) => `- ${s.title}: ${s.url}`)
  .join("\n")}

Internal links to include only where natural (use absolute path /blog/slug):
${brief.internalLinkSuggestions
  .slice(0, 5)
  .map((l) => `- ${l.title} -> /blog/${l.slug} (${l.reason})`)
  .join("\n") || "- none forced"}

LeadThur mention rules:
${LEADTHUR_PRODUCT_FACTS.disallowedClaims.join("\n")}
Allowed capability: ${capability.label} — ${capability.summary}
Include one natural contextual mention and one soft CTA linking to ${capability.href} with anchor text like "${capability.cta}".
Do not spam CTAs.

Optionally include a short FAQ section with real questions from: ${brief.keyQuestions.join("; ") || "none"}
If FAQ included, use an h2 titled exactly "Frequently Asked Questions".

End with a Sources section listing external URLs used.`,
    { max_tokens: 8192, temperature: 0.55, system: EDITOR_SYSTEM }
  );

  if (!result.ok) throw new Error(`Article generation failed: ${result.reason}`);
  let html = result.content.trim();
  if (html.startsWith("```")) {
    html = html.replace(/^```(?:html)?\s*/i, "").replace(/\s*```$/, "");
  }
  if (!html.includes("<h2") && !html.includes("<p")) {
    throw new Error("Article generation returned non-HTML content");
  }
  return html;
}

export async function reviseArticleHtml(
  html: string,
  feedback: string,
  brief: ContentBrief
): Promise<string> {
  const result = await callDeepSeekChat(
    `Revise this article HTML to address the feedback while preserving factual integrity.

Feedback:
${feedback}

Required improvements:
- Add a Sources section with real https URLs from the brief where available
- Strengthen one natural LeadThur CTA (correct destination path)
- Improve originality with more specific examples and concrete steps
- Keep clean semantic HTML only (h2/h3/p/ul/ol)

Brief title: ${brief.proposedTitle}
Target words: ~${brief.targetWordCount}
Known source URLs:
${brief.researchSources
  .slice(0, 8)
  .map((s) => `- ${s.title}: ${s.url}`)
  .join("\n")}

Return revised clean HTML only.

Article:
${html.slice(0, 24000)}`,
    { max_tokens: 8192, temperature: 0.4, system: EDITOR_SYSTEM }
  );
  if (!result.ok) throw new Error(`Revision failed: ${result.reason}`);
  let out = result.content.trim();
  if (out.startsWith("```")) {
    out = out.replace(/^```(?:html)?\s*/i, "").replace(/\s*```$/, "");
  }
  return out;
}

export async function scoreArticleQuality(input: {
  html: string;
  brief: ContentBrief;
  hasImage: boolean;
  threshold: number;
}): Promise<QualityResult> {
  const words = countWords(input.html);
  const hasCta = /leadthur|\/freetrial|\/outreach/i.test(input.html);
  const hasSources = /https?:\/\//i.test(input.html);
  const hasInternal = /\/blog\//i.test(input.html);
  const genericOpeners = /in today's digital world|in this ever-changing landscape|businesses are constantly/i.test(
    input.html
  );

  const heuristic: Record<string, number> = {
    length: words >= input.brief.targetWordCount * 0.7 ? 15 : words >= 1200 ? 10 : 4,
    structure: (input.html.match(/<h2/gi) || []).length >= 3 ? 12 : 6,
    sources: hasSources ? 12 : 4,
    internalLinks: hasInternal ? 8 : 3,
    leadthur: hasCta ? 10 : 2,
    image: input.hasImage ? 8 : 5,
    antiGeneric: genericOpeners ? 2 : 10,
  };

  const result = await callDeepSeekChat(
    `Score this article for editorial quality 0-100.
Return JSON: {"score": number, "breakdown": {"usefulness":0-20,"originality":0-15,"factualSupport":0-15,"readability":0-15,"structure":0-10,"intentMatch":0-10,"leadthurAccuracy":0-10,"ctaRelevance":0-5}, "feedback":"..."}

Penalize generic AI tone, invented facts, weak usefulness, keyword stuffing.
Word count: ${words}
Has image: ${input.hasImage}
Title: ${input.brief.proposedTitle}

HTML excerpt:
${input.html.slice(0, 12000)}`,
    { max_tokens: 1200, temperature: 0.2, system: EDITOR_SYSTEM }
  );

  const parsed = result.ok
    ? safeJsonParse<{
        score?: number;
        breakdown?: Record<string, number>;
        feedback?: string;
      }>(result.content)
    : null;

  const modelScore = typeof parsed?.score === "number" ? parsed.score : null;
  const dimScores = parsed?.breakdown
    ? Object.values(parsed.breakdown).filter((n) => typeof n === "number")
    : [];
  const dimTotal = dimScores.length
    ? dimScores.reduce((a, b) => a + b, 0)
    : null;

  // Prefer the model score / dimension total; apply small structural bonuses.
  let score = modelScore ?? dimTotal ?? 70;
  if (dimTotal != null) score = Math.max(score, dimTotal);
  if (words >= 2000) score += 4;
  if (words >= 2800) score += 2;
  if (hasCta) score += 4;
  if (hasSources) score += 5;
  if (hasInternal) score += 3;
  if (!genericOpeners) score += 3;
  if ((input.html.match(/<h2/gi) || []).length >= 4) score += 2;
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Hard fail only when core usefulness gates are clearly missing.
  const hardFail = words < 1200 || genericOpeners;
  const passed = !hardFail && score >= input.threshold;

  return {
    score,
    passed,
    breakdown: {
      ...heuristic,
      ...(parsed?.breakdown || {}),
      wordCount: words,
      modelScore: modelScore ?? -1,
      dimTotal: dimTotal ?? -1,
    },
    feedback:
      parsed?.feedback ||
      (passed
        ? "Meets quality threshold."
        : "Needs stronger specificity, sources, or structure."),
  };
}

export function buildMetadataFromBrief(
  brief: ContentBrief,
  html: string
): {
  title: string;
  slug: string;
  excerpt: string;
  metaTitle: string;
  metaDescription: string;
  category: string;
  tags: string[];
  wordCount: number;
} {
  const wordCount = countWords(html);
  const excerpt =
    brief.readerProblem.slice(0, 180) ||
    html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
  const title = brief.proposedTitle.slice(0, 120);
  return {
    title,
    slug: slugify(title),
    excerpt,
    metaTitle: title.slice(0, 60),
    metaDescription: excerpt.slice(0, 155),
    category: brief.category,
    tags: brief.tags,
    wordCount,
  };
}
