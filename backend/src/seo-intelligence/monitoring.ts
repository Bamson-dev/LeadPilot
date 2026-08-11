import { getTopPages } from "../google-search-console/repository";
import {
  getOpportunity,
  listMonitoringJobs,
  publicBlogUrl,
  updateOptimizationJob,
  updateOpportunityStatus,
  upsertOptimizationResult,
  getPublishedBlogPostById,
} from "./repository";
import type { SeoResultClassification } from "./types";

export async function evaluateMonitoringJobs(): Promise<number> {
  const jobs = await listMonitoringJobs();
  if (!jobs.length) return 0;
  const pages = await getTopPages(28, "clicks", 200);
  const byUrl = new Map(pages.map((p) => [p.page.replace(/\/$/, ""), p]));

  let evaluated = 0;
  for (const job of jobs) {
    if (!job.published_at) continue;
    const publishedAt = new Date(job.published_at).getTime();
    const ageDays = (Date.now() - publishedAt) / (24 * 60 * 60 * 1000);
    if (ageDays < 7) continue; // need a reasonable window

    const post = await getPublishedBlogPostById(job.blog_post_id);
    if (!post) continue;
    const url = publicBlogUrl(post.slug).replace(/\/$/, "");
    const current = byUrl.get(url) || byUrl.get(url + "/");
    const opportunity = await getOpportunity(job.opportunity_id);

    const baselineClicks = opportunity?.clicks || 0;
    const baselineImpr = opportunity?.impressions || 0;
    const baselineCtr = opportunity?.ctr || 0;
    const baselinePos = opportunity?.position || 0;

    let classification: SeoResultClassification = "INSUFFICIENT_DATA";
    const notes: string[] = [];

    if (!current || current.impressions < 10) {
      classification = "INSUFFICIENT_DATA";
      notes.push("Not enough post-optimization Search Console data yet");
    } else {
      const clickDelta = current.clicks - baselineClicks;
      const ctrDelta = current.ctr - baselineCtr;
      const posDelta = baselinePos - current.position; // positive = improved rank number

      if (clickDelta > 0 && (ctrDelta > 0 || posDelta > 0)) {
        classification = "IMPROVED";
        notes.push("Performance improved after optimization (correlation, not guaranteed causation)");
      } else if (clickDelta < 0 && ctrDelta < 0) {
        classification = "DECLINED";
        notes.push("Performance declined vs pre-optimization baseline");
      } else {
        classification = "STABLE";
        notes.push("Performance roughly stable vs baseline");
      }
    }

    await upsertOptimizationResult({
      optimization_job_id: job.id,
      blog_post_id: job.blog_post_id,
      classification,
      baseline_clicks: baselineClicks,
      baseline_impressions: baselineImpr,
      baseline_ctr: baselineCtr,
      baseline_position: baselinePos,
      observed_clicks: current?.clicks ?? null,
      observed_impressions: current?.impressions ?? null,
      observed_ctr: current?.ctr ?? null,
      observed_position: current?.position ?? null,
      window_days: 28,
      notes: notes.join("; "),
    });

    if (ageDays >= 28 || classification !== "INSUFFICIENT_DATA") {
      await updateOptimizationJob(job.id, {
        status: "COMPLETED",
        completed_at: new Date().toISOString(),
      });
      await updateOpportunityStatus(job.opportunity_id, "COMPLETED");
    }
    evaluated += 1;
  }
  return evaluated;
}
