import type { BusinessLead, PredictedEmail } from "@leadthur/shared";
import type { RawLeadInput } from "../types/scraper";
import { crawlEmailForWebsite } from "../scraper/emailCrawler/email-crawler";
import { resolveEffectiveBusinessWebsite } from "../scraper/utils/effective-website";
import { parseMapsEmailsFromLead } from "../scraper/utils/lead-email";
import { mergeEmails, parseEmailList } from "../scraper/parsers/email-filter";
import { generateEmailsFromWebsite } from "../scraper/parsers/email-generator";
import {
  isValidEmail,
  pickBestEmail,
} from "../scraper/parsers/email-validation";
import { resolveGenerationDomain } from "../scraper/utils/domain-utils";
import {
  formatPredictedEmailsForStorage,
  generatePredictedEmails,
} from "./email-predictor";

function verifiedFromMaps(raw: RawLeadInput): string[] {
  return parseMapsEmailsFromLead(raw);
}

function buildVerifiedLead(
  lead: BusinessLead,
  verified: string[]
): BusinessLead {
  const all = pickBestEmail(
    verified.filter(isValidEmail),
    lead.website,
    100
  );
  const display = all.length > 0 ? all : verified.filter(isValidEmail);
  return {
    ...lead,
    emails: display,
    verifiedEmails: display,
    predictedEmails: [],
    email: display.length > 0 ? display.join(", ") : null,
    emailSource: display.length > 0 ? "website" : "none",
  };
}

export function rawLeadToBusinessLead(
  raw: RawLeadInput,
  searchId: string
): BusinessLead {
  const mapsVerified = verifiedFromMaps(raw);
  const website = raw.website;
  const hasInstagram = Boolean(
    website?.includes("instagram.com") || website?.includes("instagr.am")
  );

  const base: BusinessLead = {
    id: crypto.randomUUID(),
    searchId,
    name: raw.business_name,
    category: raw.category ?? "",
    address: raw.address ?? "",
    phone: raw.phone,
    email: null,
    emails: [],
    verifiedEmails: [],
    predictedEmails: [],
    emailSource: "none",
    website,
    rating: raw.rating,
    reviewCount: raw.reviews_count,
    googleMapsUrl: raw.google_maps_url,
    hasWebsite: Boolean(website),
    hasInstagram,
    createdAt: new Date().toISOString(),
  };

  if (mapsVerified.length > 0) {
    const sorted = pickBestEmail(mapsVerified, website, 100);
    return buildVerifiedLead(base, sorted.length > 0 ? sorted : mapsVerified);
  }

  return base;
}

export function applyWebsiteEmailsToLead(
  lead: BusinessLead,
  emails: string[]
): BusinessLead {
  return buildVerifiedLead(lead, emails);
}

/** Apply simple domain-pattern predictions from the website email crawler. */
export function applyPredictedEmailsToLead(
  lead: BusinessLead,
  emails: string[]
): BusinessLead {
  const display = pickBestEmail(
    emails.filter(isValidEmail),
    lead.website,
    3
  );
  if (display.length === 0) {
    return { ...lead, emailSource: "none" };
  }

  const predictedEmails: PredictedEmail[] = display.map((email) => ({
    email,
    confidence: 0,
    label: "medium",
    source: "business_pattern",
  }));

  return {
    ...lead,
    emails: display,
    verifiedEmails: [],
    predictedEmails,
    email: display.join(", "),
    emailSource: "predicted",
  };
}

