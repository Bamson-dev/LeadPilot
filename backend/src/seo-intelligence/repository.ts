import { createHash } from "crypto";
import { supabase } from "../database/client";
import type {
  BlogPostRecord,
  SeoJobStatus,
  SeoOpportunity,
  SeoOpportunityStatus,
  SeoOpportunityType,
  SeoOptimizationJob,
  SeoOptimizationSettings,
  SeoQueryEvidence,
  SeoResultClassification,
} from "./types";

const DEFAULT_SETTINGS: Omit<
  SeoOptimizationSettings,
  "id" | "created_at" | "updated_at"
> = {
  seo_optimization_enabled: true,
  max_optimizations_per_day: 2,
  cooldown_days: 28,
  first_run_completed: false,
  last_analysis_at: null,
  last_optimization_at: null,
  last_scheduler_run_at: null,
  last_scheduler_result: null,
  last_scheduler_error: null,
};

export function publicBlogUrl(slug: string): string {
  return `https://www.leadthur.com/blog/${slug}`;
}

export function fingerprintOpportunity(
  pageUrl: string,
  type: SeoOpportunityType,
  blogPostId?: string | null
): string {
  return createHash("sha256")
    .update(`${pageUrl}|${type}|${blogPostId || ""}`)
    .digest("hex")
    .slice(0, 40);
}

export async function getSeoSettings(): Promise<SeoOptimizationSettings> {
  const { data, error } = await supabase
    .from("seo_optimization_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    const now = new Date().toISOString();
    return { id: 1, ...DEFAULT_SETTINGS, created_at: now, updated_at: now };
  }
  return data as SeoOptimizationSettings;
}

export async function updateSeoSettings(
  patch: Partial<SeoOptimizationSettings>
): Promise<SeoOptimizationSettings> {
  const allowed = [
    "seo_optimization_enabled",
    "max_optimizations_per_day",
    "cooldown_days",
    "first_run_completed",
    "last_analysis_at",
    "last_optimization_at",
    "last_scheduler_run_at",
    "last_scheduler_result",
    "last_scheduler_error",
  ] as const;
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (patch[key] !== undefined) updates[key] = patch[key];
  }
  const { data: existing } = await supabase
    .from("seo_optimization_settings")
    .select("id")
    .eq("id", 1)
    .maybeSingle();
  if (!existing) {
    const { data, error } = await supabase
      .from("seo_optimization_settings")
      .insert({ id: 1, ...DEFAULT_SETTINGS, ...updates })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as SeoOptimizationSettings;
  }
  const { data, error } = await supabase
    .from("seo_optimization_settings")
    .update(updates)
    .eq("id", 1)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as SeoOptimizationSettings;
}

export async function getPublishedBlogPostBySlug(
  slug: string
): Promise<BlogPostRecord | null> {
  const { data, error } = await supabase
    .from("blog_posts")
    .select(
      "id,title,slug,excerpt,content,cover_image,category,tags,meta_title,meta_description,status,published_at"
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as BlogPostRecord | null) || null;
}

export async function getPublishedBlogPostById(
  id: string
): Promise<BlogPostRecord | null> {
  const { data, error } = await supabase
    .from("blog_posts")
    .select(
      "id,title,slug,excerpt,content,cover_image,category,tags,meta_title,meta_description,status,published_at"
    )
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as BlogPostRecord | null) || null;
}

export async function listPublishedBlogPosts(
  limit = 300
): Promise<BlogPostRecord[]> {
  const { data, error } = await supabase
    .from("blog_posts")
    .select(
      "id,title,slug,excerpt,content,cover_image,category,tags,meta_title,meta_description,status,published_at"
    )
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data || []) as BlogPostRecord[];
}

