import type { BrowserContext } from "playwright";
import type { BusinessLead, PredictedEmail } from "@leadthur/shared";
import type { RawLeadInput } from "../types/scraper";
import { parseMapsEmailsFromLead } from "../scraper/utils/lead-email";
import { isValidEmail, pickBestEmail } from "../scraper/parsers/email-validation";
import { formatPredictedEmailsForStorage } from "./email-predictor";
import {
  enrichBusinessLeadEmail,
  enrichmentToBusinessLead,
} from "../services/email-enrichment-service";

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
    emailScraped: false,
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

/** Apply MX-validated predictions with real confidence scores. */
export function applyPredictedEmailsToLead(
  lead: BusinessLead,
  predictions: PredictedEmail[]
): BusinessLead {
  const valid = predictions.filter((p) => isValidEmail(p.email));
  if (valid.length === 0) {
    return { ...lead, emailSource: "none" };
  }

  const addresses = valid.map((p) => p.email);
  return {
    ...lead,
    emails: [],
    verifiedEmails: [],
    predictedEmails: valid,
    email: addresses.join(", "),
    emailSource: "predicted",
  };
}

export async function enrichLeadEmail(
  lead: BusinessLead,
  options?: { skipWebsiteCrawl?: boolean; browserContext?: BrowserContext }
): Promise<BusinessLead> {
  const enrichment = await enrichBusinessLeadEmail(lead, {
    browserContext: options?.browserContext,
    skipPlaywrightScrape: options?.skipWebsiteCrawl,
  });
  return enrichmentToBusinessLead(lead, enrichment);
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
    const confidence = row.prediction_confidence ?? 80;
    out.push({
      email: row.predicted_email,
      confidence,
      label: confidence >= 90 ? "high" : confidence >= 75 ? "medium" : "low",
      source: "business_pattern",
    });
  }
  if (row.predicted_email_secondary) {
    const confidence = row.prediction_confidence_secondary ?? 75;
    out.push({
      email: row.predicted_email_secondary,
      confidence,
      label: confidence >= 90 ? "high" : confidence >= 75 ? "medium" : "low",
      source: "business_pattern",
    });
  }
  return out;
}
