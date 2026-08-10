/**
 * Verify email display for a completed search via staging API (no credits spent).
 *
 * Usage:
 *   TEST_LICENSE_EMAIL=... TEST_LICENSE_KEY=... \
 *   node backend/scripts/verify-search-email-display.mjs [searchId]
 */
const API =
  process.env.STAGING_API_URL?.trim() || "https://staging-backend.leadthur.com";
const searchId =
  process.argv[2]?.trim() || "0c12d5dd-9be1-4eab-8621-5667bea3c145";
const email = process.env.TEST_LICENSE_EMAIL?.trim();
const key = process.env.TEST_LICENSE_KEY?.trim();

if (!email || !key) {
  console.error("Set TEST_LICENSE_EMAIL and TEST_LICENSE_KEY");
  process.exit(1);
}

const headers = {
  "Content-Type": "application/json",
  "x-license-email": email,
  "x-license-key": key,
};

function hasEmail(lead) {
  return (
    (lead.verifiedEmails?.length ?? 0) > 0 ||
    (lead.emails?.length ?? 0) > 0 ||
    (lead.predictedEmails?.length ?? 0) > 0 ||
    Boolean(lead.email?.trim())
  );
}

const res = await fetch(
  `${API}/search/results/${searchId}?page=1&limit=1000`,
  { headers, cache: "no-store" }
);
const body = await res.json();
if (!res.ok) {
  console.error(res.status, body);
  process.exit(1);
}

const withEmail = body.leads.filter(hasEmail);
const jda = body.leads.find((l) =>
  l.name?.toUpperCase().includes("JOHANNESBURG DEVELOPMENT")
);
const leadhome = body.leads.find((l) =>
  l.name?.toUpperCase().includes("LEADHOME")
);

console.log(
  JSON.stringify(
    {
      searchId,
      totalLeads: body.leads.length,
      apiLeadsWithEmail: withEmail.length,
      jda: jda
        ? {
            name: jda.name,
            email: jda.email,
            verifiedEmails: jda.verifiedEmails,
            emails: jda.emails,
            emailSource: jda.emailSource,
          }
        : null,
      leadhome: leadhome
        ? {
            name: leadhome.name,
            email: leadhome.email,
            verifiedEmails: leadhome.verifiedEmails,
            emailSource: leadhome.emailSource,
          }
        : null,
    },
    null,
    2
  )
);
