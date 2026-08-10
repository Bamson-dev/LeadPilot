import { supabase } from "../database/client";
import { DEFAULT_CONTENT_SETTINGS } from "./config";
import type {
  ContentAutomationSettings,
  ContentBrief,
  ContentJob,
  ContentJobStatus,
  ContentMeta,
  ContentSourceRow,
  ContentTopic,
  QualityResult,
} from "./types";

export async function getContentSettings(): Promise<ContentAutomationSettings> {
  const { data, error } = await supabase
    .from("content_automation_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    return {
      id: 1,
      ...DEFAULT_CONTENT_SETTINGS,
      last_scheduler_run_at: null,
      last_scheduler_result: null,
      last_scheduler_error: null,
      updated_at: new Date().toISOString(),
    };
  }
  return data as ContentAutomationSettings;
}

export async function updateContentSettings(
  patch: Partial<ContentAutomationSettings>
): Promise<ContentAutomationSettings> {
  const allowed = [
    "automation_enabled",
    "daily_article_target",
    "quality_threshold",
    "preferred_min_words",
    "preferred_max_words",
    "research_depth",
    "auto_image_generation",
    "auto_publishing",
    "leadthur_promotion",
    "enabled_categories",
    "max_generation_attempts",
    "max_retries",
    "daily_research_limit",
    "daily_image_limit",
    "publish_slot_hours",
    "launch_batch_remaining",
    "last_scheduler_run_at",
    "last_scheduler_result",
    "last_scheduler_error",
  ] as const;

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (patch[key] !== undefined) updates[key] = patch[key];
  }

  // Patch only — never re-apply DEFAULT_CONTENT_SETTINGS on update.
  // Upserting defaults was resetting automation_enabled/auto_publishing to false
  // on every scheduler heartbeat.
  const { data: existing } = await supabase
    .from("content_automation_settings")
    .select("id")
    .eq("id", 1)
    .maybeSingle();

  if (!existing) {
    const { data, error } = await supabase
      .from("content_automation_settings")
      .insert({ id: 1, ...DEFAULT_CONTENT_SETTINGS, ...updates })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as ContentAutomationSettings;
  }

  const { data, error } = await supabase
    .from("content_automation_settings")
    .update(updates)
    .eq("id", 1)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as ContentAutomationSettings;
}

export async function listPublishedBlogSummaries(limit = 200): Promise<
  Array<{ id: string; title: string; slug: string; category: string | null; excerpt: string | null }>
> {
  const { data, error } = await supabase
    .from("blog_posts")
    .select("id, title, slug, category, excerpt")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data || []) as Array<{
    id: string;
    title: string;
    slug: string;
    category: string | null;
    excerpt: string | null;
  }>;
}

export async function findSimilarTopics(title: string): Promise<ContentTopic[]> {
  const { data, error } = await supabase
    .from("content_topics")
    .select("*")
    .ilike("title", `%${title.slice(0, 48)}%`)
    .limit(10);
  if (error) throw new Error(error.message);
  return (data || []) as ContentTopic[];
}

