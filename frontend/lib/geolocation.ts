export async function detectCountry(): Promise<string> {
  try {
    const res = await fetch("https://ipapi.co/json/", {
      cache: "no-store",
    });
    const data = (await res.json()) as { country_code?: string };
    return data.country_code || "UNKNOWN";
  } catch {
    return "UNKNOWN";
  }
}
