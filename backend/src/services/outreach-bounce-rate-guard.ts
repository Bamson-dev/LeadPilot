const mailboxSessionBounces = new Map<string, number>();

export function getOutreachBounceRateThreshold(): number {
  const raw = process.env.OUTREACH_BOUNCE_RATE_THRESHOLD?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : 3;
  if (!Number.isFinite(parsed) || parsed < 1) return 3;
  return parsed;
}

export function recordMailboxHardBounce(mailboxId: string): number {
  const next = (mailboxSessionBounces.get(mailboxId) ?? 0) + 1;
  mailboxSessionBounces.set(mailboxId, next);
  return next;
}

export function getMailboxSessionBounces(mailboxId: string): number {
  return mailboxSessionBounces.get(mailboxId) ?? 0;
}

export function mailboxBounceThresholdReached(mailboxId: string): boolean {
  return getMailboxSessionBounces(mailboxId) >= getOutreachBounceRateThreshold();
}

/** Test helper: reset in-memory bounce counters between test cases. */
export function resetMailboxBounceCountersForTests(): void {
  mailboxSessionBounces.clear();
}
