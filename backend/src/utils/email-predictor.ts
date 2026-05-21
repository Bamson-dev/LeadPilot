import dns from "node:dns/promises";
import type {
  ConfidenceLabel,
  PredictedEmail,
  PredictionSource,
} from "@leadpilot/shared";
import { isValidEmail } from "../scraper/parsers/email-validation";
import { resolveGenerationDomain } from "../scraper/utils/domain-utils";

const MIN_CONFIDENCE = 70;
const MAX_PREDICTIONS = 2;
const MX_CACHE_TTL_MS = 10 * 60 * 1000;

const BLOCKED_LOCAL_PARTS = new Set([
  "noreply",
  "no-reply",
  "donotreply",
  "mailer-daemon",
  "postmaster",
  "admin123",
  "support123",
  "test",
  "testing",
  "abuse",
  "spam",
]);

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "tempmail.com",
  "10minutemail.com",
  "yopmail.com",
  "throwaway.email",
  "getnada.com",
  "sharklasers.com",
]);

const HIGH_PREFIXES = new Set(["info", "contact", "hello"]);

const BASE_PREFIX_PRIORITY = [
  "info",
  "contact",
  "hello",
  "support",
  "sales",
  "bookings",
  "reservations",
] as const;

type CategoryRule = {
  match: RegExp;
  prefixes: readonly string[];
};

const CATEGORY_RULES: CategoryRule[] = [
  {
    match: /restaurant|food|cafe|bistro|bar|grill|kitchen|dining|eatery|pizza/i,
    prefixes: ["reservations", "bookings", "info", "contact", "hello"],
  },
  {
    match: /agency|marketing|consult|studio|creative|digital/i,
    prefixes: ["hello", "contact", "team", "info"],
  },
  {
    match: /salon|beauty|barber|nail/i,
    prefixes: ["bookings", "hello", "contact", "info"],
  },
  {
    match: /law|legal|attorney|solicitor/i,
    prefixes: ["office", "contact", "info"],
  },
  {
    match: /hotel|resort|lodge|inn|hospitality/i,
    prefixes: ["reservations", "contact", "info", "hello"],
  },
  {
    match: /medical|clinic|dental|hospital|health|doctor|pharmacy|spa/i,
    prefixes: ["appointments", "info", "contact", "hello"],
  },
];

export interface EmailPredictionInput {
  businessName?: string | null;
  domain?: string | null;
  website?: string | null;
  category?: string | null;
  ownerNames?: string[];
}

interface ScoredCandidate {
  email: string;
  prefix: string;
  source: PredictionSource;
}

const mxCache = new Map<string, { ok: boolean; expires: number }>();

function normalizeDomain(domain: string): string | null {
  const root = resolveGenerationDomain(domain.startsWith("http") ? domain : `https://${domain}`);
  if (!root) return null;
  if (DISPOSABLE_DOMAINS.has(root)) return null;
  return root;
}

export function isValidEmailFormat(email: string): boolean {
  if (!isValidEmail(email)) return false;
  const [local] = email.toLowerCase().split("@");
  if (local && BLOCKED_LOCAL_PARTS.has(local)) return false;
  const domain = email.toLowerCase().split("@")[1];
  if (domain && DISPOSABLE_DOMAINS.has(domain)) return false;
  return true;
}

export async function validateMXRecord(domain: string): Promise<boolean> {
  const host = normalizeDomain(domain);
  if (!host) return false;

  const cached = mxCache.get(host);
  if (cached && cached.expires > Date.now()) return cached.ok;

  try {
    const records = await dns.resolveMx(host);
    const ok = Array.isArray(records) && records.some((r) => r.exchange?.length);
    mxCache.set(host, { ok, expires: Date.now() + MX_CACHE_TTL_MS });
    return ok;
  } catch {
    try {
      const records = await dns.resolve4(host);
      const ok = records.length > 0;
      mxCache.set(host, { ok, expires: Date.now() + MX_CACHE_TTL_MS });
      return ok;
    } catch {
      mxCache.set(host, { ok: false, expires: Date.now() + MX_CACHE_TTL_MS });
      return false;
    }
  }
}

