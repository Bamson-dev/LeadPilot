#!/usr/bin/env node
/**
 * Run inside the Coolify backend container (or locally with env loaded):
 *   node scripts/verify-license-auth.mjs
 */
import { createClient } from "@supabase/supabase-js";

function refFromUrl(url) {
  const match = String(url || "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
  return match?.[1]?.toLowerCase() ?? null;
}

function refFromKey(key) {
  if (!key || String(key).startsWith("sb_")) return null;
  try {
    const parts = String(key).split(".");
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
    );
    return payload.ref?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

function isRowNotFound(error) {
  if (!error) return false;
  if (error.code === "PGRST116") return true;
  return /0 rows|multiple \(or no\) rows returned/i.test(error.message ?? "");
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;

console.log(JSON.stringify({ label: "SUPABASE_URL configured", pass: Boolean(url) }, null, 0));
console.log(JSON.stringify({ label: "SUPABASE_SERVICE_KEY configured", pass: Boolean(key) }, null, 0));

const urlRef = refFromUrl(url);
const keyRef = refFromKey(key);
console.log(JSON.stringify({ label: "Supabase URL ref", value: urlRef }, null, 0));
console.log(JSON.stringify({ label: "Supabase key ref", value: keyRef }, null, 0));
console.log(
  JSON.stringify(
    {
      label: "URL and service key refs match",
      pass: urlRef && keyRef ? urlRef === keyRef : null,
    },
    null,
    0
  )
);

if (!url || !key) {
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const probes = [
  {
    label: "license lookup (fake key)",
    run: () =>
      supabase
        .from("license_keys")
        .select("id, email, key, activated, is_suspended, suspension_reason")
        .eq("key", "LP-VERIFY-FAKE")
        .eq("email", "verify-fake@invalid.local")
        .single(),
  },
  {
    label: "free_trial_ip_usage readable",
    run: () => supabase.from("free_trial_ip_usage").select("ip_address").limit(1),
  },
];

let failed = false;
for (const probe of probes) {
  const { error } = await probe.run();
  const pass = !error || isRowNotFound(error);
  console.log(
    JSON.stringify(
      {
        label: probe.label,
        pass,
        errorCode: error?.code ?? null,
        errorMessage: error?.message ?? null,
      },
      null,
      0
    )
  );
  if (!pass) failed = true;
}

process.exit(failed ? 1 : 0);
