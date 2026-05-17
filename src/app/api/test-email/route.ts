import { NextResponse } from "next/server";
import { chromium } from "playwright";
import { extractAllEmailsFromWebsite } from "@/lib/scraper/email-extractor";
import { extractRootDomain } from "@/lib/scraper/domain-utils";
import { generateEmailsFromWebsite } from "@/lib/scraper/email-generator";
import { resolveLeadEmailFields } from "@/lib/lead-email";
import { resolveBusinessWebsite } from "@/lib/scraper/website-utils";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json(
      { error: "Add ?url=https://example.com" },
      { status: 400 }
    );
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  try {
    const resolved = resolveBusinessWebsite(url);
    const result = await extractAllEmailsFromWebsite(url, context);

    const domain = extractRootDomain(url);
    const fields = resolveLeadEmailFields({
      websiteEmails: result.emails,
      website: url,
      category: searchParams.get("category"),
      businessName: searchParams.get("name"),
    });

    return NextResponse.json({
      input: url,
      resolved,
      domain,
      extracted: result.emails,
      generated: generateEmailsFromWebsite(
        url,
        searchParams.get("category"),
        searchParams.get("name")
      ),
      fields,
      display: fields.email,
      pagesVisited: result.pagesVisited,
      logs: result.logs,
      count: result.emails.length,
    });
  } finally {
    await context.close();
    await browser.close();
  }
}