export function scorePredictionConfidence(
  prefix: string,
  source: PredictionSource,
  category?: string | null
): { confidence: number; label: ConfidenceLabel } {
  const p = prefix.toLowerCase();
  const cat = (category ?? "").toLowerCase();

  if (source === "owner_name") {
    if (/^[a-z]+\.[a-z]{2,}$/.test(p)) {
      return { confidence: 76, label: "medium" };
    }
    return { confidence: 78, label: "medium" };
  }

  let confidence = 82;
  if (HIGH_PREFIXES.has(p)) confidence = p === "info" ? 95 : p === "contact" ? 93 : 92;
  else if (p === "support") confidence = 88;
  else if (p === "sales") confidence = 85;
  else if (p === "bookings") confidence = cat.match(/restaurant|salon|hotel|spa/) ? 91 : 86;
  else if (p === "reservations") confidence = cat.match(/restaurant|hotel/) ? 92 : 84;
  else if (p === "office") confidence = cat.match(/law|legal/) ? 90 : 83;
  else if (p === "team") confidence = cat.match(/agency|marketing/) ? 88 : 80;
  else if (p === "appointments") confidence = cat.match(/medical|clinic|dental/) ? 89 : 82;

  if (source === "category_pattern") confidence = Math.min(97, confidence + 2);

  const label: ConfidenceLabel =
    confidence >= 90 ? "high" : confidence >= 75 ? "medium" : "low";

  return { confidence, label };
}

function prefixesForCategory(category: string | null | undefined): string[] {
  const cat = (category ?? "").trim();
  for (const rule of CATEGORY_RULES) {
    if (rule.match.test(cat)) {
      return [...new Set([...rule.prefixes, ...BASE_PREFIX_PRIORITY])].slice(0, 8);
    }
  }
  return [...BASE_PREFIX_PRIORITY];
}

function parseOwnerName(raw: string): { first: string; last?: string } | null {
  const cleaned = raw
    .replace(/^(mr|mrs|ms|dr|prof)\.?\s+/i, "")
    .replace(/[^a-zA-Z\s'-]/g, " ")
    .trim();
  const parts = cleaned.split(/\s+/).filter((p) => p.length >= 2);
  if (parts.length < 1 || parts.length > 4) return null;
  const first = parts[0].toLowerCase();
  if (first.length < 2 || first.length > 20) return null;
  if (!/^[a-z'-]+$/.test(first)) return null;
  const last = parts.length >= 2 ? parts[parts.length - 1].toLowerCase() : undefined;
  if (last && (last.length < 2 || !/^[a-z'-]+$/.test(last))) return null;
  return { first, last: last !== first ? last : undefined };
}

function ownerCandidates(names: string[], domain: string): ScoredCandidate[] {
  const out: ScoredCandidate[] = [];
  const seen = new Set<string>();

  for (const raw of names.slice(0, 2)) {
    const parsed = parseOwnerName(raw);
    if (!parsed) continue;

    const variants = [parsed.first];
    if (parsed.last) variants.push(`${parsed.first}.${parsed.last}`);

    for (const local of variants) {
      const email = `${local}@${domain}`;
      if (seen.has(email)) continue;
      seen.add(email);
      out.push({ email, prefix: local, source: "owner_name" });
    }
  }

  return out;
}

function businessCandidates(
  domain: string,
  category: string | null | undefined
): ScoredCandidate[] {
  const prefixes = prefixesForCategory(category);
  const source: PredictionSource = category?.trim()
    ? "category_pattern"
    : "business_pattern";

  return prefixes.map((prefix) => ({
    email: `${prefix}@${domain}`,
    prefix,
    source,
  }));
}

/**
 * Generate up to 2 high-confidence predicted emails for a business domain.
 * Returns empty when MX/validation fails or nothing meets the confidence threshold.
 */
export async function generatePredictedEmails(
  input: EmailPredictionInput
): Promise<PredictedEmail[]> {
  const domain =
    normalizeDomain(input.domain ?? "") ??
    (input.website ? normalizeDomain(input.website) : null);

  if (!domain) return [];

  const mxValid = await validateMXRecord(domain);
  if (!mxValid) return [];

  const candidates: ScoredCandidate[] = [
    ...businessCandidates(domain, input.category),
    ...ownerCandidates(input.ownerNames ?? [], domain),
  ];

  const seen = new Set<string>();
  const scored: PredictedEmail[] = [];

  for (const candidate of candidates) {
    if (!isValidEmailFormat(candidate.email)) continue;
    if (seen.has(candidate.email)) continue;
    seen.add(candidate.email);

    const { confidence, label } = scorePredictionConfidence(
      candidate.prefix,
      candidate.source,
      input.category
    );

    if (confidence < MIN_CONFIDENCE || label === "low") continue;

    scored.push({
      email: candidate.email,
      confidence,
      label,
      source: candidate.source,
    });

    if (scored.length >= MAX_PREDICTIONS) break;
  }

  scored.sort((a, b) => b.confidence - a.confidence);
  return scored.slice(0, MAX_PREDICTIONS);
}

export function formatPredictedEmailsForStorage(
  predictions: PredictedEmail[]
): {
  primary: string | null;
  secondary: string | null;
  primaryConfidence: number | null;
  secondaryConfidence: number | null;
} {
  const [a, b] = predictions;
  return {
    primary: a?.email ?? null,
    secondary: b?.email ?? null,
    primaryConfidence: a?.confidence ?? null,
    secondaryConfidence: b?.confidence ?? null,
  };
}
