import type { BlogPostRecord, OptimizationProposal } from "./types";

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function countWords(html: string): number {
  return stripHtml(html).split(/\s+/).filter(Boolean).length;
}

export function validateOptimizationProposal(input: {
  original: BlogPostRecord;
  proposal: OptimizationProposal;
  allowedSlugs: Set<string>;
}): { ok: boolean; notes: string[]; changeSummary: Record<string, unknown> } {
  const notes: string[] = [];
  const originalWords = countWords(input.original.content);
  const newWords = countWords(input.proposal.contentHtml);
  const originalH2 = (input.original.content.match(/<h2/gi) || []).length;
  const newH2 = (input.proposal.contentHtml.match(/<h2/gi) || []).length;

  if (!input.proposal.title || input.proposal.title.length < 15) {
    notes.push("Title too short or missing");
  }
  if (!input.proposal.metaDescription || input.proposal.metaDescription.length < 40) {
    notes.push("Meta description too short or missing");
  }
  if (newWords < 1200) {
    notes.push("Optimized content below minimum useful length");
  }
  if (newWords < originalWords * 0.55) {
    notes.push("Optimization removes too much content");
  }
  if (newWords > originalWords * 2.5 && originalWords > 800) {
    notes.push("Optimization is an oversized rewrite for safety gates");
  }
  if (/in today's digital world|in this ever-changing landscape/i.test(input.proposal.contentHtml)) {
    notes.push("Generic AI opener detected");
  }
  if (/google will rank|guaranteed ranking|page one guaranteed/i.test(input.proposal.contentHtml)) {
    notes.push("Unsupported ranking claim detected");
  }

  const hrefs = [...input.proposal.contentHtml.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]);
  for (const href of hrefs) {
    if (href.startsWith("/blog/")) {
      const slug = href.replace(/^\/blog\//, "").split(/[?#]/)[0];
      if (!input.allowedSlugs.has(slug)) {
        notes.push(`Unknown internal link /blog/${slug}`);
      }
    } else if (href.includes("leadthur.com/blog/")) {
      const slug = href.split("/blog/")[1]?.split(/[?#]/)[0];
      if (slug && !input.allowedSlugs.has(slug)) {
        notes.push(`Unknown LeadThur blog link ${slug}`);
      }
    } else if (href.startsWith("/") && href.includes("javascript:")) {
      notes.push("Invalid link scheme");
    }
  }

  // Slug must remain unchanged — proposal never carries slug changes.
  const titleChanged = input.proposal.title.trim() !== input.original.title.trim();
  const metaChanged =
    input.proposal.metaDescription.trim() !==
    String(input.original.meta_description || "").trim();

  const changeSummary = {
    originalWords,
    newWords,
    originalH2,
    newH2,
    titleChanged,
    metaChanged,
    wordDeltaPct:
      originalWords > 0 ? Math.round(((newWords - originalWords) / originalWords) * 100) : 0,
    internalLinks: hrefs.filter((h) => h.includes("/blog/")).length,
  };

  return { ok: notes.length === 0, notes, changeSummary };
}

export function buildBriefFromPost(post: BlogPostRecord, queries: string[]) {
  return {
    topic: post.title,
    searchIntent: queries[0] || post.title,
    targetReader: "professionals seeking practical lead generation guidance",
    readerProblem: post.excerpt || post.title,
    proposedTitle: post.title,
    articleAngle: post.title,
    outline: [],
    keyQuestions: queries.slice(0, 6),
    importantFacts: [],
    statistics: [],
    researchSources: [],
    examples: [],
    leadthurCapability: "LeadThur finds business contacts with phone numbers and emails",
    potentialCta: "Try LeadThur free trial",
    internalLinkSuggestions: [],
    externalReferences: [],
    imageConcept: "",
    category: post.category || "Lead Generation",
    tags: post.tags || [],
    targetWordCount: Math.max(1500, countWords(post.content)),
  };
}
