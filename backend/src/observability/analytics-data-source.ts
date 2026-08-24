import { supabase } from "../database/client";
import {
  appendLocalAnalyticsEvents,
  countLocalAnalyticsEvents,
  listLocalAnalyticsEvents,
  type LocalAnalyticsEvent,
} from "../storage/local-analytics-store";

/** Default: store analytics on server disk, not Supabase (free-tier egress/storage). */
export function analyticsUsesSupabase(): boolean {
  return process.env.ANALYTICS_SUPABASE_SYNC === "1";
}

export type AnalyticsEventRow = LocalAnalyticsEvent;

export async function persistAnalyticsBatch(batch: AnalyticsEventRow[]): Promise<void> {
  await appendLocalAnalyticsEvents(batch);
  if (!analyticsUsesSupabase()) return;
  const { error } = await supabase.from("analytics_events").insert(batch);
  if (error && error.code !== "23505") {
    throw new Error(error.message);
  }
}

export type AnalyticsQueryFilter = {
  from: string;
  to: string;
  eventName?: string | null;
  category?: string | null;
  source?: string | null;
  userEmailHash?: string | null;
  licenseId?: string | null;
  search?: string;
};

export async function countAnalyticsEvents(filter: AnalyticsQueryFilter): Promise<number> {
  if (!analyticsUsesSupabase()) {
    return countLocalAnalyticsEvents(filter);
  }
  let query = supabase
    .from("analytics_events")
    .select("id", { count: "exact", head: true })
    .gte("occurred_at", filter.from)
    .lte("occurred_at", filter.to);
  if (filter.eventName) query = query.eq("event_name", filter.eventName);
  if (filter.category) query = query.eq("event_category", filter.category);
  if (filter.source) query = query.eq("source", filter.source);
  if (filter.userEmailHash) query = query.eq("user_email_hash", filter.userEmailHash);
  if (filter.licenseId) query = query.eq("license_id", filter.licenseId);
  const { count } = await query;
  return count ?? 0;
}

export async function listAnalyticsEvents(
  filter: AnalyticsQueryFilter,
  paging: { limit: number; offset: number; ascending?: boolean }
): Promise<{ rows: AnalyticsEventRow[]; total: number }> {
  if (!analyticsUsesSupabase()) {
    return listLocalAnalyticsEvents(filter, paging);
  }
  let query = supabase
    .from("analytics_events")
    .select("*", { count: "exact" })
    .gte("occurred_at", filter.from)
    .lte("occurred_at", filter.to)
    .order("occurred_at", { ascending: Boolean(paging.ascending) })
    .range(paging.offset, paging.offset + paging.limit - 1);
  if (filter.eventName) query = query.eq("event_name", filter.eventName);
  if (filter.category) query = query.eq("event_category", filter.category);
  const { data, count } = await query;
  return { rows: (data ?? []) as AnalyticsEventRow[], total: count ?? 0 };
}
