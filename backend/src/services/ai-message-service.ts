import { logger } from "../utils/logger";
import { getDeepseekApiKey } from "../utils/deepseek-config";

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

const OPENING_INSTRUCTIONS = [
  "Open the message casually, like you're continuing a thought, not introducing yourself formally.",
  "Open by mentioning something specific you noticed about their business first, before saying anything about yourself.",
  "Open with a quick observation, then mention what you do almost as an aside.",
] as const;

export function pickRandomOpeningInstruction(): string {
  const index = Math.floor(Math.random() * OPENING_INSTRUCTIONS.length);
  return OPENING_INSTRUCTIONS[index];
}

export function buildAiMessagePrompt(params: {
  business_name: string;
  city: string;
  niche: string;
  rating: number | null;
  has_website: boolean;
  has_email: boolean;
  openingInstruction?: string;
}): string {
  const niche = params.niche.trim();
  const opening = params.openingInstruction ?? pickRandomOpeningInstruction();

  const contextClauses: string[] = [];
  if (params.rating !== null && params.rating < 4.0) {
    contextClauses.push(
      `their Google rating is ${params.rating}, which you can reference casually as something you noticed, not as a criticism`
    );
  }
  if (!params.has_website) {
    contextClauses.push("mention casually that you didn't find a website for them");
  }
  if (!params.has_email) {
    contextClauses.push("skip mentioning email entirely");
  }

  const contextBlock =
    contextClauses.length > 0 ? ` ${contextClauses.join(". ")}.` : "";

  return `You are writing a single WhatsApp message as if you are a real freelancer reaching out to a business owner you have never spoken to before. The freelancer's service is ${niche}. The business is called ${params.business_name}, located in ${params.city}.${contextBlock}

Write like a real person typing quickly on their phone, not like a business pitch. Use casual contractions like I'm, didn't, can't. Vary your sentence length, do not make every sentence the same length. Do not start with 'Hi ${params.business_name} team' every time, vary the opening. Do not use the phrase 'I help businesses like yours.' Do not sound like a template. Reference one specific, real-sounding detail about their business or situation. End with a short, low pressure question, not a hard CTA.

Keep it under 35 words. No exclamation marks. No emojis. No mention of price.

${opening}`;
}

export function shouldRegenerateMessage(
  message: string,
  businessName: string
): boolean {
  const normalized = message.toLowerCase().trim();
  if (normalized.includes("i help businesses like yours")) return true;

  const teamOpener = `hi ${businessName.toLowerCase().trim()} team`;
  if (normalized.startsWith(teamOpener)) return true;

  return false;
}

function sanitizeGeneratedMessage(message: string): string {
  return message
    .replace(/!/g, "")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .trim();
}

async function callDeepSeek(prompt: string): Promise<
  | { ok: true; message: string }
  | {
      ok: false;
      reason: "missing_key" | "api_error" | "auth_error" | "empty_response";
    }
> {
  const apiKey = getDeepseekApiKey();
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
        temperature: 0.85,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      logger.error("DeepSeek AI message generation failed", {
        status: response.status,
        body: errorBody.slice(0, 500),
      });

      const isAuthError =
        response.status === 401 ||
        errorBody.toLowerCase().includes("authentication");

      return { ok: false, reason: isAuthError ? "auth_error" : "api_error" };
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      logger.error("DeepSeek AI message generation returned empty content");
      return { ok: false, reason: "empty_response" };
    }

    return { ok: true, message: sanitizeGeneratedMessage(content) };
  } catch (err) {
    logger.error("DeepSeek AI message generation error", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return { ok: false, reason: "api_error" };
  }
}

export async function generateAiWhatsappMessage(params: {
  business_name: string;
  city: string;
  niche: string;
  rating: number | null;
  has_website: boolean;
  has_email: boolean;
}): Promise<
  | { ok: true; message: string }
  | {
      ok: false;
      reason: "missing_key" | "api_error" | "auth_error" | "empty_response";
    }
> {
  const opening = pickRandomOpeningInstruction();
  const prompt = buildAiMessagePrompt({ ...params, openingInstruction: opening });

  logger.info("AI message prompt built", {
    niche: params.niche.trim(),
    business_name: params.business_name,
    opening,
  });

  const first = await callDeepSeek(prompt);
  if (!first.ok) return first;

  if (!shouldRegenerateMessage(first.message, params.business_name)) {
    return first;
  }

  logger.info("AI message flagged for generic phrasing, regenerating once", {
    niche: params.niche.trim(),
    business_name: params.business_name,
  });

  const retryOpening = pickRandomOpeningInstruction();
  const retryPrompt = buildAiMessagePrompt({
    ...params,
    openingInstruction: retryOpening,
  });
  const second = await callDeepSeek(retryPrompt);

  if (second.ok) return second;
  return first;
}
