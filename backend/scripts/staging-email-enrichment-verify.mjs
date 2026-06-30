/**
 * Staging email enrichment verification.
 *
 * Usage:
 *   TEST_LICENSE_EMAIL=... TEST_LICENSE_KEY=... \
 *   node backend/scripts/staging-email-enrichment-verify.mjs
 */
const API =
  process.env.STAGING_API_URL?.trim() || "https://staging-backend.leadthur.com";
const QUERY = process.env.SEARCH_QUERY?.trim() || "salons";
const LOCATION = process.env.SEARCH_LOCATION?.trim() || "Lagos Nigeria";
const LICENSE_EMAIL = process.env.TEST_LICENSE_EMAIL?.trim();
const LICENSE_KEY = process.env.TEST_LICENSE_KEY?.trim();
const RUN_TWICE = process.env.RUN_TWICE === "1";

async function api(path, options = {}) {
  const url = `${API}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(LICENSE_EMAIL ? { "x-license-email": LICENSE_EMAIL } : {}),
      ...(LICENSE_KEY ? { "x-license-key": LICENSE_KEY } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${res.status} ${path}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function waitForSearch(searchId, label) {
  const start = Date.now();
  let last = null;

  while (Date.now() - start < 25 * 60 * 1000) {
    const job = await api(
      `/search/${searchId}?licenseEmail=${encodeURIComponent(LICENSE_EMAIL)}&licenseKey=${encodeURIComponent(LICENSE_KEY)}`
    );
    last = job;
    const complete =
      job.status === "completed" &&
      job.emailScrapingComplete !== false &&
      job.scrapingInProgress === false;

    if (complete) {
      return { job, elapsedMs: Date.now() - start };
    }

    if (job.status === "failed") {
      throw new Error(`Search failed: ${job.error || "unknown"}`);
    }

    await new Promise((r) => setTimeout(r, 5000));
  }

  throw new Error(`Timed out waiting for search (${label})`);
}

function hasVerifiedEmail(lead) {
  return (
    (lead.verified_emails?.length ?? 0) > 0 ||
    (lead.emails?.length ?? 0) > 0 ||
    (lead.email_source === "extracted" && lead.email)
  );
}

function analyzeLeads(leads) {
  const withWebsite = leads.filter((l) => l.website?.trim());
  const verified = leads.filter(hasVerifiedEmail);
  const predicted = leads.filter((l) => (l.predicted_emails?.length ?? 0) > 0);
  const predictedConfidences = predicted.flatMap((l) =>
    (l.predicted_emails ?? []).map((p) => p.confidence).filter((c) => c > 0)
  );
  const avgConfidence =
    predictedConfidences.length > 0
      ? Math.round(
          predictedConfidences.reduce((a, b) => a + b, 0) /
            predictedConfidences.length
        )
      : 0;

  const withAnyEmail = leads.filter(
    (l) => hasVerifiedEmail(l) || (l.predicted_emails?.length ?? 0) > 0
  );

  const statsSummary = {
    scrappableWebsites: withWebsite.length,
  };

  return {
    total: leads.length,
    withWebsite: withWebsite.length,
    scrappableWebsites: statsSummary.scrappableWebsites,
    verifiedScraped: verified.length,
    mxPredicted: predicted.length,
    avgPredictedConfidence: avgConfidence,
    combinedCoverage: statsSummary.scrappableWebsites
      ? Math.round((withAnyEmail.length / statsSummary.scrappableWebsites) * 100)
      : 0,
    coverageDenominator: statsSummary.scrappableWebsites || leads.length,
    withAnyEmail: withAnyEmail.length,
  };
}

async function runOnce(runLabel) {
  const t0 = Date.now();
  const created = await api("/search", {
    method: "POST",
    body: JSON.stringify({ query: QUERY, location: LOCATION }),
  });

  console.log(`\n=== ${runLabel} ===`);
  console.log("searchId:", created.searchId);
  console.log("queued:", created.queuePosition ?? 0);

  const { job, elapsedMs } = await waitForSearch(created.searchId, runLabel);
  const results = await api(
    `/search/${created.searchId}/results?licenseEmail=${encodeURIComponent(LICENSE_EMAIL)}&licenseKey=${encodeURIComponent(LICENSE_KEY)}`
  );

  const leads = results.leads ?? results.results ?? [];
  const stats = analyzeLeads(leads);

  console.log("job status:", job.status, "emailScrapingComplete:", job.emailScrapingComplete);
  console.log("elapsedMs:", elapsedMs);
  console.log("stats:", stats);

  return { searchId: created.searchId, elapsedMs, stats };
}

async function main() {
  if (!LICENSE_EMAIL || !LICENSE_KEY) {
    console.error("Set TEST_LICENSE_EMAIL and TEST_LICENSE_KEY");
    process.exit(1);
  }

  const first = await runOnce("Run 1");
  let second = null;
  if (RUN_TWICE) {
    second = await runOnce("Run 2 (cache check)");
    const speedup =
      second.elapsedMs < first.elapsedMs
        ? `${Math.round(((first.elapsedMs - second.elapsedMs) / first.elapsedMs) * 100)}% faster`
        : "not faster (cache may still help per-domain during phase 2)";
    console.log("\nRun 2 vs Run 1:", speedup);
    console.log("Run 1 elapsedMs:", first.elapsedMs);
    console.log("Run 2 elapsedMs:", second.elapsedMs);
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
