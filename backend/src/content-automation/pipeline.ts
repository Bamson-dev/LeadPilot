import { isDeepseekConfigured } from "../utils/deepseek-config";
import { getOpenAiApiKey, getSerperApiKey, getTavilyApiKey } from "./config";
import { buildContentBrief, buildMetadataFromBrief, generateArticleHtml, reviseArticleHtml, scoreArticleQuality } from "./generate";
import { generateArticleImage } from "./providers/openai-image";
import { pickLeadThurCapability } from "./product-facts";
import { gatherResearchSources } from "./research";
import { computeSeoReadiness } from "./seo-score";
import {
  countImagesToday,
  countPublishedToday,
  countResearchToday,
  createBlogPostDraft,
  createJob,
  ensurePerformanceRow,
  getContentSettings,
  getJobById,
  getTopicById,
  listJobs,
  listPublishedBlogSummaries,
  publishBlogPost,
  recordGenerationRun,
  recordQualityCheck,
  replaceJobSources,
  updateBlogPostCover,
  updateJob,
  updateTopicStatus,
} from "./repository";
import { discoverTopics } from "./topic-discovery";
import type { ContentJob, ProviderStatus } from "./types";
import { logger } from "../utils/logger";

export function getProviderStatus(): ProviderStatus {
  return {
    deepseek: isDeepseekConfigured() ? "connected" : "missing",
    tavily: getTavilyApiKey() ? "connected" : "missing",
    serper: getSerperApiKey() ? "connected" : "missing",
    openai: getOpenAiApiKey() ? "connected" : "missing",
  };
}

export async function createJobForTopic(topicId: string): Promise<ContentJob> {
  const topic = await getTopicById(topicId);
  if (!topic) throw new Error("Topic not found");
  const idempotencyKey = `topic:${topicId}:v1`;
  const job = await createJob({
    topic_id: topicId,
    idempotency_key: idempotencyKey,
    status: "QUALIFIED",
  });
  await updateTopicStatus(topicId, "IN_PROGRESS");
  return job;
}

