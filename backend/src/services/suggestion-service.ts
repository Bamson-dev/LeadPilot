import { logger } from "../utils/logger";

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

export interface AreaSuggestion {
  query: string;
  location: string;
  label: string;
}

export async function generateAreaSuggestions(
  query: string,
  location: string,
  totalFound: number
): Promise<AreaSuggestion[]> {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;

    if (!apiKey) {
      logger.warn("DEEPSEEK_API_KEY not set — skipping suggestions");
      return [];
    }

    if (totalFound >= 200) {
      return [];
    }

    const prompt = `The user searched for "${query}" in "${location}" using a business lead finder tool and got ${totalFound} results from Google Maps.

Google Maps limits results per search to around 60 to 120 businesses. Suggest 6 specific sub-areas, neighborhoods, or districts within "${location}" where the user can run separate searches to find more "${query}" businesses.

Rules:
- Return only areas that actually exist within or very close to "${location}"
- Use the most well-known and commercially active neighborhoods or districts
- Format each area so it works as a Google Maps search location. Example: Westlands Nairobi or Sandton Johannesburg
- If the location is already a very small area with no meaningful sub-areas return an empty array
- Never suggest the exact same location the user already searched

Respond with ONLY a valid JSON array of strings. No explanation. No markdown. No code blocks. Just the raw JSON array.

Example response for "restaurants in Nairobi":
["Westlands Nairobi","Karen Nairobi","Kilimani Nairobi","CBD Nairobi","Parklands Nairobi","Upperhill Nairobi"]`;

    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      logger.error("DeepSeek API error", { status: response.status });
      return [];
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) return [];

    let areas: string[] = [];

    try {
      areas = JSON.parse(content) as string[];
    } catch {
      const match = content.match(/\[[\s\S]*\]/);
      if (match) {
        areas = JSON.parse(match[0]) as string[];
      }
    }

    if (!Array.isArray(areas) || areas.length === 0) return [];

    return areas.slice(0, 6).map((area) => ({
      query,
      location: area,
      label: `${query} in ${area}`,
    }));
  } catch (err) {
    logger.error("Failed to generate area suggestions", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return [];
  }
}
