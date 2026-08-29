import { parsePaystackMetadata } from "./paystack-webhook-forward";
import {
  DIGITALSKILLX_AIAPP_PAGE_SLUG,
  DIGITALSKILLX_AIAPP_PRODUCT_KEY,
  isDigitalSkillXPaystackEvent,
} from "./paystack-digitalskillx-forward";

/** In-app LeadThur checkout references: LP-{timestamp}-{random}. */
const LEADTHUR_CHECKOUT_REFERENCE = /^LP-\d{10,}-[A-Z0-9]+$/i;

const LEADTHUR_PAGE_SLUGS = new Set(["leadthur"]);

const FOREIGN_PRODUCT_MARKERS = [
  "mailthur",
  "aimoneycode",
  "ai money code",
  "promptearn",
  "nairainvoice",
  "naira invoice",
  "digitalskillx",
  DIGITALSKILLX_AIAPP_PRODUCT_KEY,
  DIGITALSKILLX_AIAPP_PAGE_SLUG,
];

export type PaystackChargeIdentity = {
  reference?: string | null;
  metadata?: Record<string, unknown> | string | null;
  amount?: number | null;
  currency?: string | null;
};

function compact(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function collectStrings(value: unknown, out: string[], depth = 0): void {
  if (depth > 6 || value == null) return;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const text = String(value).trim();
    if (text) out.push(text);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out, depth + 1);
    return;
  }
  if (typeof value === "object") {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out.push(key);
      collectStrings(nested, out, depth + 1);
    }
  }
}

function pageSlugFromUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (!host.endsWith("paystack.com") && !host.endsWith("paystack.shop")) {
      return null;
    }
    const parts = url.pathname.split("/").filter(Boolean);
    const payIndex = parts.findIndex((part) => part.toLowerCase() === "pay");
    if (payIndex >= 0 && parts[payIndex + 1]) {
      return parts[payIndex + 1].toLowerCase();
    }
  } catch {
    return null;
  }
  return null;
}

function productField(metadata: Record<string, unknown> | undefined): string | null {
  if (!metadata) return null;
  const direct = metadata.product ?? metadata.product_name ?? metadata.productName;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  return null;
}

function hasForeignProductMarker(values: string[]): boolean {
  return values.some((value) => {
    const lowered = value.toLowerCase();
    const compacted = compact(value);
    return FOREIGN_PRODUCT_MARKERS.some((marker) => {
      const compactMarker = compact(marker);
      return lowered.includes(marker) || (compactMarker.length > 0 && compacted.includes(compactMarker));
    });
  });
}

function hasLeadThurProductMarker(values: string[], metadata?: Record<string, unknown>): boolean {
  const product = productField(metadata);
  if (product) {
    const compacted = compact(product);
    if (compacted === "leadthur" || compacted === "leadthurlifetime" || compacted.startsWith("leadthur")) {
      return true;
    }
  }

  if (metadata?.source === "leadthur_checkout" || metadata?.gateway_product === "leadthur") {
    return true;
  }

  return values.some((value) => {
    const slug = pageSlugFromUrl(value);
    if (slug && LEADTHUR_PAGE_SLUGS.has(slug)) return true;
    const compacted = compact(value);
    return compacted === "leadthur" || compacted === "leadthurlifetime";
  });
}

export function isLeadThurLifetimePaystackCharge(input: PaystackChargeIdentity): boolean {
  const reference = input.reference?.trim() ?? "";
  const metadata = parsePaystackMetadata(input.metadata ?? undefined);

  if (
    isDigitalSkillXPaystackEvent({
      data: {
        reference,
        amount: input.amount ?? undefined,
        currency: input.currency ?? undefined,
        metadata: metadata ?? undefined,
      },
    })
  ) {
    return false;
  }

  if (metadata?.type === "topup") return false;

  const checkoutType = metadata?.outreach_type ?? metadata?.type;
  if (checkoutType === "subscription" || checkoutType === "pack") return false;

  if (metadata?.product === "mailthur") return false;

  if (LEADTHUR_CHECKOUT_REFERENCE.test(reference)) return true;

  const haystack: string[] = [];
  collectStrings(metadata, haystack);

  if (hasForeignProductMarker(haystack)) return false;

  return hasLeadThurProductMarker(haystack, metadata);
}