export async function runContentJob(
  jobId: string,
  options: { publish?: boolean; skipImage?: boolean } = {}
): Promise<ContentJob> {
  let job = await getJobById(jobId);
  if (!job) throw new Error("Job not found");

  if (job.status === "PUBLISHED") return job;

  const settings = await getContentSettings();
  const topic = job.topic_id ? await getTopicById(job.topic_id) : null;
  if (!topic) {
    return updateJob(jobId, {
      status: "FAILED",
      error_message: "Missing topic",
      last_error_at: new Date().toISOString(),
    });
  }

  try {
    // RESEARCH
    job = await updateJob(jobId, {
      status: "RESEARCHING",
      attempt_count: job.attempt_count + 1,
      error_message: null,
    });

    const researchCount = await countResearchToday();
    if (researchCount >= settings.daily_research_limit) {
      throw new Error("Daily research limit reached");
    }

    const researchStarted = Date.now();
    const research = await gatherResearchSources(topic.title, settings.research_depth);
    await replaceJobSources(jobId, research.sources);
    await recordGenerationRun({
      job_id: jobId,
      stage: "research",
      provider: research.providersUsed.join(",") || "none",
      latency_ms: Date.now() - researchStarted,
      success: research.sources.length > 0,
      error_category: research.sources.length ? undefined : research.errors.join(","),
      metadata: { sourceCount: research.sources.length },
    });

    const posts = await listPublishedBlogSummaries(100);
    const briefStarted = Date.now();
    const brief = await buildContentBrief({
      topic: topic.title,
      cluster: topic.cluster,
      intent: topic.search_intent,
      audience: topic.audience,
      sources: research.sources,
      existingInternalLinks: posts.map((p) => ({ title: p.title, slug: p.slug })),
      minWords: settings.preferred_min_words,
      maxWords: settings.preferred_max_words,
      categoryOptions: settings.enabled_categories,
    });
    await recordGenerationRun({
      job_id: jobId,
      stage: "brief",
      provider: "deepseek",
      latency_ms: Date.now() - briefStarted,
      success: true,
    });

    job = await updateJob(jobId, {
      status: "BRIEF_READY",
      brief,
      research_summary: research.sources
        .slice(0, 5)
        .map((s) => `${s.title}: ${s.url}`)
        .join("\n"),
    });

    // GENERATE
    job = await updateJob(jobId, { status: "GENERATING" });
    const genStarted = Date.now();
    let html = await generateArticleHtml(brief);
    await recordGenerationRun({
      job_id: jobId,
      stage: "generation",
      provider: "deepseek",
      latency_ms: Date.now() - genStarted,
      success: true,
      metadata: { chars: html.length },
    });

    // QUALITY + REVISE
    job = await updateJob(jobId, { status: "QUALITY_CHECK", article_html: html });
    let quality = await scoreArticleQuality({
      html,
      brief,
      hasImage: false,
      threshold: settings.quality_threshold,
    });
    await recordQualityCheck(jobId, quality);

    let attempts = 0;
    while (!quality.passed && attempts < settings.max_generation_attempts) {
      attempts += 1;
      job = await updateJob(jobId, { status: "REVISING" });
      const revStarted = Date.now();
      html = await reviseArticleHtml(html, quality.feedback, brief);
      await recordGenerationRun({
        job_id: jobId,
        stage: "revision",
        provider: "deepseek",
        latency_ms: Date.now() - revStarted,
        success: true,
        metadata: { attempt: attempts },
      });
      job = await updateJob(jobId, { status: "QUALITY_CHECK", article_html: html });
      quality = await scoreArticleQuality({
        html,
        brief,
        hasImage: false,
        threshold: settings.quality_threshold,
      });
      await recordQualityCheck(jobId, quality);
    }

    if (!quality.passed) {
      return updateJob(jobId, {
        status: "FAILED",
        quality_score: quality.score,
        quality_notes: quality.breakdown,
        article_html: html,
        error_message: `Quality score ${quality.score} below threshold ${settings.quality_threshold}`,
        last_error_at: new Date().toISOString(),
      });
    }

    // IMAGE
    let coverImage: string | null = null;
    let imageAlt: string | null = null;
    let imageStatus = "skipped";
    if (settings.auto_image_generation && !options.skipImage) {
      const imagesToday = await countImagesToday();
      if (imagesToday < settings.daily_image_limit) {
        job = await updateJob(jobId, { status: "IMAGE_GENERATION" });
        const imgStarted = Date.now();
        const imagePrompt = `Professional editorial blog header image, no text overlays, clean modern style: ${brief.imageConcept}`;
        const image = await generateArticleImage(imagePrompt, {
          slugHint: brief.proposedTitle,
        });
        await recordGenerationRun({
          job_id: jobId,
          stage: "image_generation",
          provider: "openai",
          latency_ms: Date.now() - imgStarted,
          success: image.ok,
          error_category: image.ok ? undefined : image.reason,
          metadata: image.ok
            ? { model: image.model }
            : image.probe
              ? {
                  modelTried: image.probe.modelTried,
                  httpStatus: image.probe.httpStatus,
                  openaiCode: image.probe.openaiCode,
                  openaiType: image.probe.openaiType,
                  openaiMessage: image.probe.openaiMessage,
                }
              : { reason: image.reason },
        });
        if (image.ok) {
          coverImage = image.imageUrl;
          imageAlt = `${brief.proposedTitle} — editorial illustration`;
          imageStatus = "generated";
        } else {
          imageStatus = `failed:${image.reason}`;
          logger.warn("Continuing without image", { reason: image.reason });
        }
      } else {
        imageStatus = "daily_limit";
      }
    }

    const meta = buildMetadataFromBrief(brief, html);
    const capability = pickLeadThurCapability(brief.topic, brief.category);

    // Ensure unique slug
    let slug = meta.slug;
    const existingSlug = posts.find((p) => p.slug === slug);
    if (existingSlug) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    const seo = computeSeoReadiness({
      html,
      brief,
      meta: { ...meta, slug },
      hasImage: Boolean(coverImage),
      imageAlt,
      sourceCount: research.sources.length,
    });

    const post = await createBlogPostDraft({
      title: meta.title,
      slug,
      excerpt: meta.excerpt,
      content: html,
      cover_image: coverImage,
      category: meta.category,
      tags: meta.tags,
      meta_title: meta.metaTitle,
      meta_description: meta.metaDescription,
      status: "draft",
    });

    job = await updateJob(jobId, {
      status: "READY",
      blog_post_id: post.id,
      article_html: html,
      quality_score: quality.score,
      quality_notes: {
        ...quality.breakdown,
        feedback: quality.feedback,
        seoScore: seo.score,
        seoBreakdown: seo.breakdown,
        seoNotes: seo.notes,
      },
      leadthur_cta: capability.cta,
      image_status: imageStatus,
      image_alt: imageAlt,
      meta: {
        ...meta,
        slug,
        coverImage,
        imageAlt,
        ogTitle: meta.metaTitle,
        ogDescription: meta.metaDescription,
        seoScore: seo.score,
      },
    });

    await updateTopicStatus(topic.id, "USED");

    if (options.publish || (settings.auto_publishing && settings.automation_enabled)) {
      job = await publishReadyJob(jobId);
    }

    return job;
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    logger.error("Content job failed", { jobId, error: message });
    await recordGenerationRun({
      job_id: jobId,
      stage: "pipeline",
      success: false,
      error_category: message.slice(0, 120),
    });
    return updateJob(jobId, {
      status: job.attempt_count + 1 >= settings.max_retries ? "FAILED" : "RETRYING",
      error_message: message,
      last_error_at: new Date().toISOString(),
    });
  }
}

