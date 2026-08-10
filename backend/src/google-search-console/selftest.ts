/**
 * Isolated unit checks for GSC crypto + config helpers.
 * Run: npx tsx src/google-search-console/selftest.ts
 */
import assert from "assert";
import { createHash } from "crypto";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-for-gsc-selftest-only";
process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET =
  process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET || "test-client-secret";
process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID =
  process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID || "test-client-id.apps.googleusercontent.com";
process.env.GOOGLE_SEARCH_CONSOLE_REDIRECT_URI =
  "https://backend.leadthur.com/admin/integrations/google-search-console/callback";
process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL = "https://leadthur.com/";

async function main() {
  const { encryptGscSecret, decryptGscSecret, hashOAuthState } = await import("./crypto");
  const {
    isGscConfigured,
    getGscConfigStatus,
    getGscClientId,
    getGscRedirectUri,
    GSC_READONLY_SCOPE,
  } = await import("./config");

  const token = "refresh-token-sample-value";
  const enc = encryptGscSecret(token);
  assert.notStrictEqual(enc, token);
  assert.strictEqual(decryptGscSecret(enc), token);

  const state = "abc123state";
  const hash = hashOAuthState(state);
  assert.strictEqual(hash, createHash("sha256").update(state).digest("hex"));
  assert.notStrictEqual(hash, state);

  assert.strictEqual(isGscConfigured(), true);
  const status = getGscConfigStatus();
  assert.strictEqual(status.configured, true);
  assert.strictEqual(status.scope, GSC_READONLY_SCOPE);
  assert.ok(!JSON.stringify(status).includes("test-client-secret"));

  const params = new URLSearchParams({
    client_id: getGscClientId()!,
    redirect_uri: getGscRedirectUri(),
    response_type: "code",
    scope: GSC_READONLY_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  assert.ok(url.includes("accounts.google.com"));
  assert.ok(url.includes("webmasters.readonly"));
  assert.ok(url.includes("access_type=offline"));
  assert.ok(!url.includes("test-client-secret"));

  console.log("GSC selftest PASS");
}

main().catch((err) => {
  console.error("GSC selftest FAIL", err);
  process.exit(1);
});
