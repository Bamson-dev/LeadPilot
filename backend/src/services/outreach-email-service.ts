import { callDeepSeekChat } from "./deepseek-client";
import { logger } from "../utils/logger";

const BUSINESS_NAME_TOKEN = "[Business Name]";

export const OUTREACH_EMAIL_TONES = [
  "direct",
  "friendly",
  "consultative",
  "bold",
] as const;

export type OutreachEmailTone = (typeof OUTREACH_EMAIL_TONES)[number];

export function buildOutreachEmailPrompt(params: {
  service_description: string;
  target_business_type: string;
  tone?: string | null;
}): string {
  const service = params.service_description.trim();
  const target = params.target_business_type.trim();
  const tone = params.tone?.trim() || "direct and conversational";

  return `You are writing a short cold outreach email.

The sender offers: ${service}
They are emailing owners of: ${target}
Tone/angle: ${tone}

Write ONE email with this structure in the body:
1. Hook — open with the recipient's likely situation (use ${BUSINESS_NAME_TOKEN} for their business name; never invent a specific business name)
2. Problem — the pain this type of business often has
3. Solution — what the sender does, tied to that problem
4. Benefit — one concrete outcome
5. Call to action — one simple low-friction ask

Rules:
- Keep the body under 130 words
- Human, direct, no corporate filler, no emojis, no exclamation marks
- The body MUST include ${BUSINESS_NAME_TOKEN} at least once
- Subject line should be specific, under 70 characters, and may include ${BUSINESS_NAME_TOKEN}
- Do not mention AI or that this was generated

Respond with ONLY valid JSON (no markdown fences):
{"subject":"...","body":"..."}`;
}

export function parseOutreachEmailJson(
  content: string
): { subject: string; body: string } | null {
  const trimmed = content.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]) as { subject?: string; body?: string };
    const subject = parsed.subject?.trim();
    const body = parsed.body?.trim();
    if (!subject || !body) return null;
    return { subject, body };
  } catch {
    return null;
  }
}

export function ensureBusinessNameToken(text: string): string {
  if (/\[Business Name\]/i.test(text)) return text;
  if (/^Hi\b/i.test(text)) {
    return text.replace(/^Hi\b/i, `Hi ${BUSINESS_NAME_TOKEN},`);
  }
  return `Hi ${BUSINESS_NAME_TOKEN},\n\n${text}`;
}

function sanitizeOutreachEmail(text: string): string {
  return text
    .replace(/!/g, "")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .trim();
}

export function outreachEmailHasStructure(body: string): boolean {
  const lower = body.toLowerCase();
  const markers = ["problem", "help", "would you", "open to", "quick", "chat", "reply"];
  return markers.some((word) => lower.includes(word));
}

export async function generateOutreachEmail(params: {
  service_description: string;
  target_business_type: string;
  tone?: string | null;
}): Promise<
  | { ok: true; subject: string; body: string }
  | { ok: false; reason: "missing_key" | "api_error" | "auth_error" | "empty_response" | "parse_error" }
> {
  const prompt = buildOutreachEmailPrompt(params);

  logger.info("Outreach email generation requested", {
    target_business_type: params.target_business_type.trim(),
    tone: params.tone?.trim() || "default",
  });

  const result = await callDeepSeekChat(prompt, {
    max_tokens: 480,
    temperature: 0.8,
  });

  if (!result.ok) return result;

  const parsed = parseOutreachEmailJson(result.content);
  if (!parsed) {
    logger.error("Outreach email JSON parse failed", {
      preview: result.content.slice(0, 200),
    });
    return { ok: false, reason: "parse_error" };
  }

  const subject = sanitizeOutreachEmail(parsed.subject);
  const body = ensureBusinessNameToken(sanitizeOutreachEmail(parsed.body));

  return { ok: true, subject, body };
}
