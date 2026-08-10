import { callDeepSeekChat } from "../services/deepseek-client";
import { slugify, safeJsonParse } from "./config";
import { pickLeadThurCapability } from "./product-facts";
import { listPublishedBlogSummaries, upsertTopic } from "./repository";
import type { ContentTopic } from "./types";
import { logger } from "../utils/logger";

const SEED_TOPICS = [
  {
    title: "How to build a B2B prospect list without buying low-quality leads",
    cluster: "Lead Generation",
    intent: "informational",
  },
  {
    title: "Cold email outreach mistakes that kill reply rates",
    cluster: "Outreach",
    intent: "informational",
  },
  {
    title: "Local business lead generation for Nigerian SMEs",
    cluster: "Nigeria Business",
    intent: "informational",
  },
  {
    title: "How to qualify sales leads before you spend hours on outreach",
    cluster: "Sales",
    intent: "informational",
  },
  {
    title: "WhatsApp vs email outreach for African business development",
    cluster: "Outreach",
    intent: "comparison",
  },
  {
    title: "What is LeadThur and how does business search work?",
    cluster: "LeadThur",
    intent: "entity",
  },
  {
    title: "Lead generation tools for freelancers who sell to local businesses",
    cluster: "Freelancing",
    intent: "commercial",
  },
  {
    title: "How sales teams should structure daily prospecting",
    cluster: "Sales",
    intent: "informational",
  },
];

function titleSimilarity(a: string, b: string): number {
  const ta = new Set(a.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2));
  const tb = new Set(b.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter += 1;
  return inter / Math.max(ta.size, tb.size);
}

export async function discoverTopics(limit = 8): Promise<ContentTopic[]> {
  const existingPosts = await listPublishedBlogSummaries(300);
  const created: ContentTopic[] = [];

  const ai = await callDeepSeekChat(
    `Propose ${limit} useful blog topics for LeadThur, a business-search and outreach product used by sales teams, freelancers, and Nigerian/African SMEs.

Return JSON only:
{
  "topics": [
    {
      "title": "...",
      "cluster": "Lead Generation|Outreach|Sales|Nigeria Business|Freelancing|Tools|LeadThur",
      "searchIntent": "...",
      "audience": "...",
      "rationale": "why useful"
    }
  ]
}

Rules:
- Topics must help a real reader solve a problem.
- No thin SEO keyword stuffing.
- Mix practical how-tos with a few LeadThur entity/explanation topics.
- Avoid duplicate intents.`,
    { max_tokens: 1800, temperature: 0.7, system: "You are an editorial strategist. Reply with valid JSON only." }
  );

  const parsed = ai.ok
    ? safeJsonParse<{
        topics?: Array<{
          title?: string;
          cluster?: string;
          searchIntent?: string;
          audience?: string;
          rationale?: string;
        }>;
      }>(ai.content)
    : null;

  const candidates = [
    ...(parsed?.topics || []).map((t) => ({
      title: String(t.title || "").trim(),
      cluster: String(t.cluster || "Lead Generation"),
      intent: String(t.searchIntent || "informational"),
      audience: String(t.audience || "business owners and sales teams"),
      rationale: String(t.rationale || ""),
      source: "deepseek",
    })),
    ...SEED_TOPICS.map((t) => ({
      title: t.title,
      cluster: t.cluster,
      intent: t.intent,
      audience: "business owners and sales teams",
      rationale: "Editorial seed topic",
      source: "seed",
    })),
  ].filter((t) => t.title.length > 12);

  for (const candidate of candidates) {
    if (created.length >= limit) break;

    const dupPost = existingPosts.find(
      (p) => titleSimilarity(p.title, candidate.title) >= 0.72
    );
    if (dupPost) {
      logger.info("Skipping topic with existing coverage", {
        topic: candidate.title.slice(0, 80),
      });
      continue;
    }

    const capability = pickLeadThurCapability(candidate.title, candidate.cluster);
    const score =
      55 +
      Math.min(25, candidate.title.split(" ").length) +
      (candidate.cluster.toLowerCase().includes("nigeria") ? 8 : 0) +
      (capability.id === "business_search" ? 6 : 4);

    const topic = await upsertTopic({
      title: candidate.title,
      slug_hint: slugify(candidate.title),
      cluster: candidate.cluster,
      search_intent: candidate.intent,
      audience: candidate.audience,
      score,
      status: score >= 60 ? "QUALIFIED" : "DISCOVERED",
      source: candidate.source,
      rationale: candidate.rationale,
      metadata: { capabilityId: capability.id },
    });
    created.push(topic);
  }

  return created;
}

export function isDuplicateIntent(
  title: string,
  existingTitles: string[],
  threshold = 0.72
): boolean {
  return existingTitles.some((t) => titleSimilarity(t, title) >= threshold);
}
