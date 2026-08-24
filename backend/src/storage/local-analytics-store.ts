import { appendFile, mkdir, readdir, readFile } from "fs/promises";
import path from "path";
import { getStorageRoot } from "./blog-cover-storage";
import { logger } from "../utils/logger";

export type LocalAnalyticsEvent = {
  event_name: string;
  event_category: string;
  occurred_at: string;
  session_id: string | null;
  anonymous_id: string | null;
  user_email_hash: string | null;
  license_id: string | null;
  correlation_id: string | null;
  search_id: string | null;
  job_id: string | null;
  source: string;
  environment: string;
  page_path: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  fbclid: string | null;
  gclid: string | null;
  landing_page: string | null;
  country: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  properties: Record<string, unknown>;
  duration_ms: number | null;
  idempotency_key: string | null;
};

const ANALYTICS_SUBDIR = "analytics";

function analyticsDir(): string {
  return path.join(getStorageRoot(), ANALYTICS_SUBDIR);
}

function dayFileName(isoDate: string): string {
  const day = isoDate.slice(0, 10);
  return `events-${day}.jsonl`;
}

function listDayKeys(fromIso: string, toIso: string): string[] {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  const days: string[] = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

export async function appendLocalAnalyticsEvents(rows: LocalAnalyticsEvent[]): Promise<void> {
  if (rows.length === 0) return;
  const dir = analyticsDir();
  await mkdir(dir, { recursive: true });
  const byDay = new Map<string, LocalAnalyticsEvent[]>();
  for (const row of rows) {
    const day = row.occurred_at.slice(0, 10);
    const bucket = byDay.get(day) ?? [];
    bucket.push(row);
    byDay.set(day, bucket);
  }
  await Promise.all(
    [...byDay.entries()].map(async ([day, events]) => {
      const filePath = path.join(dir, dayFileName(`${day}T00:00:00.000Z`));
      const payload = events.map((e) => JSON.stringify(e)).join("\n") + "\n";
      await appendFile(filePath, payload, "utf8");
    })
  );
}

async function readEventsInRange(fromIso: string, toIso: string): Promise<LocalAnalyticsEvent[]> {
  const dir = analyticsDir();
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }
  const wanted = new Set(listDayKeys(fromIso, toIso).map((d) => dayFileName(`${d}T00:00:00.000Z`)));
  const matched = files.filter((f) => wanted.has(f)).sort();
  const fromMs = new Date(fromIso).getTime();
  const toMs = new Date(toIso).getTime();
  const out: LocalAnalyticsEvent[] = [];

  for (const file of matched) {
    try {
      const raw = await readFile(path.join(dir, file), "utf8");
      for (const line of raw.split("\n")) {
        if (!line.trim()) continue;
        try {
          const row = JSON.parse(line) as LocalAnalyticsEvent;
          const t = new Date(row.occurred_at).getTime();
          if (t >= fromMs && t <= toMs) out.push(row);
        } catch {
          logger.debug("[local-analytics] skipped bad jsonl line");
        }
      }
    } catch {
      /* missing file */
    }
  }
  return out;
}

export type LocalAnalyticsFilter = {
  from: string;
  to: string;
  eventName?: string | null;
  category?: string | null;
  source?: string | null;
  userEmailHash?: string | null;
  licenseId?: string | null;
  search?: string;
};

function matchesFilter(row: LocalAnalyticsEvent, filter: LocalAnalyticsFilter): boolean {
  if (filter.eventName && row.event_name !== filter.eventName) return false;
  if (filter.category && row.event_category !== filter.category) return false;
  if (filter.source && row.source !== filter.source) return false;
  if (filter.userEmailHash && row.user_email_hash !== filter.userEmailHash) return false;
  if (filter.licenseId && row.license_id !== filter.licenseId) return false;
  if (filter.search) {
    const q = filter.search.toLowerCase();
    const hay = JSON.stringify(row).toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

export async function countLocalAnalyticsEvents(filter: LocalAnalyticsFilter): Promise<number> {
  const rows = await readEventsInRange(filter.from, filter.to);
  return rows.filter((r) => matchesFilter(r, filter)).length;
}

export async function listLocalAnalyticsEvents(
  filter: LocalAnalyticsFilter,
  paging: { limit: number; offset: number; ascending?: boolean }
): Promise<{ rows: LocalAnalyticsEvent[]; total: number }> {
  const rows = await readEventsInRange(filter.from, filter.to).then((all) =>
    all.filter((r) => matchesFilter(r, filter))
  );
  rows.sort((a, b) => {
    const diff = new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime();
    return paging.ascending ? diff : -diff;
  });
  const total = rows.length;
  return {
    rows: rows.slice(paging.offset, paging.offset + paging.limit),
    total,
  };
}

/** Count search_started for a user without hitting Supabase analytics. */
export async function countLocalSearchStarted(input: {
  userEmailHash?: string | null;
  licenseId?: string | null;
}): Promise<number> {
  const to = new Date().toISOString();
  const from = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
  return countLocalAnalyticsEvents({
    from,
    to,
    eventName: "search_started",
    source: "server",
    userEmailHash: input.userEmailHash ?? undefined,
    licenseId: input.licenseId ?? undefined,
  });
}
