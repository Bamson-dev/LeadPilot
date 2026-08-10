import { getOpenAiApiKey } from "./../config";
import { logger } from "../../utils/logger";
import { supabase } from "../../database/client";
import { randomUUID } from "crypto";

async function uploadCoverPng(bytes: Buffer, slugHint: string): Promise<string | null> {
  const path = `covers/${slugHint.slice(0, 60) || "article"}-${randomUUID().slice(0, 8)}.png`;
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
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: prompt.slice(0, 3500),
        size: "1024x1024",
        quality: "standard",
        response_format: "b64_json",
        n: 1,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      logger.error("OpenAI image generation failed", {
        status: response.status,
        body: body.slice(0, 300),
        latencyMs: Date.now() - started,
      });
      return { ok: false, reason: response.status === 401 ? "auth_error" : "api_error" };
    }

    const data = (await response.json()) as {
      data?: Array<{ b64_json?: string; revised_prompt?: string }>;
    };
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) return { ok: false, reason: "empty_response" };

    const bytes = Buffer.from(b64, "base64");
    const imageUrl = await uploadCoverPng(bytes, options.slugHint || "article");
    if (!imageUrl) return { ok: false, reason: "upload_failed" };

    logger.info("OpenAI image generation completed", {
      latencyMs: Date.now() - started,
      bytes: bytes.length,
    });

    return {
      ok: true,
      imageUrl,
      revisedPrompt: data.data?.[0]?.revised_prompt,
    };
  } catch (err) {
    logger.error("OpenAI image generation error", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return { ok: false, reason: "api_error" };
  }
}
