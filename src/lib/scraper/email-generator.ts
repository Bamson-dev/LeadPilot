import { MAX_GENERATED_EMAILS } from "../constants";
import { resolveGenerationDomain } from "./domain-utils";
import { formatEmailsForDisplay } from "./email-filter";

/** Broad pool — mixed prefixes so output varies per business */
const GENERAL_POOL = [
  "info",
  "contact",
  "hello",
  "support",
  "bookings",
  "reservations",
  "appointments",
  "inquiry",
  "enquiries",
  "mail",
  "office",
  "sales",
  "admin",
  "help",
  "team",
  "desk",
  "service",
  "customerservice",
  "reception",
  "general",
] as const;

type CategoryPool = { match: RegExp; pool: readonly string[] };

const CATEGORY_POOLS: CategoryPool[] = [
  {
    match: /restaurant|food|cafe|bistro|bar|grill|kitchen|dining|eatery|pizza/i,
    pool: [
      "info",
      "hello",
      "contact",
      "bookings",
      "reservations",
      "inquiry",
      "support",
      "mail",
      "team",
      "office",
      "enquiries",
      "desk",
    ],
  },
  {
    match: /hotel|resort|lodge|inn|motel|hospitality/i,
    pool: [
      "info",
      "contact",
      "hello",
      "reservations",
      "bookings",
      "frontdesk",
      "reception",
      "concierge",
      "support",
      "mail",
      "enquiries",
    ],
  },
  {
    match: /agency|marketing|consult|studio|creative|digital/i,
    pool: [
      "hello",
      "contact",
      "info",
      "sales",
      "studio",
      "team",
      "inquiry",
      "support",
      "mail",
      "projects",
    ],
  },
  {
    match: /medical|clinic|dental|hospital|health|doctor|pharmacy|spa/i,
    pool: [
      "info",
      "appointments",
      "contact",
      "hello",
      "bookings",
      "clinic",
      "reception",
      "support",
      "inquiry",
      "care",
    ],
  },
  {
    match: /salon|beauty|barber|nail/i,
    pool: [
      "hello",
      "bookings",
      "info",
      "contact",
      "appointments",
      "studio",
      "inquiry",
      "mail",
    ],
  },
  {
    match: /gym|fitness|yoga|wellness/i,
    pool: [
      "info",
      "hello",
      "contact",
      "bookings",
      "membership",
      "support",
      "team",
    ],
  },
  {
    match: /real\s*estate|property|realtor/i,
    pool: [
      "info",
      "contact",
      "sales",
      "hello",
      "inquiry",
      "enquiries",
      "office",
      "listings",
    ],
  },
];

function hashSeed(...parts: (string | null | undefined)[]): number {
  const s = parts.filter(Boolean).join("|").toLowerCase();
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  let state = seed || 1;
  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function prefixPoolForCategory(category: string | null | undefined): string[] {
  const cat = (category ?? "").trim();
  for (const rule of CATEGORY_POOLS) {
    if (rule.match.test(cat)) {
      return [...new Set([...rule.pool, ...GENERAL_POOL])];
    }
  }
  return [...GENERAL_POOL];
}

/** Pick N varied prefixes — deterministic per domain + business name */
export function pickVariedPrefixes(
  domain: string,
  category: string | null | undefined,
  businessName: string | null | undefined,
  count = MAX_GENERATED_EMAILS
): string[] {
  const pool = prefixPoolForCategory(category);
  const seed = hashSeed(domain, businessName, category);
  const shuffled = seededShuffle(pool, seed);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/** Build 1–2 varied contact addresses for a domain */
export function generateEmailsForDomain(
  domain: string,
  category?: string | null,
  businessName?: string | null
): string[] {
  const root = domain.replace(/^www\./i, "").toLowerCase();
  if (!root.includes(".")) return [];

  const prefixes = pickVariedPrefixes(root, category, businessName);
  return prefixes.map((prefix) => `${prefix}@${root}`);
}

export function generateEmailsFromWebsite(
  website: string | null | undefined,
  category?: string | null,
  businessName?: string | null
): string[] {
  const domain = resolveGenerationDomain(website);
  if (!domain) return [];
  return generateEmailsForDomain(domain, category, businessName);
}

export function formatGeneratedEmails(
  website: string | null | undefined,
  category?: string | null,
  businessName?: string | null
): string | null {
  if (!website?.trim()) return null;
  const emails = generateEmailsFromWebsite(website, category, businessName);
  return formatEmailsForDisplay(emails, MAX_GENERATED_EMAILS);
}
