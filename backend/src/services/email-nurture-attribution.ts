/**
 * Phase 2.2 — Trial Nurture attribution helpers.
 * Tags CTA links and standardizes nurture campaign identity for analytics.
 */

export const NURTURE_EMAIL_CHANNEL = "trial_nurture";
export const NURTURE_CAMPAIGN_V3 = "trial_nurture_v3";
export const NURTURE_UTM_SOURCE = "leadthur";
export const NURTURE_UTM_MEDIUM = "email";
/** Last-click attribution window for nurture → conversion joins */
export const NURTURE_ATTRIBUTION_WINDOW_DAYS = 30;

export type NurtureEmailContext = {
  sequenceVersion: number;
  sequenceStep: number;
};

let activeNurtureContext: NurtureEmailContext | null = null;

export function getActiveNurtureContext(): NurtureEmailContext | null {
  return activeNurtureContext;
}

export function withNurtureEmailContext<T>(
  ctx: NurtureEmailContext,
  fn: () => T
): T {
  const prev = activeNurtureContext;
  activeNurtureContext = ctx;
  try {
    return fn();
  } finally {
    activeNurtureContext = prev;
  }
}

export function nurtureContentId(sequenceVersion: number, sequenceStep: number): string {
  return `trial_v${sequenceVersion}_step_${sequenceStep}`;
}

export function parseNurtureStepFromContent(utmContent: string | null | undefined): number | null {
  if (!utmContent) return null;
  const match = /^trial_v(\d+)_step_(\d+)$/i.exec(utmContent.trim());
  if (!match) return null;
  return Number(match[2]);
}

export function ctaIdFromLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48) || "cta";
}

/**
 * Append nurture UTM params without overwriting existing query keys.
 */
export function appendNurtureAttribution(
  href: string,
  opts: {
    sequenceVersion: number;
    sequenceStep: number;
    ctaId: string;
  }
): string {
  try {
    const url = new URL(href);
    const setIfAbsent = (key: string, value: string) => {
      if (!url.searchParams.has(key) || !url.searchParams.get(key)) {
        url.searchParams.set(key, value);
      }
    };
    setIfAbsent("utm_source", NURTURE_UTM_SOURCE);
    setIfAbsent("utm_medium", NURTURE_UTM_MEDIUM);
    setIfAbsent("utm_campaign", NURTURE_CAMPAIGN_V3);
    setIfAbsent("utm_content", nurtureContentId(opts.sequenceVersion, opts.sequenceStep));
    setIfAbsent("utm_term", opts.ctaId);
    return url.toString();
  } catch {
    // Relative or invalid absolute URL — leave unchanged
    return href;
  }
}

export function nurtureEventProperties(opts: {
  sequenceVersion: number;
  sequenceStep: number;
  ctaId?: string | null;
  providerMessageId?: string | null;
}): Record<string, unknown> {
  return {
    email_channel: NURTURE_EMAIL_CHANNEL,
    sequence_version: opts.sequenceVersion,
    sequence_step: opts.sequenceStep,
    campaign: NURTURE_CAMPAIGN_V3,
    ...(opts.ctaId ? { cta: opts.ctaId } : {}),
    ...(opts.providerMessageId ? { provider_message_id: opts.providerMessageId } : {}),
  };
}
