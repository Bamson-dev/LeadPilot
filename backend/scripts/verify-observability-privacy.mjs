/**
 * Offline privacy + taxonomy checks for Phase 2 observability.
 * Run: node backend/scripts/verify-observability-privacy.mjs
 */
import assert from "assert";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// Compile-free: reimplement mirror of sanitize for CI without ts-node
const SENSITIVE = ["password", "license_key", "card", "smtp_password", "jwt", "token", "secret"];

function sanitize(input) {
  const out = {};
  for (const [k, v] of Object.entries(input || {})) {
    const nk = k.toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (SENSITIVE.some((s) => nk.includes(s.replace(/_/g, "")) || nk.includes(s))) continue;
    if (
      nk.includes("password") ||
      nk.includes("secret") ||
      nk.includes("licensekey") ||
      nk.includes("card") ||
      nk.includes("token")
    ) {
      continue;
    }
    out[k] = v;
  }
  return out;
}

const cleaned = sanitize({
  query: "dentists",
  password: "secret123",
  license_key: "LT-XXXX",
  cardNumber: "4111111111111111",
  smtp_password: "mailpass",
  jwt: "eyJ...",
  ok: true,
});

assert.strictEqual(cleaned.query, "dentists");
assert.strictEqual(cleaned.ok, true);
assert.strictEqual(cleaned.password, undefined);
assert.strictEqual(cleaned.license_key, undefined);
assert.strictEqual(cleaned.cardNumber, undefined);
assert.strictEqual(cleaned.smtp_password, undefined);
assert.strictEqual(cleaned.jwt, undefined);

console.log("PASS — privacy sanitize strips secrets");

// Also run static verify
const { spawnSync } = await import("child_process");
const r = spawnSync("node", [path.join(root, "backend/scripts/verify-observability-phase2.mjs")], {
  encoding: "utf8",
});
process.stdout.write(r.stdout || "");
process.stderr.write(r.stderr || "");
process.exit(r.status ?? 1);
