import type { BusinessLead, StreamEvent } from "@leadpilot/shared";
import { getBrowserPool } from "../scraper/browser/browser-pool";
import { scrapeGoogleMaps } from "../scraper/googleMaps/maps-scraper";
import { crawlEmailForWebsite } from "../scraper/emailCrawler/email-crawler";
import {
  insertBusinessLead,
  markSearchComplete,
  markSearchFailed,
  updateSearchJob,
} from "../database/search-repository";
import { formatScraperError } from "../scraper/utils/scraper-errors";
import { logger } from "../utils/logger";
import { rawLeadToBusinessLead } from "../utils/lead-mapper";
import { parseMapsEmailsFromLead, resolveLeadEmailFields } from "../scraper/utils/lead-email";
import type { RawLeadInput } from "../types/scraper";

export type ScrapeEmitter = (event: StreamEvent) => void;

async function enrichLead(raw: RawLeadInput, searchId: string): Promise<BusinessLead> {
  let lead = rawLeadToBusinessLead(raw, searchId);

  if (lead.website) {
    try {
      const crawl = await Promise.race([
        crawlEmailForWebsite(lead.website, lead.category, lead.name),
        new Promise<{ email: string | null; emailSource: "none" }>((resolve) =>
          setTimeout(() => resolve({ email: null, emailSource: "none" }), 4000)
        ),
      ]);
      const mapsEmails = parseMapsEmailsFromLead(raw);
      const fields = resolveLeadEmailFields({
        mapsEmails,
        websiteEmails:
          crawl.emailSource === "website" && crawl.email
            ? crawl.email.split(", ")
            : [],
        website: lead.website,
        category: lead.category,
        businessName: lead.name,
      });
      lead = {
        ...lead,
        email: fields.email,
        emailSource:
          fields.email_source === "extracted"
            ? "website"
            : fields.email_source === "generated"
              ? "generated"
              : "none",
      };
    } catch {
      // keep basic lead
    }
  }

  return lead;
}

export async function runScraperJob(
  searchId: string,
  query: string,
  location: string,
  emit: ScrapeEmitter
): Promise<void> {
  const pool = getBrowserPool();
  const browser = await pool.acquire();
  let progress = 0;
  let progressMax = 50;

  try {
    await updateSearchJob(searchId, { status: "running" });
    emit({ type: "started", searchId });

    const onBusinessFound = async (raw: RawLeadInput) => {
      const basic = rawLeadToBusinessLead(raw, searchId);
      progress++;
      emit({ type: "lead", lead: basic });
      emit({ type: "progress", processed: progress, count: progress, max: progressMax });

      void enrichLead(raw, searchId).then((enriched) => {
        if (enriched.email !== basic.email || enriched.emailSource !== basic.emailSource) {
          emit({ type: "lead", lead: enriched });
        }
        insertBusinessLead(enriched).catch((err) => {
          logger.error("Failed to insert business lead", {
            searchId,
            error: err instanceof Error ? err.message : "unknown",
          });
        });
      });

      if (progress % 3 === 0) {
        updateSearchJob(searchId, { processed: progress, totalFound: progress }).catch(
          () => undefined
        );
      }
    };

    const total = await scrapeGoogleMaps(browser, {
      query,
      location,
      onPhase: (phase) => emit({ type: "phase", phase }),
      onProgress: (count, max) => {
        progressMax = max;
        emit({ type: "progress", count, max, processed: count });
      },
      onLead: onBusinessFound,
    });

    await updateSearchJob(searchId, { processed: progress, totalFound: total });
    await markSearchComplete(searchId, total);
    emit({ type: "complete", total });
  } catch (err) {
    const message = formatScraperError(err);
    logger.error("Scraper job failed", { searchId, message });
    await markSearchFailed(searchId, message);
    emit({ type: "error", message });
    throw err;
  } finally {
    pool.release(browser);
  }
}

export const runSearch = runScraperJob;
