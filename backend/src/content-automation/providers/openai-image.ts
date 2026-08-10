import { getOpenAiApiKey } from "./../config";
import { logger } from "../../utils/logger";
import { supabase } from "../../database/client";
import { randomUUID } from "crypto";

async function uploadCoverPng(bytes: Buffer, slugHint: string): Promise<string | null> {
  const safe = slugHint
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const path = `covers/${safe || "article"}-${randomUUID().slice(0, 8)}.png`;
  const { error } = await supabase.storage.from("blog-covers").upload(path, bytes, {
    contentType: "image/png",
    upsert: false,
  });
  if (error) {
    logger.error("Blog cover upload failed", { error: error.message });
    return null;
  }
  const { data } = supabase.storage.from("blog-covers").getPublicUrl(path);
  return data.publicUrl || null;
}

async function requestImage(
  apiKey: string,
  prompt: string,
  model: "dall-e-3" | "dall-e-2"
): Promise<
  | { ok: true; b64: string; revisedPrompt?: string }
  | { ok: false; reason: string; status?: number }
> {
  const body: Record<string, unknown> = {
    model,
    prompt: prompt.slice(0, model === "dall-e-3" ? 3500 : 1000),
    size: "1024x1024",
    response_format: "b64_json",
    n: 1,
  };
  if (model === "dall-e-3") body.quality = "standard";

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    logger.error("OpenAI image generation failed", {
      model,
      status: response.status,
      body: errBody.slice(0, 400),
    });
    return {
      ok: false,
      reason:
        response.status === 401
          ? "auth_error"
          : `api_error:${response.status}`,
      status: response.status,
    };
  }

  const data = (await response.json()) as {
    data?: Array<{ b64_json?: string; revised_prompt?: string }>;
  };
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) return { ok: false, reason: "empty_response" };
  return { ok: true, b64, revisedPrompt: data.data?.[0]?.revised_prompt };
}

export async function generateArticleImage(
  prompt: string,
  options: { slugHint?: string } = {}
): Promise<
  | { ok: true; imageUrl: string; revisedPrompt?: string }
  | { ok: false; reason: string }
> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) return { ok: false, reason: "missing_key" };

  const started = Date.now();
  try {
    let result = await requestImage(apiKey, prompt, "dall-e-3");
    if (!result.ok) {
      logger.warn("dall-e-3 failed; trying dall-e-2 fallback", {
        reason: result.reason,
      });
      result = await requestImage(apiKey, prompt, "dall-e-2");
    }
    if (!result.ok) return { ok: false, reason: result.reason };

    const bytes = Buffer.from(result.b64, "base64");
    const imageUrl = await uploadCoverPng(bytes, options.slugHint || "article");
    if (!imageUrl) return { ok: false, reason: "upload_failed" };

    logger.info("OpenAI image generation completed", {
      latencyMs: Date.now() - started,
      bytes: bytes.length,
    });

    return {
      ok: true,
      imageUrl,
      revisedPrompt: result.revisedPrompt,
    };
  } catch (err) {
    logger.error("OpenAI image generation error", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return { ok: false, reason: "api_error" };
  }
}
