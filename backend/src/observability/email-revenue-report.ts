/**
 * Phase 2.2 — Email → revenue aggregation (last nurture CTA click model).
 * Reads analytics_events only. Does not fabricate historical clicks.
 */

import { supabase } from "../database/client";
import {
  NURTURE_ATTRIBUTION_WINDOW_DAYS,
  NURTURE_CAMPAIGN_V3,
  NURTURE_EMAIL_CHANNEL,
  parseNurtureStepFromContent,
} from "../services/email-nurture-attribution";
import { SALE_PRICE_USD } from "../constants/pricing";
import { EVENT_NAMES } from "./event-taxonomy";

export type EmailRevenueRow = {
  email: string;
  sequenceVersion: number;
  sequenceStep: number;
  sends: number;
  uniqueOpens: number;
  totalOpens: number;
  clicks: number;
  uniqueClickers: number;
  searches: number;
  checkouts: number;
  purchases: number;
  activations: number;
  outreach: number;
  revenueUsd: number;
  openRate: number | null;
  clickRate: number | null;
  clickToSearchRate: number | null;
  clickToCheckoutRate: number | null;
  clickToPurchaseRate: number | null;
  revenuePerEmail: number | null;
  revenuePerRecipient: number | null;
};

type ClickRow = {
  user_email_hash: string | null;
  occurred_at: string;
  utm_content: string | null;
  utm_term: string | null;
  properties: Record<string, unknown> | null;
};

function stepFromEvent(row: {
  utm_content?: string | null;
  properties?: Record<string, unknown> | null;
}): number | null {
  const fromContent = parseNurtureStepFromContent(row.utm_content);
  if (fromContent != null) return fromContent;
  const props = row.properties || {};
  const step = Number(props.sequence_step);
  return Number.isFinite(step) ? step : null;
}

function versionFromEvent(row: {
  utm_content?: string | null;
  properties?: Record<string, unknown> | null;
}): number {
  const props = row.properties || {};
  const fromProps = Number(props.sequence_version);
  if (Number.isFinite(fromProps) && fromProps > 0) return fromProps;
  const content = row.utm_content || "";
  const match = /^trial_v(\d+)_step_/i.exec(content);
  if (match) return Number(match[1]);
  return 3;
}

function emptyRow(sequenceVersion: number, sequenceStep: number): EmailRevenueRow {
  return {
    email: `trial_v${sequenceVersion}_step_${sequenceStep}`,
    sequenceVersion,
    sequenceStep,
    sends: 0,
    uniqueOpens: 0,
    totalOpens: 0,
    clicks: 0,
    uniqueClickers: 0,
    searches: 0,
    checkouts: 0,
    purchases: 0,
    activations: 0,
    outreach: 0,
    revenueUsd: 0,
    openRate: null,
    clickRate: null,
    clickToSearchRate: null,
    clickToCheckoutRate: null,
    clickToPurchaseRate: null,
    revenuePerEmail: null,
    revenuePerRecipient: null,
  };
}

function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function isNurtureRow(row: {
  utm_campaign?: string | null;
  properties?: Record<string, unknown> | null;
}): boolean {
  if (row.utm_campaign === NURTURE_CAMPAIGN_V3) return true;
  const channel = row.properties?.email_channel;
  return channel === NURTURE_EMAIL_CHANNEL;
}

/**
 * Last email click before conversion within the attribution window.
 */
function lastClickFor(
  clicksByHash: Map<string, ClickRow[]>,
  hash: string | null | undefined,
  atIso: string
): ClickRow | null {
  if (!hash) return null;
  const clicks = clicksByHash.get(hash);
  if (!clicks || clicks.length === 0) return null;
  const at = new Date(atIso).getTime();
  const windowMs = NURTURE_ATTRIBUTION_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  let best: ClickRow | null = null;
  for (const click of clicks) {
    const t = new Date(click.occurred_at).getTime();
    if (Number.isNaN(t) || t > at) continue;
    if (at - t > windowMs) continue;
    if (!best || t > new Date(best.occurred_at).getTime()) best = click;
  }
  return best;
}

/** Prefer explicit amount_usd; else USD amount; else known lifetime price (no FX inventing). */
function revenueFromPayment(props: Record<string, unknown> | null | undefined): number {
  if (!props) return SALE_PRICE_USD;
  const amountUsd = Number(props.amount_usd);
  if (Number.isFinite(amountUsd) && amountUsd > 0) return amountUsd;
  const currency = String(props.currency || "").toUpperCase();
  const amount = Number(props.amount);
  if (currency === "USD" && Number.isFinite(amount) && amount > 0) return amount;
  return SALE_PRICE_USD;
}

