/**
 * Factual LeadThur capabilities for contextual promotion.
 * Never invent features, metrics, testimonials, or competitor superiority claims.
 */
export const LEADTHUR_PRODUCT_FACTS = {
  name: "LeadThur",
  tagline: "Find businesses and reach out with context",
  capabilities: [
    {
      id: "business_search",
      label: "Business search",
      summary:
        "Search for local and niche businesses by query and location to build prospect lists.",
      cta: "Start a search",
      href: "/freetrial",
      articleSignals: ["lead generation", "prospect", "find businesses", "local leads", "directories"],
    },
    {
      id: "free_trial",
      label: "Free trial search",
      summary:
        "Try LeadThur with a limited free trial before committing to a paid plan.",
      cta: "Try LeadThur",
      href: "/freetrial",
      articleSignals: ["try", "free", "get started", "evaluate tools"],
    },
    {
      id: "outreach",
      label: "Gmail outreach",
      summary:
        "Send outreach from connected Gmail mailboxes with tracking and follow-up tooling.",
      cta: "Explore outreach",
      href: "/outreach",
      articleSignals: ["cold email", "outreach", "follow-up", "gmail", "pitch"],
    },
    {
      id: "ai_writer",
      label: "AI outreach writer",
      summary: "Draft outreach messages with AI assistance inside LeadThur workflows.",
      cta: "See how LeadThur works",
      href: "/",
      articleSignals: ["message templates", "write emails", "pitch writing", "ai writer"],
    },
  ],
  geographyNotes: [
    "Useful for Nigerian and African businesses building prospect lists.",
    "Also used for local lead generation in other markets.",
  ],
  disallowedClaims: [
    "Do not invent customer counts, revenue, reviews, or testimonials.",
    "Do not claim LeadThur is better than a named competitor without factual, sourced comparison criteria.",
    "Do not invent product features that are not listed above.",
  ],
} as const;

export function pickLeadThurCapability(topic: string, category?: string): {
  id: string;
  label: string;
  summary: string;
  cta: string;
  href: string;
} {
  const haystack = `${topic} ${category || ""}`.toLowerCase();
  let best: (typeof LEADTHUR_PRODUCT_FACTS.capabilities)[number] =
    LEADTHUR_PRODUCT_FACTS.capabilities[0];
  let bestScore = -1;
  for (const cap of LEADTHUR_PRODUCT_FACTS.capabilities) {
    let score = 0;
    for (const signal of cap.articleSignals) {
      if (haystack.includes(signal)) score += 2;
    }
    if (score > bestScore) {
      best = cap;
      bestScore = score;
    }
  }
  return {
    id: best.id,
    label: best.label,
    summary: best.summary,
    cta: best.cta,
    href: best.href,
  };
}
