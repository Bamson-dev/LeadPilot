/**
 * Isolated SEO Intelligence self-test (no live network/DB writes).
 * Run: npx tsx src/seo-intelligence/selftest.ts
 */
import assert from "assert";
import { createHash } from "crypto";
import { parseOptimizationProposal } from "./prompts";
import { validateOptimizationProposal } from "./validation";

function fingerprintOpportunity(
  pageUrl: string,
  type: string,
  blogPostId?: string | null
): string {
  return createHash("sha256")
    .update(`${pageUrl}|${type}|${blogPostId || ""}`)
    .digest("hex")
    .slice(0, 40);
}

function main() {
  const fp = fingerprintOpportunity(
    "https://www.leadthur.com/blog/example",
    "high_impression_low_ctr",
    "post-1"
  );
  assert.ok(fp.length >= 16);

  const longHtml =
    `<p>${"Useful paragraph about client discovery for freelancers seeking better outreach. ".repeat(120)}</p>` +
    `<h2>Practical steps</h2><p>${"More useful detail for freelancers building a pipeline of real clients. ".repeat(120)}</p>`;

  const proposal = parseOptimizationProposal(
    JSON.stringify({
      title: "How Freelancers Find Clients Without Cold Spam",
      metaDescription:
        "Practical ways freelancers find clients using better discovery workflows, clearer outreach, and tools that surface real business contacts.",
      excerpt: "A practical guide for freelancers who need better client discovery.",
      contentHtml: longHtml,
      optimizationTypes: ["title", "meta", "introduction"],
      reasoning: "Improve CTR alignment with Search Console queries.",
      changes: ["Sharper title", "Clearer intro"],
    })
  );
  assert.ok(proposal);
  assert.ok(proposal!.title.length > 10);

  const validation = validateOptimizationProposal({
    original: {
      id: "1",
      title: "Old title about finding clients for freelancers",
      slug: "example",
      excerpt: "old",
      content: `<p>${"Original content word ".repeat(400)}</p>`,
      cover_image: null,
      category: "Lead Generation",
      tags: [],
      meta_title: "Old title",
      meta_description: "Old meta",
      status: "published",
      published_at: new Date().toISOString(),
    },
    proposal: proposal!,
    allowedSlugs: new Set(["example", "other"]),
  });
  assert.strictEqual(validation.ok, true, validation.notes.join("; "));

  console.log("SEO Intelligence selftest PASS");
}

main();
