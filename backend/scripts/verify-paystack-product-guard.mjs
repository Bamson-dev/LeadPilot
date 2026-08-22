#!/usr/bin/env node
import assert from "node:assert/strict";

function parsePaystackMetadata(metadata) {
  if (!metadata) return undefined;
  if (typeof metadata === "string") {
    try {
      return JSON.parse(metadata);
    } catch {
      return undefined;
    }
  }
  if (typeof metadata === "object") return metadata;
  return undefined;
}

function compact(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

const LEADTHUR_CHECKOUT_REFERENCE = /^LP-\d{10,}-[A-Z0-9]+$/i;
const LEADTHUR_PAGE_SLUGS = new Set(["leadthur"]);
const FOREIGN_PRODUCT_MARKERS = [
  "mailthur",
  "aimoneycode",
  "ai money code",
  "promptearn",
  "nairainvoice",
  "naira invoice",
];

function collectStrings(value, out, depth = 0) {
  if (depth > 6 || value == null) return;
  if (["string", "number", "boolean"].includes(typeof value)) {
    const text = String(value).trim();
    if (text) out.push(text);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out, depth + 1);
    return;
  }
  if (typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      out.push(key);
      collectStrings(nested, out, depth + 1);
    }
  }
}

function pageSlugFromUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (!host.endsWith("paystack.com") && !host.endsWith("paystack.shop")) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    const payIndex = parts.findIndex((part) => part.toLowerCase() === "pay");
    if (payIndex >= 0 && parts[payIndex + 1]) return parts[payIndex + 1].toLowerCase();
  } catch {
    return null;
  }
  return null;
}

function productField(metadata) {
  if (!metadata) return null;
  const direct = metadata.product ?? metadata.product_name ?? metadata.productName;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  return null;
}

function hasForeignProductMarker(values) {
  return values.some((value) => {
    const lowered = value.toLowerCase();
    const compacted = compact(value);
    return FOREIGN_PRODUCT_MARKERS.some((marker) => {
      const compactMarker = compact(marker);
      return lowered.includes(marker) || (compactMarker.length > 0 && compacted.includes(compactMarker));
    });
  });
}

function hasLeadThurProductMarker(values, metadata) {
  const product = productField(metadata);
  if (product) {
    const compacted = compact(product);
    if (compacted === "leadthur" || compacted === "leadthurlifetime" || compacted.startsWith("leadthur")) {
      return true;
    }
  }
  if (metadata?.source === "leadthur_checkout" || metadata?.gateway_product === "leadthur") return true;
  return values.some((value) => {
    const slug = pageSlugFromUrl(value);
    if (slug && LEADTHUR_PAGE_SLUGS.has(slug)) return true;
    const compacted = compact(value);
    return compacted === "leadthur" || compacted === "leadthurlifetime";
  });
}

function isLeadThurLifetimePaystackCharge(input) {
  const reference = input.reference?.trim() ?? "";
  const metadata = parsePaystackMetadata(input.metadata ?? undefined);
  if (metadata?.type === "topup") return false;
  const checkoutType = metadata?.outreach_type ?? metadata?.type;
  if (checkoutType === "subscription" || checkoutType === "pack") return false;
  if (metadata?.product === "mailthur") return false;
  if (LEADTHUR_CHECKOUT_REFERENCE.test(reference)) return true;
  const haystack = [];
  collectStrings(metadata, haystack);
  if (hasForeignProductMarker(haystack)) return false;
  return hasLeadThurProductMarker(haystack, metadata);
}

let pass = true;
function check(label, fn) {
  try {
    fn();
    console.log(JSON.stringify({ label, pass: true }));
  } catch (err) {
    pass = false;
    console.log(
      JSON.stringify({
        label,
        pass: false,
        error: err instanceof Error ? err.message : String(err),
      })
    );
  }
}

check("in-app checkout LP reference is LeadThur", () => {
  assert.equal(
    isLeadThurLifetimePaystackCharge({
      reference: "LP-1786343304640-4WA4OQ",
      metadata: { product: "leadthur", source: "leadthur_checkout" },
    }),
    true
  );
});

check("legacy LeadThur Lifetime metadata is LeadThur", () => {
  assert.equal(
    isLeadThurLifetimePaystackCharge({
      reference: "T100175682259401",
      metadata: { product: "LeadThur Lifetime" },
    }),
    true
  );
});

check("Paystack shop Leadthur referrer is LeadThur", () => {
  assert.equal(
    isLeadThurLifetimePaystackCharge({
      reference: "T486918630228311",
      metadata: { referrer: "https://paystack.shop/pay/Leadthur" },
    }),
    true
  );
});

check("store product name LeadThur is LeadThur", () => {
  assert.equal(
    isLeadThurLifetimePaystackCharge({
      reference: "T222406493385235",
      metadata: { product: "LeadThur" },
    }),
    true
  );
});

check("AI Money Code is not LeadThur", () => {
  assert.equal(
    isLeadThurLifetimePaystackCharge({
      reference: "T999999999999999",
      metadata: { product: "AI Money Code", referrer: "https://paystack.shop/pay/aimoneycode" },
    }),
    false
  );
});

check("MailThur is not LeadThur", () => {
  assert.equal(
    isLeadThurLifetimePaystackCharge({
      reference: "T111",
      metadata: { product: "mailthur" },
    }),
    false
  );
});

check("topup is not LeadThur", () => {
  assert.equal(
    isLeadThurLifetimePaystackCharge({
      reference: "topup_abc",
      metadata: { type: "topup", tierId: "starter" },
    }),
    false
  );
});

check("outreach pack is not LeadThur", () => {
  assert.equal(
    isLeadThurLifetimePaystackCharge({
      reference: "pack_abc",
      metadata: { type: "pack", pack_id: "starter", user_id: "x" },
    }),
    false
  );
});

check("unidentified high-value charge is not LeadThur", () => {
  assert.equal(
    isLeadThurLifetimePaystackCharge({
      reference: "T504145040489331",
      metadata: {},
    }),
    false
  );
});

check("LP reference without metadata is still LeadThur", () => {
  assert.equal(
    isLeadThurLifetimePaystackCharge({
      reference: "LP-1782914069910-8THJHG",
    }),
    true
  );
});

process.exit(pass ? 0 : 1);
