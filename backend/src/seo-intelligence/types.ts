export const SEO_OPPORTUNITY_TYPES = [
  "high_impression_low_ctr",
  "positions_4_to_20",
  "high_impression_query_low_ctr",
  "declining_performance",
  "rising_content",
  "query_article_mismatch",
  "content_depth_gap",
] as const;

export type SeoOpportunityType = (typeof SEO_OPPORTUNITY_TYPES)[number];

export const SEO_OPPORTUNITY_STATUSES = [
  "NEW",
  "ANALYZING",
  "RECOMMENDED",
  "OPTIMIZATION_PENDING",
  "OPTIMIZING",
  "QUALITY_CHECK",
  "PUBLISHED",
  "MONITORING",
  "COMPLETED",
  "FAILED",
  "SKIPPED",
] as const;

export type SeoOpportunityStatus = (typeof SEO_OPPORTUNITY_STATUSES)[number];

export const SEO_JOB_STATUSES = [
  "PENDING",
  "RESEARCHING",
  "GENERATING",
  "QUALITY_CHECK",
  "VALIDATING",
  "PUBLISHED",
  "MONITORING",
  "COMPLETED",
  "FAILED",
  "SKIPPED",
  "ROLLED_BACK",
] as const;

export type SeoJobStatus = (typeof SEO_JOB_STATUSES)[number];

export type SeoResultClassification =
  | "IMPROVED"
  | "STABLE"
  | "DECLINED"
  | "INSUFFICIENT_DATA";

export type SeoOptimizationSettings = {
  id: number;
  seo_optimization_enabled: boolean;
  max_optimizations_per_day: number;
  cooldown_days: number;
  first_run_completed: boolean;
  last_analysis_at: string | null;
  last_optimization_at: string | null;
  last_scheduler_run_at: string | null;
  last_scheduler_result: string | null;
  last_scheduler_error: string | null;
  created_at: string;
  updated_at: string;
};

export type SeoQueryEvidence = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type SeoOpportunity = {
  id: string;
  blog_post_id: string | null;
  page_url: string;
  opportunity_type: SeoOpportunityType;
  status: SeoOpportunityStatus;
  opportunity_score: number;
  score_reasons: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  clicks_prev: number | null;
  impressions_prev: number | null;
  ctr_prev: number | null;
  position_prev: number | null;
  top_queries: SeoQueryEvidence[];
  recommended_action: string | null;
  evidence: Record<string, unknown>;
  fingerprint: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
};

export type SeoOptimizationJob = {
  id: string;
  opportunity_id: string;
  blog_post_id: string;
  page_url: string;
  status: SeoJobStatus;
  optimization_types: string[];
  research_summary: string | null;
  research_sources: unknown[];
  ai_reasoning: string | null;
  proposed_title: string | null;
  proposed_meta_description: string | null;
  proposed_content: string | null;
  quality_score_before: number | null;
  quality_score_after: number | null;
  seo_score_before: number | null;
  seo_score_after: number | null;
  change_summary: Record<string, unknown>;
  validation_notes: string[];
  error_message: string | null;
  published_at: string | null;
  monitoring_started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BlogPostRecord = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  cover_image: string | null;
  category: string | null;
  tags: string[] | null;
  meta_title: string | null;
  meta_description: string | null;
  status: string;
  published_at: string | null;
};

export type OptimizationProposal = {
  title: string;
  metaDescription: string;
  excerpt: string;
  contentHtml: string;
  optimizationTypes: string[];
  reasoning: string;
  changes: string[];
};
