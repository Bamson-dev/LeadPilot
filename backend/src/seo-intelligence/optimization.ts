import { callDeepSeekChat } from "../services/deepseek-client";
import { scoreArticleQuality } from "../content-automation/generate";
import { computeSeoReadiness } from "../content-automation/seo-score";
import { getContentSettings } from "../content-automation/repository";
import { gatherResearchSources } from "../content-automation/research";
import { logger } from "../utils/logger";
import { buildOptimizationPrompt, parseOptimizationProposal } from "./prompts";
import { buildBriefFromPost, validateOptimizationProposal } from "./validation";
import {
  createOptimizationJob,
  getOpportunity,
  getPublishedBlogPostById,
  isInCooldown,
  listPublishedBlogPosts,
  saveArticleVersion,
  setCooldown,
  updateOptimizationJob,
  updateOpportunityStatus,
  updatePublishedBlogPostContent,
  updateSeoSettings,
  getSeoSettings,
  countOptimizationsSince,
  restoreArticleFromVersion,
  getLatestVersionForJob,
} from "./repository";

const QUALITY_ATTEMPTS = 2;

export async function optimizeOpportunity(
  opportunityId: string,
  opts?: { force?: boolean }
): Promise<{ ok: boolean; jobId?: string; error?: string; articleUrl?: string }> {
  const settings = await getSeoSettings();
  if (!settings.seo_optimization_enabled && !opts?.force) {
    return { ok: false, error: "seo_optimization_disabled" };
  }

  const opportunity = await getOpportunity(opportunityId);
  if (!opportunity) return { ok: false, error: "opportunity_not_found" };
  if (!opportunity.blog_post_id) return { ok: false, error: "no_blog_post_mapping" };
  if (opportunity.opportunity_type === "rising_content") {
    await updateOpportunityStatus(opportunity.id, "SKIPPED");
    return { ok: false, error: "rising_content_protected" };
  }

  if (await isInCooldown(opportunity.blog_post_id)) {
    await updateOpportunityStatus(opportunity.id, "SKIPPED");
    return { ok: false, error: "cooldown_active" };
  }

  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const usedToday = await countOptimizationsSince(dayStart.toISOString());
  const dailyCap = settings.first_run_completed
    ? settings.max_optimizations_per_day
    : 1;
  if (usedToday >= dailyCap) {
    return { ok: false, error: "daily_limit_reached" };
  }

  const post = await getPublishedBlogPostById(opportunity.blog_post_id);
  if (!post) return { ok: false, error: "blog_post_missing" };

  const caSettings = await getContentSettings();
  const threshold = caSettings.quality_threshold || 90;

  const job = await createOptimizationJob({
    opportunity_id: opportunity.id,
    blog_post_id: post.id,
    page_url: opportunity.page_url,
  });
  await updateOpportunityStatus(opportunity.id, "OPTIMIZING");

  try {
    await updateOptimizationJob(job.id, { status: "RESEARCHING" });
    let researchSummary = "";
    let researchSources: unknown[] = [];
    const needsResearch = [
      "content_depth_gap",
      "positions_4_to_20",
      "query_article_mismatch",
      "declining_performance",
    ].includes(opportunity.opportunity_type);

    if (needsResearch) {
      const research = await gatherResearchSources(post.title, "light");
      researchSources = research.sources || [];
      researchSummary = (research.sources || [])
        .slice(0, 6)
        .map((s) => `${s.title}: ${s.snippet}`)
        .join("\n");
    }

    const posts = await listPublishedBlogPosts(100);
    const internalLinks = posts
      .filter((p) => p.id !== post.id)
      .slice(0, 20)
      .map((p) => ({ title: p.title, slug: p.slug }));
    const allowedSlugs = new Set(posts.map((p) => p.slug));

    const brief = buildBriefFromPost(
      post,
      (opportunity.top_queries || []).map((q) => q.query)
    );

    const beforeQuality = await scoreArticleQuality({
      html: post.content,
      brief,
      hasImage: Boolean(post.cover_image),
      threshold,
    });
    const beforeSeo = computeSeoReadiness({
      html: post.content,
      brief,
      meta: {
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt || undefined,
        metaTitle: post.meta_title || post.title,
        metaDescription: post.meta_description || undefined,
      },
      hasImage: Boolean(post.cover_image),
      sourceCount: (post.content.match(/https?:\/\//g) || []).length,
    });

    let proposal = null;
    let afterQuality = beforeQuality;
    let lastNotes: string[] = [];

    for (let attempt = 1; attempt <= QUALITY_ATTEMPTS; attempt++) {
      await updateOptimizationJob(job.id, {
        status: attempt === 1 ? "GENERATING" : "QUALITY_CHECK",
        research_summary: researchSummary || null,
        research_sources: researchSources,
        quality_score_before: beforeQuality.score,
        seo_score_before: beforeSeo.score,
      });

      const prompt = buildOptimizationPrompt({
        post,
        opportunityType: opportunity.opportunity_type,
        scoreReasons: opportunity.score_reasons || [],
        clicks: opportunity.clicks,
        impressions: opportunity.impressions,
        ctr: opportunity.ctr,
        position: opportunity.position,
        topQueries: opportunity.top_queries || [],
        researchSummary,
        internalLinks,
      });

      const ai = await callDeepSeekChat(prompt, {
        max_tokens: 6000,
        temperature: 0.4,
        system:
          "You optimize existing SEO content carefully. Return JSON only. Never invent URLs or ranking guarantees.",
      });
      if (!ai.ok) {
        throw new Error(`deepseek_failed:${ai.reason}`);
      }
      proposal = parseOptimizationProposal(ai.content);
      if (!proposal) {
        lastNotes = ["invalid_ai_json"];
        continue;
      }

      const validation = validateOptimizationProposal({
        original: post,
        proposal,
        allowedSlugs,
      });
      lastNotes = validation.notes;
      if (!validation.ok) continue;

      await updateOptimizationJob(job.id, { status: "QUALITY_CHECK" });
      afterQuality = await scoreArticleQuality({
        html: proposal.contentHtml,
        brief: { ...brief, proposedTitle: proposal.title },
        hasImage: Boolean(post.cover_image),
        threshold,
      });
      if (afterQuality.passed) {
        proposal = proposal;
        await updateOptimizationJob(job.id, {
          proposed_title: proposal.title,
          proposed_meta_description: proposal.metaDescription,
          proposed_content: proposal.contentHtml,
          optimization_types: proposal.optimizationTypes,
          ai_reasoning: proposal.reasoning,
          change_summary: validation.changeSummary,
          validation_notes: validation.notes,
          quality_score_after: afterQuality.score,
        });
        break;
      }
      lastNotes = [
        ...validation.notes,
        `quality_below_threshold:${afterQuality.score}<${threshold}`,
        afterQuality.feedback,
      ];
      proposal = null;
    }

    if (!proposal) {
      await updateOptimizationJob(job.id, {
        status: "FAILED",
        error_message: lastNotes.join("; ").slice(0, 500),
        completed_at: new Date().toISOString(),
      });
      await updateOpportunityStatus(opportunity.id, "FAILED");
      return { ok: false, jobId: job.id, error: "optimization_failed_quality_or_validation" };
    }

    await updateOptimizationJob(job.id, { status: "VALIDATING" });
    const afterSeo = computeSeoReadiness({
      html: proposal.contentHtml,
      brief: { ...brief, proposedTitle: proposal.title },
      meta: {
        title: proposal.title,
        slug: post.slug,
        excerpt: proposal.excerpt,
        metaTitle: proposal.title,
        metaDescription: proposal.metaDescription,
      },
      hasImage: Boolean(post.cover_image),
      sourceCount: (proposal.contentHtml.match(/https?:\/\//g) || []).length,
    });

    // Technical gates — never change slug; require meta/title/content present.
    if (!proposal.title || !proposal.metaDescription || !proposal.contentHtml) {
      throw new Error("seo_validation_failed:missing_fields");
    }

    await saveArticleVersion({
      blog_post_id: post.id,
      optimization_job_id: job.id,
      opportunity_id: opportunity.id,
      original: post,
      optimized: {
        title: proposal.title,
        meta_title: proposal.title,
        meta_description: proposal.metaDescription,
        excerpt: proposal.excerpt || post.excerpt || "",
        content: proposal.contentHtml,
      },
      quality_score: afterQuality.score,
      seo_score: afterSeo.score,
      reason: opportunity.recommended_action || opportunity.opportunity_type,
      published: false,
    });

    // Publish optimized content (slug unchanged).
    const updated = await updatePublishedBlogPostContent(post.id, {
      title: proposal.title,
      excerpt: proposal.excerpt || post.excerpt || "",
      content: proposal.contentHtml,
      meta_title: proposal.title,
      meta_description: proposal.metaDescription,
    });

    // Verify live public page.
    const liveUrl = `https://www.leadthur.com/blog/${updated.slug}`;
    let liveOk = false;
    try {
      const res = await fetch(liveUrl, { method: "GET" });
      liveOk = res.status === 200;
    } catch {
      liveOk = false;
    }

    if (!liveOk) {
      const version = await getLatestVersionForJob(job.id);
      if (version?.id) {
        await restoreArticleFromVersion(version.id);
      }
      await updateOptimizationJob(job.id, {
        status: "ROLLED_BACK",
        error_message: "live_page_not_200_after_publish",
        completed_at: new Date().toISOString(),
      });
      await updateOpportunityStatus(opportunity.id, "FAILED");
      return { ok: false, jobId: job.id, error: "rolled_back_live_check_failed", articleUrl: liveUrl };
    }

    // Mark version published
    const version = await getLatestVersionForJob(job.id);
    if (version?.id) {
      // best-effort flag
      await saveArticleVersion({
        blog_post_id: post.id,
        optimization_job_id: job.id,
        opportunity_id: opportunity.id,
        original: post,
        optimized: {
          title: proposal.title,
          meta_title: proposal.title,
          meta_description: proposal.metaDescription,
          excerpt: proposal.excerpt || "",
          content: proposal.contentHtml,
        },
        quality_score: afterQuality.score,
        seo_score: afterSeo.score,
        reason: "published_snapshot",
        published: true,
      }).catch(() => null);
    }

    await updateOptimizationJob(job.id, {
      status: "MONITORING",
      seo_score_after: afterSeo.score,
      quality_score_after: afterQuality.score,
      published_at: new Date().toISOString(),
      monitoring_started_at: new Date().toISOString(),
    });
    await updateOpportunityStatus(opportunity.id, "MONITORING");
    await setCooldown(post.id, settings.cooldown_days, job.id);
    await updateSeoSettings({
      last_optimization_at: new Date().toISOString(),
      first_run_completed: true,
    });

    logger.info("SEO optimization published", {
      jobId: job.id,
      slug: post.slug,
      qualityBefore: beforeQuality.score,
      qualityAfter: afterQuality.score,
    });

    return {
      ok: true,
      jobId: job.id,
      articleUrl: liveUrl,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "optimization_failed";
    logger.error("SEO optimization failed", { opportunityId, error: message });
    await updateOptimizationJob(job.id, {
      status: "FAILED",
      error_message: message.slice(0, 500),
      completed_at: new Date().toISOString(),
    });
    await updateOpportunityStatus(opportunityId, "FAILED");
    return { ok: false, jobId: job.id, error: message };
  }
}
