import {
  CAMPAIGN_START_DATE,
  CAMPAIGN_TIMEZONE,
  CAMPAIGN_TOTAL_DAYS,
  DEADLINE_AT_ISO,
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

export function getCurrentDateInLagos(now = new Date()): string {
  const { year, month, day } = datePartsInTz(now, CAMPAIGN_TIMEZONE);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getCampaignDay(now = new Date()): number {
  const [sy, sm, sd] = CAMPAIGN_START_DATE.split("-").map(Number);
  const current = datePartsInTz(now, CAMPAIGN_TIMEZONE);
  const diff = epochDay(current.year, current.month, current.day) - epochDay(sy, sm, sd);
  return diff + 1;
}

const CANONICAL_DEADLINE_MS = new Date(DEADLINE_AT_ISO).getTime();

export function getCanonicalDeadlineMs(): number {
  return CANONICAL_DEADLINE_MS;
}

/** Compare stored deadline values by instant, not string form (Postgres may return +00:00). */
export function isCanonicalDeadline(deadlineAt: string): boolean {
  const parsed = new Date(deadlineAt).getTime();
  if (Number.isNaN(parsed)) return false;
  return parsed === CANONICAL_DEADLINE_MS;
}

export function formatDeadlineInLagos(deadlineAt = DEADLINE_AT_ISO): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CAMPAIGN_TIMEZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).format(new Date(deadlineAt));
}

export function isPastDeadline(now = new Date()): boolean {
  return now.getTime() > CANONICAL_DEADLINE_MS;
}

export function getPhaseForDay(day: number): "webinar" | "offer" {
  return day <= 15 ? "webinar" : "offer";
}

export function getNextCampaignDay(now = new Date()): number | null {
  const day = getCampaignDay(now);
  if (day < 1) return 1;
  if (day >= CAMPAIGN_TOTAL_DAYS) return null;
  return day + 1;
}

export function assertValidCampaignWindow(now = new Date()): void {
  if (isPastDeadline(now)) {
    throw new Error("Campaign deadline has passed; activation is blocked.");
  }
}