export async function publishReadyJob(jobId: string): Promise<ContentJob> {
  const job = await getJobById(jobId);
  if (!job) throw new Error("Job not found");
  if (job.status === "PUBLISHED") return job;
  if (job.status !== "READY" && job.status !== "SCHEDULED") {
    throw new Error(`Job status ${job.status} is not publishable`);
  }
  if (!job.blog_post_id) throw new Error("Job has no blog post");

  const publishedToday = await countPublishedToday();
  const settings = await getContentSettings();
  if (publishedToday >= settings.daily_article_target) {
    throw new Error("Daily publish limit reached");
  }

  await publishBlogPost(job.blog_post_id);
  await ensurePerformanceRow(job.blog_post_id, job.id);
  await recordGenerationRun({
    job_id: jobId,
    stage: "publish",
    success: true,
  });

  return updateJob(jobId, {
    status: "PUBLISHED",
    published_at: new Date().toISOString(),
    scheduled_for: null,
  });
}

/** Backfill Storage covers for published jobs whose image step failed. */
export async function repairFailedJobImages(limit = 2): Promise<number> {
  const settings = await getContentSettings();
  if (!settings.auto_image_generation) return 0;
  const imagesToday = await countImagesToday();
  if (imagesToday >= settings.daily_image_limit) return 0;

  const published = await listJobs("PUBLISHED", 30);
  const needing = published.filter(
    (j) =>
      j.blog_post_id &&
      typeof j.image_status === "string" &&
      j.image_status.startsWith("failed:")
  );
  let repaired = 0;
  for (const job of needing.slice(0, limit)) {
    if ((await countImagesToday()) >= settings.daily_image_limit) break;
    const title =
      (job.meta as { title?: string } | null)?.title ||
      "LeadThur editorial blog header";
    const concept =
      (job.meta as { imageConcept?: string } | null)?.imageConcept ||
      `Professional editorial illustration for: ${title}`;
    const started = Date.now();
    const image = await generateArticleImage(
      `Professional editorial blog header image, no text overlays, clean modern style: ${concept}`,
      { slugHint: (job.meta as { slug?: string } | null)?.slug || title }
    );
    await recordGenerationRun({
      job_id: job.id,
      stage: "image_generation",
      provider: "openai",
      latency_ms: Date.now() - started,
      success: image.ok,
      error_category: image.ok ? undefined : image.reason,
      metadata: image.ok
        ? { model: image.model }
        : image.probe
          ? {
              modelTried: image.probe.modelTried,
              httpStatus: image.probe.httpStatus,
              openaiCode: image.probe.openaiCode,
              openaiType: image.probe.openaiType,
              openaiMessage: image.probe.openaiMessage,
            }
          : { reason: image.reason },
    });
    if (!image.ok || !job.blog_post_id) {
      await updateJob(job.id, { image_status: `failed:${image.ok ? "unknown" : image.reason}` });
      continue;
    }
    await updateBlogPostCover(job.blog_post_id, image.imageUrl);
    const imageAlt = `${title} — editorial illustration`;
    await updateJob(job.id, {
      image_status: "generated",
      image_alt: imageAlt,
      meta: {
        ...(job.meta || {}),
        coverImage: image.imageUrl,
        imageAlt,
      },
    });
    repaired += 1;
    logger.info("Repaired blog cover image", { jobId: job.id });
  }
  return repaired;
}

export async function scheduleReadyJob(jobId: string, when: Date): Promise<ContentJob> {
  const job = await getJobById(jobId);
  if (!job) throw new Error("Job not found");
  if (job.status !== "READY" && job.status !== "SCHEDULED") {
    throw new Error(`Cannot schedule job in status ${job.status}`);
  }
  return updateJob(jobId, {
    status: "SCHEDULED",
    scheduled_for: when.toISOString(),
  });
}

export async function discoverAndQueueTopics(limit = 6): Promise<{
  topics: number;
  jobsCreated: number;
}> {
  const topics = await discoverTopics(limit);
  let jobsCreated = 0;
  for (const topic of topics.filter((t) => t.status === "QUALIFIED" || t.status === "DISCOVERED")) {
    if (topic.score < 60) continue;
    await createJobForTopic(topic.id);
    jobsCreated += 1;
  }
  return { topics: topics.length, jobsCreated };
}

export async function generateOneArticleDraft(topicTitle?: string): Promise<ContentJob> {
  if (topicTitle) {
    const { upsertTopic } = await import("./repository");
    const topic = await upsertTopic({
      title: topicTitle,
      score: 90,
      status: "QUALIFIED",
      source: "manual",
      cluster: "Lead Generation",
      search_intent: "informational",
      audience: "business owners and sales teams",
      rationale: "Manual generation request",
    });
    const job = await createJobForTopic(topic.id);
    return runContentJob(job.id, { publish: false });
  }

  const discovered = await discoverTopics(5);
  const topic =
    discovered.find((t) => t.status === "QUALIFIED") ||
    discovered[0];
  if (!topic) throw new Error("No topics available");
  const job = await createJobForTopic(topic.id);
  return runContentJob(job.id, { publish: false });
}
