#!/usr/bin/env node
/**
 * One-time / ops: ensure LeadThur outreach Paystack Plans exist and are stored in DB.
 * Usage: cd backend && node scripts/ensure-outreach-paystack-plans.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

for (const path of [join(__dirname, ".env.staging"), join(__dirname, "../.env.staging"), join(__dirname, "../.env")]) {
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const { loadEnv } = await import("../dist/config/env.js");
const { ensureOutreachPaystackPlans } = await import("../dist/services/outreach-paystack-plans.js");

loadEnv();
const codes = await ensureOutreachPaystackPlans();
console.log("Outreach Paystack plans ready:");
console.log(JSON.stringify(codes, null, 2));