export async function enrichLeadEmail(
  lead: BusinessLead,
  options?: { skipWebsiteCrawl?: boolean }
): Promise<BusinessLead> {
  const mapsVerified =
    lead.verifiedEmails.length > 0
      ? lead.verifiedEmails
      : lead.emails.length > 0
        ? lead.emails
        : lead.email
          ? parseEmailList(lead.email)
          : [];

  const effectiveWebsite =
    (await resolveEffectiveBusinessWebsite(lead.website)) ?? lead.website;

  let websiteVerified: string[] = [];
  if (!options?.skipWebsiteCrawl) {
    const crawl = await crawlEmailForWebsite(effectiveWebsite);
    if (crawl.emails.length > 0) {
      if (crawl.emailSource === "generated") {
        return applyPredictedEmailsToLead(lead, crawl.emails);
      }
      return buildVerifiedLead(lead, crawl.emails);
    }
    websiteVerified = [];
  }

  const mergedVerified = mergeEmails(mapsVerified, websiteVerified);
  const allVerified = pickBestEmail(mergedVerified, effectiveWebsite ?? lead.website, 100);
  if (allVerified.length > 0) {
    return buildVerifiedLead(lead, allVerified);
  }

  if (!effectiveWebsite?.trim() && !lead.website?.trim()) {
    return {
      ...lead,
      emails: [],
      verifiedEmails: [],
      predictedEmails: [],
      email: null,
      emailSource: "none",
    };
  }

  const predictions = await generatePredictedEmails({
    businessName: lead.name,
    website: effectiveWebsite ?? lead.website,
    category: lead.category,
  });

  const validPredictions = predictions.filter((p) => isValidEmail(p.email));
  if (validPredictions.length > 0) {
    const predictedAddresses = validPredictions.map((p) => p.email);
    return {
      ...lead,
      emails: [],
      verifiedEmails: [],
      predictedEmails: validPredictions,
      email: predictedAddresses.join(", "),
      emailSource: "predicted",
    };
  }

  const domain = resolveGenerationDomain(effectiveWebsite ?? lead.website);
  if (domain) {
    const fallbackAddresses = generateEmailsFromWebsite(
      effectiveWebsite ?? lead.website,
      lead.category,
      lead.name
    ).filter(isValidEmail);
    const fallbackEmails = pickBestEmail(
      fallbackAddresses,
      effectiveWebsite ?? lead.website,
      100
    );
    if (fallbackEmails.length > 0) {
      const predictedEmails: PredictedEmail[] = fallbackEmails.map((email) => ({
        email,
        confidence: 78,
        label: "medium" as const,
        source: "business_pattern" as const,
      }));
      const addresses = predictedEmails.map((p) => p.email);
      return {
        ...lead,
        emails: [],
        verifiedEmails: [],
        predictedEmails,
        email: addresses.join(", "),
        emailSource: "predicted",
      };
    }
  }

  return {
    ...lead,
    emails: [],
    verifiedEmails: [],
    predictedEmails: [],
    email: null,
    emailSource: "none",
  };
}

export function predictionStorageFields(lead: BusinessLead): {
  verified_email: string | null;
  predicted_email: string | null;
  predicted_email_secondary: string | null;
  prediction_confidence: number | null;
  prediction_confidence_secondary: number | null;
} {
  const verified =
    lead.emails.length > 0
      ? lead.emails.join(", ")
      : lead.verifiedEmails.length > 0
        ? lead.verifiedEmails.join(", ")
        : lead.email;

  const formatted = formatPredictedEmailsForStorage(lead.predictedEmails);

  return {
    verified_email: verified ?? null,
    predicted_email: formatted.primary,
    predicted_email_secondary: formatted.secondary,
    prediction_confidence: formatted.primaryConfidence,
    prediction_confidence_secondary: formatted.secondaryConfidence,
  };
}

export function predictionsFromDb(row: {
  predicted_email?: string | null;
  predicted_email_secondary?: string | null;
  prediction_confidence?: number | null;
  prediction_confidence_secondary?: number | null;
}): PredictedEmail[] {
  const out: PredictedEmail[] = [];
  if (row.predicted_email) {
    out.push({
      email: row.predicted_email,
      confidence: row.prediction_confidence ?? 80,
      label:
        (row.prediction_confidence ?? 0) >= 90
          ? "high"
          : (row.prediction_confidence ?? 0) >= 75
            ? "medium"
            : "low",
      source: "business_pattern",
    });
  }
  if (row.predicted_email_secondary) {
    out.push({
      email: row.predicted_email_secondary,
      confidence: row.prediction_confidence_secondary ?? 75,
      label:
        (row.prediction_confidence_secondary ?? 0) >= 90
          ? "high"
          : "medium",
      source: "business_pattern",
    });
  }
  return out;
}
