/**
 * Regression check: API lead shape → table display email fields (plain JS).
 *
 * Usage:
 *   node backend/scripts/verify-frontend-email-display.mjs
 */

function readVerifiedEmails(raw) {
  if (raw.verifiedEmails?.length) return raw.verifiedEmails;
  if (raw.verified_emails?.length) return raw.verified_emails;
  if (raw.emails?.length) return raw.emails;
  if (raw.extracted_email?.trim()) {
    return raw.extracted_email.split(/,\s*/).map((e) => e.trim()).filter(Boolean);
  }
  const source = raw.emailSource ?? raw.email_source ?? null;
  if (source !== "predicted" && raw.email?.trim()) {
    return raw.email.split(/,\s*/).map((e) => e.trim()).filter(Boolean);
  }
  return [];
}

function normalizeApiBusinessLead(raw) {
  const verifiedEmails = readVerifiedEmails(raw);
  const predictedEmails = raw.predictedEmails?.length
    ? raw.predictedEmails
    : raw.predicted_emails ?? [];
  const emailSource =
    raw.emailSource === "website" ||
    raw.emailSource === "extracted" ||
    raw.email_source === "extracted"
      ? "website"
      : raw.emailSource === "predicted" || raw.email_source === "predicted"
        ? "predicted"
        : verifiedEmails.length > 0
          ? "website"
          : "none";

  return {
    verifiedEmails,
    predictedEmails,
    emailSource,
    email:
      verifiedEmails.length > 0
        ? verifiedEmails.join(", ")
        : raw.email ?? null,
  };
}

function businessLeadToLead(lead) {
  const verified =
    lead.verifiedEmails?.length > 0
      ? lead.verifiedEmails
      : lead.verified_emails?.length
        ? lead.verified_emails
        : lead.emailSource !== "predicted" && lead.email
          ? lead.email.split(/,\s*/).map((e) => e.trim()).filter(Boolean)
          : [];

  return {
    emails: verified,
    verified_emails: verified,
    predicted_emails: lead.predictedEmails ?? lead.predicted_emails ?? [],
    email: verified.length > 0 ? verified.join(", ") : lead.email,
  };
}

function getVerifiedEmails(lead) {
  if (lead.emails?.length) return lead.emails;
  if (lead.verified_emails?.length) return lead.verified_emails;
  if (lead.email?.trim()) return lead.email.split(/,\s*/).map((e) => e.trim()).filter(Boolean);
  return [];
}

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exit(1);
  }
}

const jda = normalizeApiBusinessLead({
  name: "JOHANNESBURG DEVELOPMENT AGENCY",
  email: "info@jda.org.za",
  verifiedEmails: ["info@jda.org.za"],
  emailSource: "website",
});

const leadhome = normalizeApiBusinessLead({
  name: "Leadhome Properties",
  email: "sales@leadhome.co.za, rentals@leadhome.co.za, info@leadhome.co.za",
  verifiedEmails: [
    "sales@leadhome.co.za",
    "rentals@leadhome.co.za",
    "info@leadhome.co.za",
  ],
  emailSource: "website",
});

const jdaDisplay = getVerifiedEmails(businessLeadToLead(jda));
assert(
  jdaDisplay.includes("info@jda.org.za"),
  "JDA must display info@jda.org.za"
);
assert(
  getVerifiedEmails(businessLeadToLead(leadhome)).length === 3,
  "Leadhome must display 3 verified emails"
);

const snake = normalizeApiBusinessLead({
  email: "info@jda.org.za",
  verified_emails: ["info@jda.org.za"],
  email_source: "extracted",
});
assert(
  getVerifiedEmails(businessLeadToLead(snake)).includes("info@jda.org.za"),
  "snake_case API fields must display"
);

console.log("OK: frontend email display parity checks passed");
