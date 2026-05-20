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

export type ScrapeEmitter = (event: StreamEvent) => void;

export async function runScraperJob(
  searchId: string,
  query: string,
  location: string,
  emit: ScrapeEmitter
): Promise<void> {
  const pool = getBrowserPool();
  const browser = await pool.acquire();
  let processed = 0;

  try {
    await updateSearchJob(searchId, { status: "running" });

    for await (const raw of scrapeGoogleMaps(browser, {
      query,
      location,
      onPhase: (phase) => emit({ type: "phase", phase }),
      onProgress: (count, max) => emit({ type: "progress", count, max }),
    })) {
      let lead = rawLeadToBusinessLead(raw, searchId);

      if (lead.website) {
        const crawl = await crawlEmailForWebsite(
          lead.website,
          lead.category,
          lead.name
        );
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
      }

      await insertBusinessLead(lead);
      processed++;
      if (processed % 10 === 0) {
        await updateSearchJob(searchId, { processed, totalFound: processed });
      }
      emit({ type: "lead", lead });
    }

    await markSearchComplete(searchId, processed);
    emit({ type: "complete", total: processed });
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