export async function updatePublishedBlogPostContent(
  id: string,
  patch: {
    title: string;
    excerpt: string;
    content: string;
    meta_title: string;
    meta_description: string;
  }
): Promise<BlogPostRecord> {
  // Slug is intentionally never updated — URL stability.
  const readTime = Math.max(1, Math.ceil(patch.content.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length / 200));
  const { data, error } = await supabase
    .from("blog_posts")
    .update({
      title: patch.title,
      excerpt: patch.excerpt,
      content: patch.content,
      meta_title: patch.meta_title,
      meta_description: patch.meta_description,
      read_time: readTime,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "published")
    .select(
      "id,title,slug,excerpt,content,cover_image,category,tags,meta_title,meta_description,status,published_at"
    )
    .single();
  if (error) throw new Error(error.message);
  return data as BlogPostRecord;
}

export async function upsertOpportunity(input: {
  blog_post_id: string | null;
  page_url: string;
  opportunity_type: SeoOpportunityType;
  opportunity_score: number;
  score_reasons: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  clicks_prev?: number | null;
  impressions_prev?: number | null;
  ctr_prev?: number | null;
  position_prev?: number | null;
  top_queries: SeoQueryEvidence[];
  recommended_action: string;
  evidence: Record<string, unknown>;
}): Promise<SeoOpportunity> {
  const fingerprint = fingerprintOpportunity(
    input.page_url,
    input.opportunity_type,
    input.blog_post_id
  );
  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from("seo_opportunities")
    .select("*")
    .eq("fingerprint", fingerprint)
    .maybeSingle();

  if (existing) {
    // Do not regress terminal/in-flight statuses back to NEW.
    const keepStatus = [
      "OPTIMIZING",
      "QUALITY_CHECK",
      "PUBLISHED",
      "MONITORING",
      "COMPLETED",
      "OPTIMIZATION_PENDING",
    ].includes(String(existing.status));
    const { data, error } = await supabase
      .from("seo_opportunities")
      .update({
        blog_post_id: input.blog_post_id,
        opportunity_score: input.opportunity_score,
        score_reasons: input.score_reasons,
        clicks: input.clicks,
        impressions: input.impressions,
        ctr: input.ctr,
        position: input.position,
        clicks_prev: input.clicks_prev ?? null,
        impressions_prev: input.impressions_prev ?? null,
        ctr_prev: input.ctr_prev ?? null,
        position_prev: input.position_prev ?? null,
        top_queries: input.top_queries,
        recommended_action: input.recommended_action,
        evidence: input.evidence,
        last_seen_at: now,
        updated_at: now,
        status: keepStatus ? existing.status : "RECOMMENDED",
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as SeoOpportunity;
  }

  const { data, error } = await supabase
    .from("seo_opportunities")
    .insert({
      blog_post_id: input.blog_post_id,
      page_url: input.page_url,
      opportunity_type: input.opportunity_type,
      status: "RECOMMENDED",
      opportunity_score: input.opportunity_score,
      score_reasons: input.score_reasons,
      clicks: input.clicks,
      impressions: input.impressions,
      ctr: input.ctr,
      position: input.position,
      clicks_prev: input.clicks_prev ?? null,
      impressions_prev: input.impressions_prev ?? null,
      ctr_prev: input.ctr_prev ?? null,
      position_prev: input.position_prev ?? null,
      top_queries: input.top_queries,
      recommended_action: input.recommended_action,
      evidence: input.evidence,
      fingerprint,
      last_seen_at: now,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as SeoOpportunity;
}

export async function listOpportunities(input?: {
  status?: SeoOpportunityStatus;
  limit?: number;
}): Promise<SeoOpportunity[]> {
  let q = supabase
    .from("seo_opportunities")
    .select("*")
    .order("opportunity_score", { ascending: false })
    .limit(input?.limit ?? 100);
  if (input?.status) q = q.eq("status", input.status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []) as SeoOpportunity[];
}

export async function getOpportunity(id: string): Promise<SeoOpportunity | null> {
  const { data, error } = await supabase
    .from("seo_opportunities")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SeoOpportunity | null) || null;
}

export async function updateOpportunityStatus(
  id: string,
  status: SeoOpportunityStatus,
  extra?: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase
    .from("seo_opportunities")
    .update({ status, updated_at: new Date().toISOString(), ...(extra || {}) })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createOptimizationJob(input: {
  opportunity_id: string;
  blog_post_id: string;
  page_url: string;
}): Promise<SeoOptimizationJob> {
  const { data, error } = await supabase
    .from("seo_optimization_jobs")
    .insert({
      opportunity_id: input.opportunity_id,
      blog_post_id: input.blog_post_id,
      page_url: input.page_url,
      status: "PENDING",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as SeoOptimizationJob;
}

export async function updateOptimizationJob(
  id: string,
  patch: Partial<SeoOptimizationJob> & { status?: SeoJobStatus }
): Promise<SeoOptimizationJob> {
  const { data, error } = await supabase
    .from("seo_optimization_jobs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as SeoOptimizationJob;
}

export async function getOptimizationJob(
  id: string
): Promise<SeoOptimizationJob | null> {
  const { data, error } = await supabase
    .from("seo_optimization_jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SeoOptimizationJob | null) || null;
}

export async function listOptimizationJobs(limit = 50): Promise<SeoOptimizationJob[]> {
  const { data, error } = await supabase
    .from("seo_optimization_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data || []) as SeoOptimizationJob[];
}

export async function countOptimizationsSince(iso: string): Promise<number> {
  const { count, error } = await supabase
    .from("seo_optimization_jobs")
    .select("id", { count: "exact", head: true })
    .gte("created_at", iso)
    .in("status", ["PUBLISHED", "MONITORING", "COMPLETED", "GENERATING", "QUALITY_CHECK", "VALIDATING", "RESEARCHING"]);
  if (error) throw new Error(error.message);
  return count || 0;
}

export async function saveArticleVersion(input: {
  blog_post_id: string;
  optimization_job_id: string;
  opportunity_id: string;
  original: BlogPostRecord;
  optimized: {
    title: string;
    meta_title: string;
    meta_description: string;
    excerpt: string;
    content: string;
  };
  quality_score: number;
  seo_score: number;
  reason: string;
  published: boolean;
}): Promise<string> {
  const { data, error } = await supabase
    .from("seo_article_versions")
    .insert({
      blog_post_id: input.blog_post_id,
      optimization_job_id: input.optimization_job_id,
      opportunity_id: input.opportunity_id,
      original_title: input.original.title,
      original_meta_title: input.original.meta_title,
      original_meta_description: input.original.meta_description,
      original_excerpt: input.original.excerpt,
      original_content: input.original.content,
      optimized_title: input.optimized.title,
      optimized_meta_title: input.optimized.meta_title,
      optimized_meta_description: input.optimized.meta_description,
      optimized_excerpt: input.optimized.excerpt,
      optimized_content: input.optimized.content,
      quality_score: input.quality_score,
      seo_score: input.seo_score,
      reason: input.reason,
      published: input.published,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function getLatestVersionForJob(jobId: string) {
  const { data, error } = await supabase
    .from("seo_article_versions")
    .select("*")
    .eq("optimization_job_id", jobId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function restoreArticleFromVersion(versionId: string): Promise<void> {
  const { data: version, error } = await supabase
    .from("seo_article_versions")
    .select("*")
    .eq("id", versionId)
    .single();
  if (error) throw new Error(error.message);
  await updatePublishedBlogPostContent(version.blog_post_id, {
    title: version.original_title,
    excerpt: version.original_excerpt || "",
    content: version.original_content,
    meta_title: version.original_meta_title || version.original_title,
    meta_description: version.original_meta_description || "",
  });
  await supabase
    .from("seo_article_versions")
    .update({ restored: true })
    .eq("id", versionId);
}

export async function setCooldown(
  blogPostId: string,
  cooldownDays: number,
  jobId: string
): Promise<void> {
  const last = new Date();
  const next = new Date(last.getTime() + cooldownDays * 24 * 60 * 60 * 1000);
  const { error } = await supabase.from("seo_article_cooldowns").upsert(
    {
      blog_post_id: blogPostId,
      last_optimized_at: last.toISOString(),
      next_eligible_optimization_at: next.toISOString(),
      last_optimization_job_id: jobId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "blog_post_id" }
  );
  if (error) throw new Error(error.message);
}

export async function isInCooldown(blogPostId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("seo_article_cooldowns")
    .select("next_eligible_optimization_at")
    .eq("blog_post_id", blogPostId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.next_eligible_optimization_at) return false;
  return new Date(data.next_eligible_optimization_at).getTime() > Date.now();
}

export async function upsertOptimizationResult(input: {
  optimization_job_id: string;
  blog_post_id: string;
  classification: SeoResultClassification;
  baseline_clicks: number;
  baseline_impressions: number;
  baseline_ctr: number;
  baseline_position: number;
  observed_clicks?: number | null;
  observed_impressions?: number | null;
  observed_ctr?: number | null;
  observed_position?: number | null;
  window_days?: number;
  notes?: string;
}): Promise<void> {
  const { error } = await supabase.from("seo_optimization_results").upsert(
    {
      optimization_job_id: input.optimization_job_id,
      blog_post_id: input.blog_post_id,
      classification: input.classification,
      baseline_clicks: input.baseline_clicks,
      baseline_impressions: input.baseline_impressions,
      baseline_ctr: input.baseline_ctr,
      baseline_position: input.baseline_position,
      observed_clicks: input.observed_clicks ?? null,
      observed_impressions: input.observed_impressions ?? null,
      observed_ctr: input.observed_ctr ?? null,
      observed_position: input.observed_position ?? null,
      window_days: input.window_days ?? 28,
      notes: input.notes ?? null,
      evaluated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "optimization_job_id" }
  );
  if (error) throw new Error(error.message);
}

export async function listMonitoringJobs(): Promise<SeoOptimizationJob[]> {
  const { data, error } = await supabase
    .from("seo_optimization_jobs")
    .select("*")
    .eq("status", "MONITORING")
    .order("published_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as SeoOptimizationJob[];
}

export async function getOverviewStats() {
  const [opps, jobs, monitoring, improved] = await Promise.all([
    supabase.from("seo_opportunities").select("id", { count: "exact", head: true }),
    supabase
      .from("seo_opportunities")
      .select("id", { count: "exact", head: true })
      .gte("opportunity_score", 70),
    supabase
      .from("seo_optimization_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "MONITORING"),
    supabase
      .from("seo_optimization_results")
      .select("id", { count: "exact", head: true })
      .eq("classification", "IMPROVED"),
  ]);
  return {
    totalOpportunities: opps.count || 0,
    highPriorityOpportunities: jobs.count || 0,
    monitoring: monitoring.count || 0,
    improved: improved.count || 0,
  };
}
