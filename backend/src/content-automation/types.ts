export const CONTENT_JOB_STATUSES = [
  "DISCOVERED",
  "QUALIFIED",
  "RESEARCHING",
  "BRIEF_READY",
  "GENERATING",
  "QUALITY_CHECK",
  "REVISING",
  "IMAGE_GENERATION",
  "READY",
  "SCHEDULED",
  "PUBLISHED",
  "FAILED",
  "RETRYING",
] as const;

export type ContentJobStatus = (typeof CONTENT_JOB_STATUSES)[number];

export const PUBLISHABLE_STATUSES: ContentJobStatus[] = ["READY", "SCHEDULED"];

export interface ContentAutomationSettings {
  id: number;
  automation_enabled: boolean;
  daily_article_target: number;
  quality_threshold: number;
  preferred_min_words: number;
  preferred_max_words: number;
  research_depth: "light" | "standard" | "deep";
  auto_image_generation: boolean;
  auto_publishing: boolean;
  leadthur_promotion: boolean;
  enabled_categories: string[];
  max_generation_attempts: number;
  max_retries: number;
  daily_research_limit: number;
  daily_image_limit: number;
  publish_slot_hours: number[];
  publishing_interval_hours: number;
  last_publication_at: string | null;
  next_scheduled_publication_at: string | null;
  image_storage_provider: "local" | "supabase" | "auto";
  last_image_storage_at: string | null;
  last_image_storage_error: string | null;
  launch_batch_remaining: number;
  last_scheduler_run_at: string | null;
  last_scheduler_result: string | null;
  last_scheduler_error: string | null;
  updated_at: string;
}

export interface ContentTopic {
  id: string;
  title: string;
  slug_hint: string | null;
  cluster: string | null;
  search_intent: string | null;
  audience: string | null;
  score: number;
  status: string;
  source: string | null;
  rationale: string | null;
  duplicate_of_post_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ContentJob {
  id: string;
  topic_id: string | null;
  blog_post_id: string | null;
  status: ContentJobStatus;
  idempotency_key: string;
  attempt_count: number;
  quality_score: number | null;
  quality_notes: Record<string, unknown>;
  brief: ContentBrief | null;
  research_summary: string | null;
  article_html: string | null;
  meta: ContentMeta;
  leadthur_cta: string | null;
  image_status: string | null;
  image_alt: string | null;
  image_storage_provider: string | null;
  scheduled_for: string | null;
  published_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContentSourceRow {
  title: string;
  url: string;
  snippet: string;
  provider: "tavily" | "serper" | "manual";
  score?: number;
}

export interface ContentBrief {
  topic: string;
  searchIntent: string;
  targetReader: string;
  readerProblem: string;
  proposedTitle: string;
  articleAngle: string;
  outline: string[];
  keyQuestions: string[];
  importantFacts: string[];
  statistics: Array<{ claim: string; sourceUrl?: string }>;
  researchSources: ContentSourceRow[];
  examples: string[];
  leadthurCapability: string;
  potentialCta: string;
  internalLinkSuggestions: Array<{ title: string; slug: string; reason: string }>;
  externalReferences: Array<{ title: string; url: string }>;
  imageConcept: string;
  category: string;
  tags: string[];
  targetWordCount: number;
}

export interface ContentMeta {
  title?: string;
  slug?: string;
  excerpt?: string;
  metaTitle?: string;
  metaDescription?: string;
  category?: string;
  tags?: string[];
  ogTitle?: string;
  ogDescription?: string;
  coverImage?: string | null;
  imageAlt?: string | null;
  wordCount?: number;
  seoScore?: number;
}

export interface QualityResult {
  score: number;
  passed: boolean;
  breakdown: Record<string, number>;
  feedback: string;
}

export interface ProviderStatus {
  deepseek: "connected" | "error" | "missing";
  tavily: "connected" | "error" | "missing";
  serper: "connected" | "error" | "missing";
  openai: "connected" | "error" | "missing";
}
