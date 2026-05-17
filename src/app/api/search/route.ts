import { NextResponse } from "next/server";
import { z } from "zod";
import { createSearch } from "@/lib/search-store";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const bodySchema = z.object({
  searchTerm: z.string().min(2).max(100),
  location: z.string().min(2).max(100),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many searches. Please wait a minute." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid search. Provide business type and location." },
        { status: 400 }
      );
    }

    const search = createSearch(
      parsed.data.searchTerm.trim(),
      parsed.data.location.trim()
    );

    return NextResponse.json({
      searchId: search.id,
      searchTerm: search.search_term,
      location: search.location,
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
