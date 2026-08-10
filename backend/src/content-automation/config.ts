import type { ContentAutomationSettings } from "./types";

export const DEFAULT_CONTENT_SETTINGS: Omit<ContentAutomationSettings, "id" | "updated_at"> = {
  automation_enabled: false,
  daily_article_target: 4,
  quality_threshold: 90,
  preferred_min_words: 2500,
  preferred_max_words: 4500,
  research_depth: "standard",
  auto_image_generation: true,
  auto_publishing: false,
  leadthur_promotion: true,
  enabled_categories: [
    "Lead Generation",
    "Cold Outreach",
    "Nigeria Business",
    "Tools and Software",
    "Freelancing",
    "SMMA",
  ],
  max_generation_attempts: 3,
  max_retries: 3,
  daily_research_limit: 40,
  daily_image_limit: 8,
  publish_slot_hours: [8, 12, 16, 20],
  launch_batch_remaining: 0,
};

export function getTavilyApiKey(): string | null {
  return process.env.TAVILY_API_KEY?.trim() || null;
}

export function getSerperApiKey(): string | null {
  return process.env.SERPER_API_KEY?.trim() || null;
}

export function getOpenAiApiKey(): string | null {
  return process.env.OPENAI_API_KEY?.trim() || null;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

export function countWords(htmlOrText: string): number {
  const text = htmlOrText
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return 0;
  return text.split(" ").filter(Boolean).length;
}

export function stripCodeFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json|html|markdown)?\s*([\s\S]*?)```$/i);
  return (fenced?.[1] || trimmed).trim();
}

export function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(stripCodeFences(raw)) as T;
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}