export async function buildEmailRevenueReport(params: {
  from: string;
  to: string;
  sequenceVersion?: number;
  sequenceStep?: number;
}): Promise<{
  from: string;
  to: string;
  attributionModel: string;
  attributionWindowDays: number;
  metricsAvailableFrom: string;
  rows: EmailRevenueRow[];
  totals: EmailRevenueRow;
}> {
  const sequenceVersionFilter = params.sequenceVersion;
  const sequenceStepFilter = params.sequenceStep;

  const selectCols =
    "event_name,occurred_at,user_email_hash,utm_campaign,utm_content,utm_term,properties";

  const [{ data: emailEvents, error: emailErr }, { data: conversionEvents, error: convErr }] =
    await Promise.all([
      supabase
        .from("analytics_events")
        .select(selectCols)
        .in("event_name", [
          EVENT_NAMES.EMAIL_SENT,
          EVENT_NAMES.EMAIL_OPENED,
          EVENT_NAMES.EMAIL_CLICKED,
        ])
        .gte("occurred_at", params.from)
        .lte("occurred_at", params.to)
        .limit(5000),
      supabase
        .from("analytics_events")
        .select(selectCols)
        .in("event_name", [
          EVENT_NAMES.SEARCH_STARTED,
          EVENT_NAMES.CHECKOUT_STARTED,
          EVENT_NAMES.PAYMENT_COMPLETED,
          EVENT_NAMES.LICENSE_ACTIVATED,
          EVENT_NAMES.FIRST_OUTREACH,
        ])
        .gte("occurred_at", params.from)
        .lte("occurred_at", params.to)
        .limit(5000),
    ]);

  if (emailErr) throw emailErr;
  if (convErr) throw convErr;

  const rows = new Map<string, EmailRevenueRow>();
  const openHashes = new Map<string, Set<string>>();
  const clickHashes = new Map<string, Set<string>>();

  const ensure = (version: number, step: number): EmailRevenueRow => {
    const key = `${version}:${step}`;
    let row = rows.get(key);
    if (!row) {
      row = emptyRow(version, step);
      rows.set(key, row);
    }
    return row;
  };

  const nurtureEmailEvents = (emailEvents || []).filter(isNurtureRow);
  const clicks: ClickRow[] = [];

  for (const ev of nurtureEmailEvents) {
    const step = stepFromEvent(ev);
    if (step == null) continue;
    const version = versionFromEvent(ev);
    if (sequenceVersionFilter != null && version !== sequenceVersionFilter) continue;
    if (sequenceStepFilter != null && step !== sequenceStepFilter) continue;

    const row = ensure(version, step);
    const hash = ev.user_email_hash as string | null;
    const key = `${version}:${step}`;

    if (ev.event_name === EVENT_NAMES.EMAIL_SENT) {
      row.sends += 1;
    } else if (ev.event_name === EVENT_NAMES.EMAIL_OPENED) {
      row.totalOpens += 1;
      if (hash) {
        if (!openHashes.has(key)) openHashes.set(key, new Set());
        openHashes.get(key)!.add(hash);
      }
    } else if (ev.event_name === EVENT_NAMES.EMAIL_CLICKED) {
      row.clicks += 1;
      if (hash) {
        if (!clickHashes.has(key)) clickHashes.set(key, new Set());
        clickHashes.get(key)!.add(hash);
      }
      clicks.push({
        user_email_hash: hash,
        occurred_at: ev.occurred_at as string,
        utm_content: ev.utm_content as string | null,
        utm_term: ev.utm_term as string | null,
        properties: (ev.properties || null) as Record<string, unknown> | null,
      });
    }
  }

  // Also load clicks slightly before `from` so conversions near range start can attribute
  const clickLookback = new Date(
    new Date(params.from).getTime() - NURTURE_ATTRIBUTION_WINDOW_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  const { data: lookbackClicks } = await supabase
    .from("analytics_events")
    .select(selectCols)
    .eq("event_name", EVENT_NAMES.EMAIL_CLICKED)
    .gte("occurred_at", clickLookback)
    .lt("occurred_at", params.from)
    .limit(5000);

  for (const ev of lookbackClicks || []) {
    if (!isNurtureRow(ev)) continue;
    clicks.push({
      user_email_hash: ev.user_email_hash as string | null,
      occurred_at: ev.occurred_at as string,
      utm_content: ev.utm_content as string | null,
      utm_term: ev.utm_term as string | null,
      properties: (ev.properties || null) as Record<string, unknown> | null,
    });
  }

  const clicksByHash = new Map<string, ClickRow[]>();
  for (const click of clicks) {
    if (!click.user_email_hash) continue;
    const list = clicksByHash.get(click.user_email_hash) || [];
    list.push(click);
    clicksByHash.set(click.user_email_hash, list);
  }

  for (const [key, set] of openHashes) {
    const [version, step] = key.split(":").map(Number);
    ensure(version, step).uniqueOpens = set.size;
  }
  for (const [key, set] of clickHashes) {
    const [version, step] = key.split(":").map(Number);
    ensure(version, step).uniqueClickers = set.size;
  }

  for (const ev of conversionEvents || []) {
    const hash = ev.user_email_hash as string | null;
    const click = lastClickFor(clicksByHash, hash, ev.occurred_at as string);
    if (!click) continue;
    const step = stepFromEvent(click);
    if (step == null) continue;
    const version = versionFromEvent(click);
    if (sequenceVersionFilter != null && version !== sequenceVersionFilter) continue;
    if (sequenceStepFilter != null && step !== sequenceStepFilter) continue;
    const row = ensure(version, step);

    switch (ev.event_name) {
      case EVENT_NAMES.SEARCH_STARTED:
        row.searches += 1;
        break;
      case EVENT_NAMES.CHECKOUT_STARTED:
        row.checkouts += 1;
        break;
      case EVENT_NAMES.PAYMENT_COMPLETED:
        row.purchases += 1;
        row.revenueUsd += revenueFromPayment(
          (ev.properties || null) as Record<string, unknown> | null
        );
        break;
      case EVENT_NAMES.LICENSE_ACTIVATED:
        row.activations += 1;
        break;
      case EVENT_NAMES.FIRST_OUTREACH:
        row.outreach += 1;
        break;
      default:
        break;
    }
  }

  const list = Array.from(rows.values()).sort((a, b) => {
    if (a.sequenceVersion !== b.sequenceVersion) return a.sequenceVersion - b.sequenceVersion;
    return a.sequenceStep - b.sequenceStep;
  });

  for (const row of list) {
    row.openRate = rate(row.uniqueOpens, row.sends);
    row.clickRate = rate(row.uniqueClickers, row.sends);
    row.clickToSearchRate = rate(row.searches, row.clicks);
    row.clickToCheckoutRate = rate(row.checkouts, row.clicks);
    row.clickToPurchaseRate = rate(row.purchases, row.clicks);
    row.revenuePerEmail = row.sends > 0 ? Math.round((row.revenueUsd / row.sends) * 100) / 100 : null;
    row.revenuePerRecipient =
      row.uniqueClickers > 0
        ? Math.round((row.revenueUsd / row.uniqueClickers) * 100) / 100
        : null;
    row.revenueUsd = Math.round(row.revenueUsd * 100) / 100;
  }

  const totals = emptyRow(sequenceVersionFilter ?? 3, -1);
  totals.email = "all";
  for (const row of list) {
    totals.sends += row.sends;
    totals.uniqueOpens += row.uniqueOpens;
    totals.totalOpens += row.totalOpens;
    totals.clicks += row.clicks;
    totals.uniqueClickers += row.uniqueClickers;
    totals.searches += row.searches;
    totals.checkouts += row.checkouts;
    totals.purchases += row.purchases;
    totals.activations += row.activations;
    totals.outreach += row.outreach;
    totals.revenueUsd += row.revenueUsd;
  }
  totals.openRate = rate(totals.uniqueOpens, totals.sends);
  totals.clickRate = rate(totals.uniqueClickers, totals.sends);
  totals.clickToSearchRate = rate(totals.searches, totals.clicks);
  totals.clickToCheckoutRate = rate(totals.checkouts, totals.clicks);
  totals.clickToPurchaseRate = rate(totals.purchases, totals.clicks);
  totals.revenuePerEmail =
    totals.sends > 0 ? Math.round((totals.revenueUsd / totals.sends) * 100) / 100 : null;
  totals.revenuePerRecipient =
    totals.uniqueClickers > 0
      ? Math.round((totals.revenueUsd / totals.uniqueClickers) * 100) / 100
      : null;
  totals.revenueUsd = Math.round(totals.revenueUsd * 100) / 100;

  return {
    from: params.from,
    to: params.to,
    attributionModel: "last_email_click",
    attributionWindowDays: NURTURE_ATTRIBUTION_WINDOW_DAYS,
    metricsAvailableFrom:
      "Email click attribution available from Phase 2.2 deployment onward. Historical clicks are not backfilled.",
    rows: list,
    totals,
  };
}
