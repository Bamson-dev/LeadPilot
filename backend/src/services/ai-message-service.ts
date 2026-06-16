import { logger } from "../utils/logger";

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

const NICHE_FREELANCER_LABELS: Record<string, string> = {
  web_design: "web design",
  social_media: "social media",
  seo: "SEO",
  copywriting: "copywriting",
  general: "freelance business development",
};

export function buildAiMessagePrompt(params: {
  business_name: string;
  city: string;
  niche: string;
  rating: number | null;
  has_website: boolean;
  has_email: boolean;
}): string {
  const nicheLabel = NICHE_FREELANCER_LABELS[params.niche] ?? params.niche;
  const clauses: string[] = [];

  if (params.rating !== null && params.rating < 4.0) {
    clauses.push(
      "naturally reference that their Google rating could use some attention"
    );
  }

  if (!params.has_website) {
    clauses.push("naturally mention they don't appear to have a website");
  }

  if (!params.has_email) {
    clauses.push("skip any email reference");
  }

  const conditional =
    clauses.length > 0
      ? ` ${clauses.map((c) => `[${c}]`).join(" ")}.`
      : "";

  return `Write a short WhatsApp outreach message from a ${nicheLabel} freelancer to ${params.business_name}, a business located in ${params.city}.${conditional} Keep the message under 40 words. Tone should be casual and human, not salesy. End with one question that invites a reply. Do not use exclamation marks. Do not mention price or payment.`;
}

export async function generateAiWhatsappMessage(
  prompt: string
): Promise<
  | { ok: true; message: string }
  | { ok: false; reason: "missing_key" | "api_error" | "empty_response" }
> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    logger.warn("DEEPSEEK_API_KEY not set — cannot generate AI message");
    return { ok: false, reason: "missing_key" };
  }

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 120,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      logger.error("DeepSeek AI message generation failed", {
        status: response.status,
        body: errorBody.slice(0, 500),
      });
      return { ok: false, reason: "api_error" };
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      logger.error("DeepSeek AI message generation returned empty content");
      return { ok: false, reason: "empty_response" };
    }

    return { ok: true, message: content.replace(/!/g, "").trim() };
  } catch (err) {
    logger.error("DeepSeek AI message generation error", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return { ok: false, reason: "api_error" };
  }
}
