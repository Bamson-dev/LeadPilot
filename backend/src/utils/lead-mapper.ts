import type { BusinessLead, PredictedEmail } from "@leadpilot/shared";
import type { RawLeadInput } from "../types/scraper";
import { crawlEmailForWebsite } from "../scraper/emailCrawler/email-crawler";
import { parseMapsEmailsFromLead } from "../scraper/utils/lead-email";
import { mergeEmails, parseEmailList } from "../scraper/parsers/email-filter";
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
  const primary = verified[0] ?? null;
  return {
    ...lead,
    verifiedEmails: verified,
    predictedEmails: [],
    email: primary,
    emailSource: verified.length > 0 ? "website" : "none",
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
    return buildVerifiedLead(base, mapsVerified.slice(0, 2));
  }

  return base;
}

export async function enrichLeadEmail(
  lead: BusinessLead
): Promise<BusinessLead> {
  const mapsVerified =
    lead.verifiedEmails.length > 0
      ? lead.verifiedEmails
      : lead.email
        ? parseEmailList(lead.email)
        : [];

  const crawl = await crawlEmailForWebsite(lead.website);
  const websiteVerified =
    crawl.emailSource === "website" && crawl.email
      ? parseEmailList(crawl.email)
      : [];

  const verified = mergeEmails(mapsVerified, websiteVerified).slice(0, 2);
  if (verified.length > 0) {
    return buildVerifiedLead(lead, verified);
  }

  if (!lead.website?.trim()) {
    return {
      ...lead,
      verifiedEmails: [],
      predictedEmails: [],
      email: null,
      emailSource: "none",
    };
  }

  const predictions = await generatePredictedEmails({
    businessName: lead.name,
    website: lead.website,
    category: lead.category,
  });

  if (predictions.length === 0) {
    return {
      ...lead,
      verifiedEmails: [],
      predictedEmails: [],
      email: null,
      emailSource: "none",
    };
  }

  return {
    ...lead,
    verifiedEmails: [],
    predictedEmails: predictions,
    email: null,
    emailSource: "predicted",
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
    lead.verifiedEmails.length > 0
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
  return out.slice(0, 2);
}
