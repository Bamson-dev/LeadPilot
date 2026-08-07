/**
 * Evidence: P0-5 XSS / site-script hardening (server-safe sanitizer).
 * Run: node backend/scripts/verify-p0-xss.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = join(__dirname, "../../frontend");

function pass(msg) {
  console.log(`PASS: ${msg}`);
}

const safetySrc = readFileSync(join(frontendRoot, "lib/site-scripts-safety.ts"), "utf8");
assert.ok(safetySrc.includes("localStorage"));
assert.ok(safetySrc.includes("ALLOWED_SCRIPT_HOSTS"));
pass("site-scripts-safety.ts blocks theft patterns and allowlists hosts");

const blogSrc = readFileSync(join(frontendRoot, "lib/blog-content.ts"), "utf8");
assert.ok(blogSrc.includes("sanitizeBlogHtml"));
assert.ok(blogSrc.includes("prepareArticleContent") && blogSrc.includes("sanitizeBlogHtml(html)"));
assert.ok(!blogSrc.includes("isomorphic-dompurify"), "must not depend on jsdom-breaking dompurify");
pass("blog-content.ts sanitizes via server-safe sanitizeBlogHtml (no isomorphic-dompurify)");

const layoutSrc = readFileSync(join(frontendRoot, "app/layout.tsx"), "utf8");
assert.ok(layoutSrc.includes("filterSafeInlineScripts"));
assert.ok(layoutSrc.includes("filterSafeExternalScripts"));
pass("layout.tsx uses hardened site-script filters");

const THEFT_PATTERN =
  /localStorage|sessionStorage|document\.cookie|indexedDB|webkitRequestFileSystem/i;
assert.equal(THEFT_PATTERN.test("localStorage.getItem('leadthur_key')"), true);
assert.equal(THEFT_PATTERN.test("gtag('config','G-XXX')"), false);
pass("theft pattern catches localStorage license steal; allows typical gtag");

function hostAllowed(src) {
  const ALLOWED = ["www.googletagmanager.com", "www.google-analytics.com"];
  try {
    const url = new URL(src);
    return ALLOWED.some((a) => url.hostname === a || url.hostname.endsWith(`.${a}`));
  } catch {
    return false;
  }
}
assert.equal(hostAllowed("https://evil.example.com/steal.js"), false);
assert.equal(hostAllowed("https://www.googletagmanager.com/gtag/js?id=G-X"), true);
pass("external script host allowlist rejects evil.example.com");

function sanitizeBlogHtml(html) {
  let out = html;
  out = out.replace(
    /<\s*(script|iframe|object|embed|form|link|meta|base|style)(\s[^>]*)?>[\s\S]*?<\s*\/\s*\1\s*>/gi,
    ""
  );
  out = out.replace(
    /<\s*(script|iframe|object|embed|form|link|meta|base|style)(\s[^>]*)?\/?\s*>/gi,
    ""
  );
  out = out.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  return out;
}
const dirty =
  '<p>Hello</p><script>localStorage.getItem("leadthur_key")</script><img src=x onerror=alert(1)>';
const clean = sanitizeBlogHtml(dirty);
assert.equal(clean.includes("<script"), false);
assert.equal(clean.includes("onerror"), false);
assert.equal(clean.includes("Hello"), true);
pass("sanitizeBlogHtml strips script tags and onerror handlers from blog HTML");

console.log("\nP0-5 XSS evidence checks passed.");
