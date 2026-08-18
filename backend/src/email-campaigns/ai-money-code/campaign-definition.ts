import {
  CAMPAIGN_TIMEZONE,
  CAMPAIGN_TOTAL_DAYS,
  type RecipientUrgencyContext,
} from "./types";

function datePartsInTz(date: Date, timeZone: string): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function epochDay(year: number, month: number, day: number): number {
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function dateStrFromEpochDay(day: number): string {
  const ms = day * 86_400_000;
  const dt = new Date(ms);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

export function getCurrentDateInLagos(now = new Date()): string {
  const { year, month, day } = datePartsInTz(now, CAMPAIGN_TIMEZONE);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Per-recipient campaign day from enrollment start date in Africa/Lagos. */
export function getRecipientCampaignDay(campaignStartDate: string, now = new Date()): number {
  const [sy, sm, sd] = campaignStartDate.split("-").map(Number);
  const current = datePartsInTz(now, CAMPAIGN_TIMEZONE);
  return epochDay(current.year, current.month, current.day) - epochDay(sy, sm, sd) + 1;
}

export function getDay30Date(campaignStartDate: string): string {
  const [y, m, d] = campaignStartDate.split("-").map(Number);
  return dateStrFromEpochDay(epochDay(y, m, d) + (CAMPAIGN_TOTAL_DAYS - 1));
}

/** End of recipient Day 30 at 23:59 Africa/Lagos as UTC ISO. */
export function calculatePersonalDeadlineAt(campaignStartDate: string): string {
  const day30 = getDay30Date(campaignStartDate);
  const [y, m, d] = day30.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 22, 59, 0)).toISOString();
}

export function formatDeadlineInLagos(deadlineAt: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CAMPAIGN_TIMEZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(deadlineAt));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("month")} ${get("day")}, ${get("year")} at ${get("hour")}:${get("minute")} ${CAMPAIGN_TIMEZONE}`;
}

export function formatDeadlineDateInLagos(deadlineAt: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CAMPAIGN_TIMEZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
  }).formatToParts(new Date(deadlineAt));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("month")} ${get("day")}, ${get("year")}`;
}

export function getDeadlineInstantMs(deadlineAt: string): number {
  return new Date(deadlineAt).getTime();
}

/** Compare stored deadline values by instant, not string form (Postgres may return +00:00). */
export function isSameInstant(a: string, b: string): boolean {
  const aMs = new Date(a).getTime();
  const bMs = new Date(b).getTime();
  if (Number.isNaN(aMs) || Number.isNaN(bMs)) return false;
  return aMs === bMs;
}

export function isPastPersonalDeadline(personalDeadlineAt: string, now = new Date()): boolean {
  return now.getTime() > getDeadlineInstantMs(personalDeadlineAt);
}

export function buildRecipientUrgencyContext(
  personalDeadlineAt: string,
  now = new Date()
): RecipientUrgencyContext {
  const deadlineMs = getDeadlineInstantMs(personalDeadlineAt);
  const remainingMs = Math.max(0, deadlineMs - now.getTime());
  const hoursRemaining = Math.ceil(remainingMs / 3_600_000);
  const daysRemaining = Math.ceil(remainingMs / 86_400_000);
  return {
    personalDeadlineAt,
    personalDeadlineLagos: formatDeadlineInLagos(personalDeadlineAt),
    personalDeadlineDate: formatDeadlineDateInLagos(personalDeadlineAt),
    daysRemaining,
    hoursRemaining,
    isPastDeadline: now.getTime() > deadlineMs,
    specialPriceLabel: "₦49,999",
    regularPriceLabel: "₦100,000",
  };
}

export function getPhaseForDay(day: number): "webinar" | "offer" {
  return day <= 15 ? "webinar" : "offer";
}

export function getEnrollmentStartDate(now = new Date()): string {
  return getCurrentDateInLagos(now);
}
