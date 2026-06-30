/**
 * Regression check: DB row shape → API mapper → email fields must survive round-trip.
 *
 * Usage:
 *   node backend/scripts/verify-email-field-parity.mjs
 */
import { createRequire } from "module";

const require = createRequire(import.meta.url);

process.env.SUPABASE_URL =
  process.env.SUPABASE_URL || "https://placeholder.supabase.co";
process.env.SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY || "placeholder-service-key-for-build-check";

const { predictionsFromDb, predictionStorageFields } = require("../dist/utils/lead-mapper.js");

function parseVerifiedEmails(row) {
  if (row.verified_email?.trim()) {
    return row.verified_email
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
  }
  const source = row.email_source ?? "none";
  if (
    row.email?.trim() &&
    source !== "predicted" &&
    source !== "generated"
  ) {
    return row.email
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
  }
  return [];
}

function mapBusinessLead(row) {
  const verifiedEmails = parseVerifiedEmails(row);
  const predictedEmails = predictionsFromDb(row);
  const source = row.email_source ?? "none";
  const emailSource =
    source === "predicted" || source === "generated"
      ? "predicted"
      : source === "website" || source === "extracted"
        ? "website"
        : "none";

  return {
    email: verifiedEmails[0] ?? predictedEmails[0]?.email ?? null,
    emails: verifiedEmails.length > 0 ? verifiedEmails : predictedEmails.map((p) => p.email),
    verifiedEmails,
    predictedEmails,
    emailSource,
  };
}

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exit(1);
  }
}

const jdaRow = {
  name: "JOHANNESBURG DEVELOPMENT AGENCY",
  email: "info@jda.org.za",
  verified_email: "info@jda.org.za",
  email_source: "extracted",
};

const leadhomeRow = {
  name: "Leadhome Properties",
  email: "sales@leadhome.co.za, rentals@leadhome.co.za, info@leadhome.co.za",
  verified_email:
    "sales@leadhome.co.za, rentals@leadhome.co.za, info@leadhome.co.za",
  email_source: "extracted",
};

const writeFields = predictionStorageFields({
  id: "test",
  searchId: "test",
  name: jdaRow.name,
  category: "",
  address: "",
  phone: null,
  email: jdaRow.email,
  emails: ["info@jda.org.za"],
  verifiedEmails: ["info@jda.org.za"],
  predictedEmails: [],
  emailSource: "website",
  website: "https://jda.org.za",
  rating: null,
  reviewCount: null,
  googleMapsUrl: null,
  hasWebsite: true,
  hasInstagram: false,
  emailScraped: true,
  createdAt: new Date().toISOString(),
});

assert(writeFields.verified_email === "info@jda.org.za", "write path must set verified_email");

const jdaMapped = mapBusinessLead(jdaRow);
assert(
  jdaMapped.verifiedEmails.includes("info@jda.org.za"),
  "read path must expose verifiedEmails for JDA"
);
assert(jdaMapped.email === "info@jda.org.za", "read path must expose primary email for JDA");

const leadhomeMapped = mapBusinessLead(leadhomeRow);
assert(
  leadhomeMapped.verifiedEmails.length === 3,
  "read path must expose all verified emails for Leadhome"
);

console.log("OK: email write/read field parity checks passed");
console.log("  write columns: email, verified_email, predicted_email*, email_source");
console.log("  read fields: email, emails, verifiedEmails, predictedEmails, emailSource");
console.log("  JDA sample:", jdaMapped);
console.log("  Leadhome sample count:", leadhomeMapped.verifiedEmails.length);
