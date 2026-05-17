import { lookup } from "dns/promises";
import { NextResponse } from "next/server";
import { chromium } from "playwright";

export const runtime = "nodejs";

async function checkNetwork(): Promise<{ ok: boolean; message?: string }> {
  try {
    await lookup("google.com");
    return { ok: true };
  } catch {
    return {
      ok: false,
      message:
        "Can't resolve google.com (DNS). Check Wi‑Fi, disable VPN, or fix DNS settings.",
    };
  }
}

export async function GET() {
  const network = await checkNetwork();

  try {
    const browser = await chromium.launch({ headless: true });
    await browser.close();

    return NextResponse.json({
      ok: network.ok,
      playwright: "ready",
      network: network.ok ? "ok" : "failed",
      message: network.ok
        ? "Chromium is installed and network looks good."
        : network.message,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      {
        ok: false,
        playwright: "missing",
        network: network.ok ? "ok" : "failed",
        networkMessage: network.message,
        message,
        fix: "Run: npx playwright install chromium",
      },
      { status: 500 }
    );
  }
}
