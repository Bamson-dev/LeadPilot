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
  dead_emails: string[];
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
  const row = await getDomainEmailCacheRow(domain);
  if (!row) return null;
  if (!isDomainCacheFresh(row.discovered_at)) return null;
  return row;
}

async function getDomainEmailCacheRow(domain: string): Promise<DomainEmailCacheRow | null> {
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
  return {
    ...row,
    dead_emails: Array.isArray(row.dead_emails) ? row.dead_emails : [],
  };
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

function normalizeDeadSet(deadEmails: string[] | undefined): Set<string> {
  return new Set((deadEmails ?? []).map((e) => e.toLowerCase().trim()).filter(Boolean));
}

function isDeadAddress(email: string | null | undefined, deadSet: Set<string>): boolean {
  if (!email) return false;
  return deadSet.has(email.toLowerCase().trim());
}

export async function markDomainEmailDead(params: {
  email: string;
  domain?: string | null;
}): Promise<void> {
  const normalizedEmail = params.email.toLowerCase().trim();
  const domain =
    params.domain?.toLowerCase().trim() ||
    normalizedEmail.split("@")[1]?.trim();
  if (!domain) return;

  const existing = await getDomainEmailCacheRow(domain);
  const deadEmails = normalizeDeadSet(existing?.dead_emails);
  deadEmails.add(normalizedEmail);

  if (existing) {
    const { error } = await supabase
      .from("domain_email_cache")
      .update({
        dead_emails: [...deadEmails],
        updated_at: new Date().toISOString(),
      })
      .eq("domain", domain);

    if (error) {
      logger.warn("[domain-email-cache] Mark dead failed", {
        domain,
        email: normalizedEmail,
        error: error.message,
      });
    }
    return;
  }

  const { error } = await supabase.from("domain_email_cache").upsert(
    {
      domain,
      email: normalizedEmail,
      email_secondary: null,
      source: "scraped",
      confidence: 0,
      confidence_secondary: null,
      dead_emails: [normalizedEmail],
      discovered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "domain" }
  );

  if (error) {
    logger.warn("[domain-email-cache] Seed dead entry failed", {
      domain,
      email: normalizedEmail,
      error: error.message,
    });
  }
}

export function domainCacheToEnrichment(row: DomainEmailCacheRow): {
  verifiedEmails: string[];
  predictedEmails: PredictedEmail[];
  emailSource: "website" | "predicted";
} {
  const deadSet = normalizeDeadSet(row.dead_emails);

  if (row.source === "scraped") {
    const verified = [row.email, row.email_secondary].filter(
      (email): email is string => Boolean(email) && !isDeadAddress(email, deadSet)
    );
    return {
      verifiedEmails: verified,
      predictedEmails: [],
      emailSource: "website",
    };
  }

  const predicted: PredictedEmail[] = [];
  if (!isDeadAddress(row.email, deadSet)) {
    predicted.push({
      email: row.email,
      confidence: row.confidence,
      label: row.confidence >= 90 ? "high" : row.confidence >= 75 ? "medium" : "low",
      source: "business_pattern",
    });
  }
  if (row.email_secondary && !isDeadAddress(row.email_secondary, deadSet)) {
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
