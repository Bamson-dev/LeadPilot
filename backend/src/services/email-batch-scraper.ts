import type { BusinessLead, StreamEvent } from "@leadthur/shared";
import { scrapeBusinessEmailStrict } from "../scraper/emailCrawler/email-crawler";
import {
  EMAIL_SCRAPE_BATCH_SIZE,
  EMAIL_SCRAPE_MAX_MS,
} from "../scraper/utils/constants";
import {
  getAllSearchLeads,
  markBusinessLeadEmailScraped,
  updateBusinessLeadEmails,
} from "../database/search-repository";
import { applyWebsiteEmailsToLead } from "../utils/lead-mapper";
import { logger } from "../utils/logger";

export type ScrapeEmitter = (event: StreamEvent) => void;

function leadHasVerifiedEmail(lead: BusinessLead): boolean {
  return Boolean(
    lead.email?.trim() ||
      (lead.emails?.length ?? 0) > 0 ||
      (lead.verifiedEmails?.length ?? 0) > 0
  );
}

async function scrapeOneLeadEmail(lead: BusinessLead): Promise<BusinessLead> {
  if (!lead.website || leadHasVerifiedEmail(lead) || lead.emailScraped) {
    return lead;
  }

  const emails = await scrapeBusinessEmailStrict(lead.website);
  if (emails.length > 0) {
    return applyWebsiteEmailsToLead(lead, emails);
  }

  return { ...lead, email: lead.email ?? "", emails: [], emailScraped: true };
}

export async function runBatchEmailScraping(
  searchId: string,
  emit: ScrapeEmitter,
  deadlineMs = EMAIL_SCRAPE_MAX_MS
): Promise<{ emailsFound: number; emailsScraped: number }> {
  const deadline = Date.now() + deadlineMs;
  let emailsFound = 0;
  let emailsScraped = 0;

  while (Date.now() < deadline) {
    const pending = (await getAllSearchLeads(searchId)).filter(
      (lead) =>
        lead.website &&
        !lead.emailScraped &&
        !leadHasVerifiedEmail(lead)
    );

    if (pending.length === 0) break;

    for (let i = 0; i < pending.length; i += EMAIL_SCRAPE_BATCH_SIZE) {
      if (Date.now() >= deadline) break;

      const batch = pending.slice(i, i + EMAIL_SCRAPE_BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((lead) => scrapeOneLeadEmail(lead))
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        const original = batch[j];
        if (result.status !== "fulfilled") {
          await markBusinessLeadEmailScraped(original.id, []).catch(() => undefined);
          emailsScraped++;
          continue;
        }

        const enriched = result.value;
        emailsScraped++;

        const foundEmails =
          enriched.emails?.length > 0
            ? enriched.emails
            : enriched.verifiedEmails?.length > 0
              ? enriched.verifiedEmails
              : [];

        if (foundEmails.length > 0) {
          emailsFound++;
          await updateBusinessLeadEmails(enriched.id, foundEmails, "extracted").catch(
            (err) =>
              logger.warn("Failed to persist scraped email", {
                searchId,
                businessId: enriched.id,
                error: err instanceof Error ? err.message : "unknown",
              })
          );

          emit({
            type: "email_update",
            businessId: enriched.id,
            email: enriched.email,
            emails: foundEmails,
            emailSource: "website",
            lead: enriched,
            data: enriched,
          });
        } else {
          await markBusinessLeadEmailScraped(original.id, []).catch(() => undefined);
        }
      }
    }
  }

  const remaining = (await getAllSearchLeads(searchId)).filter(
    (lead) =>
      lead.website && !lead.emailScraped && !leadHasVerifiedEmail(lead)
  );

  for (const lead of remaining) {
    await markBusinessLeadEmailScraped(lead.id, []).catch(() => undefined);
    emailsScraped++;
  }

  return { emailsFound, emailsScraped };
}
