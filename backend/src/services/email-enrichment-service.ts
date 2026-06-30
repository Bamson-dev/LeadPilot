import type { BrowserContext } from "playwright";
import type { BusinessLead, PredictedEmail } from "@leadthur/shared";
import { isBlockedEmailScrapeDomain } from "@leadthur/shared";
import {
  domainCacheToEnrichment,
  getDomainEmailCache,
  upsertDomainEmailCache,
} from "../database/domain-email-cache-repository";
import { scrapeVerifiedEmailsWithPlaywright } from "../scraper/emailCrawler/email-crawler";
import { isValidEmail, pickBestEmail } from "../scraper/parsers/email-validation";
import { resolveGenerationDomain } from "../scraper/utils/domain-utils";
import { resolveEffectiveBusinessWebsite } from "../scraper/utils/effective-website";
import { generatePredictedEmails } from "../utils/email-predictor";
import { logger } from "../utils/logger";

export interface LeadEmailEnrichment {
  verifiedEmails: string[];
  predictedEmails: PredictedEmail[];
  emailSource: "website" | "predicted" | "none";
  fromCache: boolean;
}

const EMPTY: LeadEmailEnrichment = {
  verifiedEmails: [],
  predictedEmails: [],
  emailSource: "none",
  fromCache: false,
};

function leadHasMapsVerifiedEmail(lead: BusinessLead): boolean {
  if ((lead.verifiedEmails?.length ?? 0) > 0) return true;
  if (lead.emailSource === "website" && (lead.emails?.length ?? 0) > 0) return true;
  return Boolean(lead.email?.trim() && lead.emailSource === "website");
}

function buildVerifiedResult(emails: string[]): LeadEmailEnrichment {
  return {
    verifiedEmails: emails,
    predictedEmails: [],
    emailSource: "website",
    fromCache: false,
  };
}

function buildPredictedResult(predictions: PredictedEmail[]): LeadEmailEnrichment {
  return {
    verifiedEmails: [],
    predictedEmails: predictions,
    emailSource: "predicted",
    fromCache: false,
  };
}

async function writeCacheFromEnrichment(
  domain: string,
  enrichment: LeadEmailEnrichment
): Promise<void> {
  if (enrichment.verifiedEmails.length > 0) {
    await upsertDomainEmailCache({
      domain,
      email: enrichment.verifiedEmails[0]!,
      emailSecondary: enrichment.verifiedEmails[1] ?? null,
      source: "scraped",
      confidence: 100,
      confidenceSecondary: enrichment.verifiedEmails[1] ? 100 : null,
    });
    return;
  }

  if (enrichment.predictedEmails.length > 0) {
    const [primary, secondary] = enrichment.predictedEmails;
    await upsertDomainEmailCache({
      domain,
      email: primary.email,
      emailSecondary: secondary?.email ?? null,
      source: "predicted",
      confidence: primary.confidence,
      confidenceSecondary: secondary?.confidence ?? null,
    });
  }
}

/**
 * Unified email enrichment for a single business lead.
 * Order: Maps verified → domain cache → Playwright scrape → MX-scored prediction.
 */
export async function enrichBusinessLeadEmail(
  lead: BusinessLead,
  options?: { browserContext?: BrowserContext; skipPlaywrightScrape?: boolean }
): Promise<LeadEmailEnrichment> {
  if (leadHasMapsVerifiedEmail(lead)) {
    const verified = pickBestEmail(
      lead.verifiedEmails.length > 0 ? lead.verifiedEmails : lead.emails,
      lead.website,
      3
    );
    return { ...buildVerifiedResult(verified), fromCache: false };
  }

  if (!lead.website?.trim()) {
    return EMPTY;
  }

  if (isBlockedEmailScrapeDomain(lead.website)) {
    logger.info("[email-diag] Skipped — blocked platform domain", {
      businessId: lead.id,
      website: lead.website.substring(0, 80),
    });
    return EMPTY;
  }

  const effectiveWebsite =
    (await resolveEffectiveBusinessWebsite(lead.website)) ?? lead.website;

  if (isBlockedEmailScrapeDomain(effectiveWebsite)) {
    return EMPTY;
  }

  const domain = resolveGenerationDomain(effectiveWebsite);
  if (!domain || isBlockedEmailScrapeDomain(`https://${domain}`)) {
    return EMPTY;
  }

  const cached = await getDomainEmailCache(domain);
  if (cached) {
    const mapped = domainCacheToEnrichment(cached);
    logger.info("[email-diag] Domain cache hit — skipping scrape", {
      businessId: lead.id,
      domain,
      source: cached.source,
      email: cached.email,
      discoveredAt: cached.discovered_at,
    });
    return {
      ...mapped,
      fromCache: true,
    };
  }

  let verified: string[] = [];
  const browserContext = options?.browserContext;
  if (!options?.skipPlaywrightScrape && browserContext) {
    verified = await scrapeVerifiedEmailsWithPlaywright(
      effectiveWebsite,
      browserContext
    );
  } else if (!options?.skipPlaywrightScrape && !browserContext) {
    logger.warn("[email-diag] No browser context — skipping Playwright scrape", {
      businessId: lead.id,
      website: effectiveWebsite.substring(0, 80),
    });
  }

  verified = pickBestEmail(
    verified.filter(isValidEmail),
    effectiveWebsite,
    3
  );

  if (verified.length > 0) {
    const result = buildVerifiedResult(verified);
    await writeCacheFromEnrichment(domain, result);
    return result;
  }

  const predictions = await generatePredictedEmails({
    businessName: lead.name,
    website: effectiveWebsite,
    category: lead.category,
  });

  const validPredictions = predictions.filter((p) => isValidEmail(p.email));
  if (validPredictions.length > 0) {
    const result = buildPredictedResult(validPredictions);
    await writeCacheFromEnrichment(domain, result);
    logger.info("[email-diag] MX-validated predictions applied", {
      businessId: lead.id,
      domain,
      predictions: validPredictions.map((p) => ({
        email: p.email,
        confidence: p.confidence,
        label: p.label,
      })),
    });
    return result;
  }

  return EMPTY;
}

export function enrichmentToBusinessLead(
  lead: BusinessLead,
  enrichment: LeadEmailEnrichment
): BusinessLead {
  const hasVerified = enrichment.verifiedEmails.length > 0;
  const hasPredicted = enrichment.predictedEmails.length > 0;

  if (!hasVerified && !hasPredicted) {
    return { ...lead, emailScraped: true, emailSource: "none" };
  }

  if (hasVerified) {
    return {
      ...lead,
      emails: enrichment.verifiedEmails,
      verifiedEmails: enrichment.verifiedEmails,
      predictedEmails: [],
      email: enrichment.verifiedEmails.join(", "),
      emailSource: "website",
      emailScraped: true,
    };
  }

  const addresses = enrichment.predictedEmails.map((p) => p.email);
  return {
    ...lead,
    emails: [],
    verifiedEmails: [],
    predictedEmails: enrichment.predictedEmails,
    email: addresses.join(", "),
    emailSource: "predicted",
    emailScraped: true,
  };
}
