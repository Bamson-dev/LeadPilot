import { getOpenAiApiKey } from "./../config";
import { logger } from "../../utils/logger";
import { supabase } from "../../database/client";
import { randomUUID } from "crypto";

type ImageModel = "gpt-image-1" | "gpt-image-1-mini" | "dall-e-3" | "dall-e-2";

export type ImageProbeResult = {
  ok: boolean;
  reason: string;
  modelTried: string[];
  httpStatus?: number;
  openaiCode?: string | null;
  openaiType?: string | null;
  openaiMessage?: string | null;
  imageUrl?: string;
};

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

function buildRequestBody(model: ImageModel, prompt: string): Record<string, unknown> {
  // GPT image models: no response_format (always b64). DALL·E retired for many accounts (Mar 2026).
  if (model === "gpt-image-1" || model === "gpt-image-1-mini") {
    return {
      model,
      prompt: prompt.slice(0, 3200),
      size: "1024x1024",
      quality: "medium",
      n: 1,
    };
  }
  const body: Record<string, unknown> = {
    model,
    prompt: prompt.slice(0, model === "dall-e-3" ? 3500 : 1000),
    size: "1024x1024",
    response_format: "b64_json",
    n: 1,
  };
  if (model === "dall-e-3") body.quality = "standard";
  return body;
}

async function requestImage(
  apiKey: string,
  prompt: string,
  model: ImageModel
): Promise<
  | { ok: true; b64: string; revisedPrompt?: string; model: ImageModel }
  | {
      ok: false;
      reason: string;
      status?: number;
      openaiCode?: string | null;
      openaiType?: string | null;
      openaiMessage?: string | null;
      model: ImageModel;
    }
> {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(buildRequestBody(model, prompt)),
  });

  const errBody = !response.ok ? await response.text().catch(() => "") : "";
  if (!response.ok) {
    let openaiCode: string | null = null;
    let openaiType: string | null = null;
    let openaiMessage: string | null = null;
    try {
      const parsed = JSON.parse(errBody) as {
        error?: { code?: string; type?: string; message?: string };
      };
      openaiCode = parsed.error?.code || null;
      openaiType = parsed.error?.type || null;
      openaiMessage = parsed.error?.message?.slice(0, 240) || null;
    } catch {
      /* keep nulls */
    }
    logger.error("OpenAI image generation failed", {
      model,
      status: response.status,
      openaiCode,
      openaiType,
      body: errBody.slice(0, 400),
    });
    const detail =
      openaiCode || openaiType || `http_${response.status}`;
    return {
      ok: false,
      reason:
        response.status === 401
          ? "auth_error"
          : response.status === 429
            ? `rate_limit:${detail}`
            : `api_error:${detail}`,
      status: response.status,
      openaiCode,
      openaiType,
      openaiMessage,
      model,
    };
  }

  const data = (await response.json()) as {
    data?: Array<{ b64_json?: string; revised_prompt?: string }>;
  };
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) return { ok: false, reason: "empty_response", model };
  return {
    ok: true,
    b64,
    revisedPrompt: data.data?.[0]?.revised_prompt,
    model,
  };
}

const MODEL_CHAIN: ImageModel[] = [
  "gpt-image-1",
  "gpt-image-1-mini",
  "dall-e-3",
  "dall-e-2",
];

export async function generateArticleImage(
  prompt: string,
  options: { slugHint?: string } = {}
): Promise<
  | { ok: true; imageUrl: string; revisedPrompt?: string; model?: string }
  | { ok: false; reason: string; probe?: ImageProbeResult }
> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) return { ok: false, reason: "missing_key" };

  const started = Date.now();
  const modelTried: string[] = [];
  let lastFail: ImageProbeResult = {
    ok: false,
    reason: "api_error",
    modelTried,
  };

  try {
    for (const model of MODEL_CHAIN) {
      modelTried.push(model);
      const result = await requestImage(apiKey, prompt, model);
      if (!result.ok) {
        lastFail = {
          ok: false,
          reason: result.reason,
          modelTried: [...modelTried],
          httpStatus: result.status,
          openaiCode: result.openaiCode,
          openaiType: result.openaiType,
          openaiMessage: result.openaiMessage,
        };
        logger.warn("OpenAI image model failed; trying next", {
          model,
          reason: result.reason,
        });
        continue;
      }

      const bytes = Buffer.from(result.b64, "base64");
      const imageUrl = await uploadCoverPng(bytes, options.slugHint || "article");
      if (!imageUrl) {
        return {
          ok: false,
          reason: "upload_failed",
          probe: {
            ok: false,
            reason: "upload_failed",
            modelTried,
            openaiMessage: "OpenAI succeeded but Supabase blog-covers upload failed",
          },
        };
      }

      logger.info("OpenAI image generation completed", {
        model: result.model,
        latencyMs: Date.now() - started,
        bytes: bytes.length,
      });

      return {
        ok: true,
        imageUrl,
        revisedPrompt: result.revisedPrompt,
        model: result.model,
      };
    }

    return { ok: false, reason: lastFail.reason, probe: lastFail };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    logger.error("OpenAI image generation error", { error: message });
    return {
      ok: false,
      reason: `api_error:exception`,
      probe: {
        ok: false,
        reason: `api_error:exception`,
        modelTried,
        openaiMessage: message.slice(0, 240),
      },
    };
  }
}

/** Safe diagnostic — never returns the API key. */
export async function probeOpenAiImageGeneration(): Promise<ImageProbeResult> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    return { ok: false, reason: "missing_key", modelTried: [] };
  }
  const result = await generateArticleImage(
    "Simple abstract editorial illustration, soft geometric shapes, no text, professional blog header style",
    { slugHint: "probe-test" }
  );
  if (result.ok) {
    return {
      ok: true,
      reason: "ok",
      modelTried: [result.model || "unknown"],
      imageUrl: result.imageUrl,
    };
  }
  return (
    result.probe || {
      ok: false,
      reason: result.reason,
      modelTried: [],
    }
  );
}
