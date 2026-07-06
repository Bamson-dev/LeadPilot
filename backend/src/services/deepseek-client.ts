import { getDeepseekApiKey } from "../utils/deepseek-config";
import { logger } from "../utils/logger";

export const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

export type DeepSeekFailureReason =
  | "missing_key"
  | "api_error"
  | "auth_error"
  | "empty_response";

export async function callDeepSeekChat(
  prompt: string,
  options: { max_tokens?: number; temperature?: number } = {}
): Promise<
  | { ok: true; content: string }
  | { ok: false; reason: DeepSeekFailureReason }
> {
  const apiKey = getDeepseekApiKey();
  if (!apiKey) {
    logger.warn("DEEPSEEK_API_KEY not set — cannot call DeepSeek");
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
        max_tokens: options.max_tokens ?? 220,
        temperature: options.temperature ?? 0.85,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      logger.error("DeepSeek request failed", {
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
      logger.error("DeepSeek returned empty content");
      return { ok: false, reason: "empty_response" };
    }

    return { ok: true, content };
  } catch (err) {
    logger.error("DeepSeek request error", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return { ok: false, reason: "api_error" };
  }
}
