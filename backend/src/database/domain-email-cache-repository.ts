import type { PredictedEmail } from "@leadthur/shared";
import { supabase } from "./client";
import { logger } from "../utils/logger";

export type DomainEmailCacheSource = "scraped" | "predicted";

export interface DomainEmailCacheRow {
  domain: string;
  email: string;
  email_secondary: string | null;
  source: DomainEmailCacheSource;
  confidence: number;
  confidence_secondary: number | null;
  discovered_at: string;
  updated_at: string;
}

export interface DomainEmailCacheWrite {
  domain: string;
  email: string;
  emailSecondary?: string | null;
  source: DomainEmailCacheSource;
  confidence: number;
  confidenceSecondary?: number | null;
}

const CACHE_FRESHNESS_MS = 30 * 24 * 60 * 60 * 1000;

export function isDomainCacheFresh(discoveredAt: string): boolean {
  const ts = Date.parse(discoveredAt);
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts < CACHE_FRESHNESS_MS;
}

export async function getDomainEmailCache(
  domain: string
): Promise<DomainEmailCacheRow | null> {
  const { data, error } = await supabase
    .from("domain_email_cache")
    .select("*")
    .eq("domain", domain)
    .maybeSingle();

  if (error) {
    logger.warn("[domain-email-cache] Lookup failed", {
      domain,
      error: error.message,
    });
    return null;
  }

  if (!data) return null;
  const row = data as DomainEmailCacheRow;
  if (!isDomainCacheFresh(row.discovered_at)) return null;
  return row;
}

export async function upsertDomainEmailCache(
  entry: DomainEmailCacheWrite
): Promise<void> {
  const { error } = await supabase.from("domain_email_cache").upsert(
    {
      domain: entry.domain,
      email: entry.email,
      email_secondary: entry.emailSecondary ?? null,
      source: entry.source,
      confidence: entry.confidence,
      confidence_secondary: entry.confidenceSecondary ?? null,
      discovered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "domain" }
  );

  if (error) {
    logger.warn("[domain-email-cache] Upsert failed", {
      domain: entry.domain,
      error: error.message,
    });
  }
}

export function domainCacheToEnrichment(row: DomainEmailCacheRow): {
  verifiedEmails: string[];
  predictedEmails: PredictedEmail[];
  emailSource: "website" | "predicted";
} {
  if (row.source === "scraped") {
    const verified = [row.email, row.email_secondary].filter(Boolean) as string[];
    return {
      verifiedEmails: verified,
      predictedEmails: [],
      emailSource: "website",
    };
  }

  const predicted: PredictedEmail[] = [
    {
      email: row.email,
      confidence: row.confidence,
      label: row.confidence >= 90 ? "high" : row.confidence >= 75 ? "medium" : "low",
      source: "business_pattern",
    },
  ];
  if (row.email_secondary) {
    predicted.push({
      email: row.email_secondary,
      confidence: row.confidence_secondary ?? 75,
      label:
        (row.confidence_secondary ?? 0) >= 90
          ? "high"
          : (row.confidence_secondary ?? 0) >= 75
            ? "medium"
            : "low",
      source: "business_pattern",
    });
  }

  return {
    verifiedEmails: [],
    predictedEmails: predicted,
    emailSource: "predicted",
  };
}