export async function upsertTopic(input: {
  title: string;
  slug_hint?: string;
  cluster?: string;
  search_intent?: string;
  audience?: string;
  score: number;
  status?: string;
  source?: string;
  rationale?: string;
  metadata?: Record<string, unknown>;
}): Promise<ContentTopic> {
  const existing = await supabase
    .from("content_topics")
    .select("*")
    .ilike("title", input.title)
    .maybeSingle();

  if (existing.data) {
    const { data, error } = await supabase
      .from("content_topics")
      .update({
        score: input.score,
        cluster: input.cluster ?? existing.data.cluster,
        search_intent: input.search_intent ?? existing.data.search_intent,
        audience: input.audience ?? existing.data.audience,
        rationale: input.rationale ?? existing.data.rationale,
        metadata: input.metadata ?? existing.data.metadata,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as ContentTopic;
  }

  const { data, error } = await supabase
    .from("content_topics")
    .insert({
      title: input.title,
      slug_hint: input.slug_hint || null,
      cluster: input.cluster || null,
      search_intent: input.search_intent || null,
      audience: input.audience || null,
      score: input.score,
      status: input.status || "DISCOVERED",
      source: input.source || "automation",
      rationale: input.rationale || null,
      metadata: input.metadata || {},
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as ContentTopic;
}

export async function listTopics(status?: string, limit = 50): Promise<ContentTopic[]> {
  let query = supabase
    .from("content_topics")
    .select("*")
    .order("score", { ascending: false })
    .limit(limit);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []) as ContentTopic[];
}

export async function getTopicById(id: string): Promise<ContentTopic | null> {
  const { data, error } = await supabase
    .from("content_topics")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as ContentTopic | null;
}

export async function updateTopicStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase
    .from("content_topics")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createJob(input: {
  topic_id: string;
  idempotency_key: string;
  status?: ContentJobStatus;
}): Promise<ContentJob> {
  const existing = await supabase
    .from("content_jobs")
    .select("*")
    .eq("idempotency_key", input.idempotency_key)
    .maybeSingle();
  if (existing.data) return existing.data as ContentJob;

  const { data, error } = await supabase
    .from("content_jobs")
    .insert({
      topic_id: input.topic_id,
      idempotency_key: input.idempotency_key,
      status: input.status || "QUALIFIED",
      meta: {},
      quality_notes: {},
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as ContentJob;
}

export async function getJobById(id: string): Promise<ContentJob | null> {
  const { data, error } = await supabase
    .from("content_jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as ContentJob | null;
}

export async function listJobs(status?: ContentJobStatus, limit = 50): Promise<ContentJob[]> {
  let query = supabase
    .from("content_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []) as ContentJob[];
}

export async function updateJob(
  id: string,
  patch: Partial<{
    status: ContentJobStatus;
    blog_post_id: string | null;
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
    scheduled_for: string | null;
    published_at: string | null;
    error_message: string | null;
    last_error_at: string | null;
  }>
): Promise<ContentJob> {
  const { data, error } = await supabase
    .from("content_jobs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as ContentJob;
}

export async function replaceJobSources(
  jobId: string,
  sources: ContentSourceRow[]
): Promise<void> {
  await supabase.from("content_sources").delete().eq("job_id", jobId);
  if (!sources.length) return;
  const { error } = await supabase.from("content_sources").insert(
    sources.map((s) => ({
      job_id: jobId,
      provider: s.provider,
      title: s.title,
      url: s.url,
      snippet: s.snippet,
      score: s.score ?? null,
      raw: {},
    }))
  );
  if (error) throw new Error(error.message);
}

export async function listJobSources(jobId: string): Promise<ContentSourceRow[]> {
  const { data, error } = await supabase
    .from("content_sources")
    .select("title, url, snippet, provider, score")
    .eq("job_id", jobId);
  if (error) throw new Error(error.message);
  return (data || []) as ContentSourceRow[];
}

export async function recordGenerationRun(input: {
  job_id: string;
  stage: string;
  provider?: string;
  latency_ms?: number;
  success: boolean;
  error_category?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.from("content_generation_runs").insert({
    job_id: input.job_id,
    stage: input.stage,
    provider: input.provider || null,
    latency_ms: input.latency_ms ?? null,
    success: input.success,
    error_category: input.error_category || null,
    metadata: input.metadata || {},
  });
  if (error) throw new Error(error.message);
}

export async function recordQualityCheck(
  jobId: string,
  result: QualityResult
): Promise<void> {
  const { error } = await supabase.from("content_quality_checks").insert({
    job_id: jobId,
    score: result.score,
    passed: result.passed,
    breakdown: result.breakdown,
    feedback: result.feedback,
  });
  if (error) throw new Error(error.message);
}

export async function countJobsSince(
  sinceIso: string,
  statuses?: ContentJobStatus[]
): Promise<number> {
  let query = supabase
    .from("content_jobs")
    .select("id", { count: "exact", head: true })
    .gte("created_at", sinceIso);
  if (statuses?.length) query = query.in("status", statuses);
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function countPublishedToday(): Promise<number> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const { count, error } = await supabase
    .from("content_jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "PUBLISHED")
    .gte("published_at", start.toISOString());
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function countImagesToday(): Promise<number> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const { count, error } = await supabase
    .from("content_generation_runs")
    .select("id", { count: "exact", head: true })
    .eq("stage", "image_generation")
    .eq("success", true)
    .gte("created_at", start.toISOString());
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function countResearchToday(): Promise<number> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const { count, error } = await supabase
    .from("content_generation_runs")
    .select("id", { count: "exact", head: true })
    .eq("stage", "research")
    .gte("created_at", start.toISOString());
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function createBlogPostDraft(input: {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_image?: string | null;
  category: string;
  tags: string[];
  meta_title: string;
  meta_description: string;
  status?: "draft" | "published";
}): Promise<{ id: string; slug: string; status: string }> {
  const now = new Date().toISOString();
  const status = input.status || "draft";
  const { data, error } = await supabase
    .from("blog_posts")
    .insert({
      title: input.title,
      slug: input.slug,
      excerpt: input.excerpt,
      content: input.content,
      cover_image: input.cover_image || null,
      author: "Bamidele Matthew",
      author_title: "Founder, LeadThur",
      category: input.category,
      tags: input.tags,
      meta_title: input.meta_title,
      meta_description: input.meta_description,
      status,
      featured: false,
      read_time: Math.max(1, Math.ceil(input.content.split(/\s+/).length / 200)),
      published_at: status === "published" ? now : null,
      created_at: now,
      updated_at: now,
    })
    .select("id, slug, status")
    .single();

  if (error) throw new Error(error.message);
  return data as { id: string; slug: string; status: string };
}

export async function publishBlogPost(postId: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("blog_posts")
    .update({ status: "published", published_at: now, updated_at: now })
    .eq("id", postId);
  if (error) throw new Error(error.message);
}

export async function updateBlogPostCover(
  postId: string,
  coverImage: string
): Promise<void> {
  const { error } = await supabase
    .from("blog_posts")
    .update({ cover_image: coverImage, updated_at: new Date().toISOString() })
    .eq("id", postId);
  if (error) throw new Error(error.message);
}

export async function ensurePerformanceRow(
  blogPostId: string,
  jobId?: string
): Promise<void> {
  const { error } = await supabase.from("content_performance").upsert(
    {
      blog_post_id: blogPostId,
      job_id: jobId || null,
      lifecycle: "PUBLISHED",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "blog_post_id" }
  );
  if (error) throw new Error(error.message);
}

export async function getDashboardCounts(): Promise<{
  topicsWaiting: number;
  drafts: number;
  scheduled: number;
  published: number;
  failed: number;
  generatedToday: number;
  publishedToday: number;
}> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const since = start.toISOString();

  const [topics, drafts, scheduled, published, failed, generatedToday, publishedToday] =
    await Promise.all([
      supabase
        .from("content_topics")
        .select("id", { count: "exact", head: true })
        .in("status", ["DISCOVERED", "QUALIFIED"]),
      supabase
        .from("content_jobs")
        .select("id", { count: "exact", head: true })
        .in("status", ["READY", "BRIEF_READY", "QUALITY_CHECK", "IMAGE_GENERATION"]),
      supabase
        .from("content_jobs")
        .select("id", { count: "exact", head: true })
        .eq("status", "SCHEDULED"),
      supabase
        .from("content_jobs")
        .select("id", { count: "exact", head: true })
        .eq("status", "PUBLISHED"),
      supabase
        .from("content_jobs")
        .select("id", { count: "exact", head: true })
        .eq("status", "FAILED"),
      supabase
        .from("content_jobs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since),
      countPublishedToday(),
    ]);

  return {
    topicsWaiting: topics.count ?? 0,
    drafts: drafts.count ?? 0,
    scheduled: scheduled.count ?? 0,
    published: published.count ?? 0,
    failed: failed.count ?? 0,
    generatedToday: generatedToday.count ?? 0,
    publishedToday,
  };
}
