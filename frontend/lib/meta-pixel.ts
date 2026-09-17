/** Meta Pixel helpers — client-only. Does not touch lt_analytics_*. */

export const META_PIXEL_ID = "1831616391138658";

const META_LEAD_SENT_KEY = "lp_meta_lead_sent";
const META_PURCHASE_SENT_KEY = "lp_meta_purchase_sent";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

function newEventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function whenFbqReady(run: () => void): void {
  if (typeof window === "undefined") return;
  if (typeof window.fbq === "function") {
    run();
    return;
  }
  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (typeof window.fbq === "function") {
      window.clearInterval(timer);
      run();
      return;
    }
    if (attempts >= 50) {
      window.clearInterval(timer);
    }
  }, 100);
}

/**
 * Fire Lead once per unique trial signup email.
 * Skip if this email already fired (refresh / returning gate submit).
 */
export function trackMetaLead(params: {
  email: string;
  eventID?: string;
}): string | null {
  if (typeof window === "undefined") return null;

  const email = params.email.toLowerCase().trim();
  if (!email.includes("@")) return null;

  try {
    const prev = localStorage.getItem(META_LEAD_SENT_KEY)?.toLowerCase().trim();
    if (prev === email) return null;
  } catch {
    /* storage blocked */
  }

  const eventID = params.eventID?.trim() || newEventId();

  whenFbqReady(() => {
    if (typeof window.fbq !== "function") return;

    try {
      const prev = localStorage.getItem(META_LEAD_SENT_KEY)?.toLowerCase().trim();
      if (prev === email) return;
    } catch {
      /* ignore */
    }

    window.fbq(
      "track",
      "Lead",
      {
        content_name: "LeadThur Free Trial",
        content_category: "trial_signup",
      },
      { eventID }
    );

    try {
      localStorage.setItem(META_LEAD_SENT_KEY, email);
    } catch {
      /* ignore */
    }
  });

  return eventID;
}

/**
 * Fire Purchase once per payment reference (eventID for CAPI dedup).
 */
export function trackMetaPurchase(params: {
  eventID: string;
  value: number;
  currency: string;
}): string | null {
  if (typeof window === "undefined") return null;

  const eventID = params.eventID.trim();
  if (!eventID) return null;

  try {
    const prev = localStorage.getItem(META_PURCHASE_SENT_KEY)?.trim();
    if (prev === eventID) return null;
  } catch {
    /* ignore */
  }

  whenFbqReady(() => {
    if (typeof window.fbq !== "function") return;

    try {
      const prev = localStorage.getItem(META_PURCHASE_SENT_KEY)?.trim();
      if (prev === eventID) return;
    } catch {
      /* ignore */
    }

    window.fbq(
      "track",
      "Purchase",
      {
        value: params.value,
        currency: params.currency,
      },
      { eventID }
    );

    try {
      localStorage.setItem(META_PURCHASE_SENT_KEY, eventID);
    } catch {
      /* ignore */
    }
  });

  return eventID;
}
