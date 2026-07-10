#!/usr/bin/env node
/**
 * Verify homepage and checkout copy rules.
 * Usage: node frontend/scripts/verify-marketing-copy.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const TARGETS = [
  "app/(marketing)/page.tsx",
  "app/checkout/page.tsx",
  "components/marketing/homepage",
];

const BANNED = [
  "embark",
  "delve",
  "craft",
  "imagine",
  "remarkable",
  "unlock",
  "discover",
  "skyrocket",
  "innovative",
  "revolutionary",
  "utilize",
  "illuminate",
  "unveil",
  "intricate",
  "harness",
  "groundbreaking",
];

function collectFiles(dirOrFile) {
  const abs = path.join(root, dirOrFile);
  if (!fs.existsSync(abs)) return [];
  const stat = fs.statSync(abs);
  if (stat.isFile()) return [abs];
  const out = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
      out.push(path.join(abs, entry.name));
    }
  }
  return out;
}

const files = TARGETS.flatMap(collectFiles);
const issues = [];

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const rel = path.relative(root, file);

  if (text.includes("—") || text.includes("–")) {
    issues.push(`${rel}: contains em dash character`);
  }

  if (/\bWhatsApp\b/i.test(text)) {
    issues.push(`${rel}: contains WhatsApp label`);
  }

  for (const word of BANNED) {
    const re = new RegExp(`\\b${word}\\b`, "i");
    if (re.test(text)) {
      issues.push(`${rel}: banned word "${word}"`);
    }
  }

  if (/unlimited[\s\S]{0,40}(send|email|sending)/i.test(text)) {
    issues.push(`${rel}: unlimited near send/email`);
  }
  if (/(send|email|sending)[\s\S]{0,40}unlimited/i.test(text)) {
    issues.push(`${rel}: unlimited near send/email`);
  }
}

const homepageFiles = files.filter((f) =>
  f.includes("marketing/homepage") || f.includes("(marketing)/page.tsx")
);
const homepageText = homepageFiles.map((f) => fs.readFileSync(f, "utf8")).join("\n");
const checkoutText = fs.readFileSync(path.join(root, "app/checkout/page.tsx"), "utf8");

const trialUrlPresent =
  homepageText.includes("https://www.leadthur.com/freetrial") ||
  (homepageText.includes("FREETRIAL") &&
    fs.readFileSync(path.join(root, "components/marketing/homepage/theme.ts"), "utf8").includes(
      "https://www.leadthur.com/freetrial"
    ));
const trialLinkCount = [...homepageText.matchAll(/href=\{FREETRIAL\}/g)].length;
if (!trialUrlPresent || trialLinkCount < 2) {
  issues.push(
    `homepage: expected at least 2 trial links to freetrial, found ${trialLinkCount} FREETRIAL hrefs`
  );
}

if (!homepageText.includes("Claim My Lifetime Access")) {
  issues.push("homepage: missing checkout CTA");
}

if (!checkoutText.includes("Unlimited CSV export of every search")) {
  issues.push("checkout: missing unlimited CSV export line");
}

if (
  !checkoutText.includes("Secured by Paystack") &&
  !checkoutText.includes("Secured by Flutterwave")
) {
  issues.push("checkout: missing secured by payment provider line");
}

const report = {
  filesChecked: files.length,
  issues,
  pass: issues.length === 0,
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.pass ? 0 : 1);
