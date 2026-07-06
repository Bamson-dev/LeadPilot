import { logger } from "../utils/logger";
import { callDeepSeekChat } from "./deepseek-client";

const OPENING_OBSERVATION_INSTRUCTIONS = [
  "Phrase step 1 as a casual aside, like you noticed it while scrolling, not a formal introduction.",
  "Lead step 1 with one concrete detail about their business, worded as a quick observation before anything else.",
  "Start step 1 with something specific you spotted about them, as if you're continuing a thought rather than opening a pitch.",
] as const;

const FREE_TIP_MARKERS = /\b(try|consider|might help|worth|could)\b/i;

export function pickRandomOpeningInstruction(): string {
  const index = Math.floor(Math.random() * OPENING_OBSERVATION_INSTRUCTIONS.length);
  return OPENING_OBSERVATION_INSTRUCTIONS[index];
}

function buildNoticedDetail(params: {
  business_name: string;
  city: string;
  rating: number | null;
  has_website: boolean;
}): string {
  const parts: string[] = [];

  if (params.rating !== null && params.rating < 4.0) {
    parts.push(
      `mention the ${params.rating} Google rating naturally as something you noticed, not as criticism`
    );
  }

  if (!params.has_website) {
    parts.push("mention that you did not find a website for them");
  }

  if (parts.length === 0) {
    parts.push(
      `mention something generic but specific-sounding about their location or business type, like being well known in ${params.city} or having a strong presence in ${params.city}`
    );
  }

  return parts.join("; ");
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
  const noticed = buildNoticedDetail(params);

  const emailRule = params.has_email
    ? ""
    : "\nDo not mention email or reaching them by email.";

  return `Act as a cold DM copywriter. Combine Akin Alabi's storytelling and trust-building style with Alex Hormozi's give-before-ask, low-pressure outreach method.

Write a cold WhatsApp message for this offer:

Service: ${niche}
Target: the owner of ${params.business_name}, a business in ${params.city}
What you noticed about them: ${noticed}
Pain point: infer one realistic pain point this type of business would have related to ${niche}, for example a fitness coach pitching a restaurant might infer their staff or customers could use better wellness habits, a web designer pitching a business with no website would infer lost customers from people who search online first
Proof: do not fabricate a specific case study or number, instead reference general experience naturally without overclaiming, for example 'most places I work with see a difference within a couple weeks' rather than a fake statistic
Awareness level: assume Problem Aware, meaning they likely feel the pain but have not actively looked for a solution yet
End goal: get a one word or short reply, not a hard sale, not a call booking, not an audit request

Structure to follow exactly:

1. Open with the specific detail noticed about their business. Do not start with 'Hope you're doing well' or 'Hi ${params.business_name} team.'
2. Connect that detail to the pain point in one sentence. Sound like a person who noticed something, not a script reading off a checklist.
3. Give one small piece of free value or a quick tip related to the pain point before asking for anything. This step is mandatory and must be a real, useful suggestion, not a vague tease.
4. Introduce the solution as a natural next step without naming a product or service formally, just imply you could help further.
5. Close with a low commitment question they can answer in one word or a short phrase, not 'Are you interested in our service?'

Rules: Keep the full message under 90 words since this is WhatsApp, not email. No links. No exclamation marks. No corporate language. No emojis. Do not use the phrase 'I help businesses like yours.' Vary sentence length naturally.${emailRule}

For step 1 only, ${opening}`;
}

export function lacksFreeTipSuggestion(message: string): boolean {
  return !FREE_TIP_MARKERS.test(message);
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
  const result = await callDeepSeekChat(prompt, { max_tokens: 220, temperature: 0.85 });
  if (!result.ok) return result;
  return { ok: true, message: sanitizeGeneratedMessage(result.content) };
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

  if (!lacksFreeTipSuggestion(first.message)) {
    return first;
  }

  logger.info("AI message missing free tip heuristic, regenerating once", {
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
