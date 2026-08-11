import { getOpenAiApiKey } from "./../config";
import { logger } from "../../utils/logger";
import { storeBlogCoverImage } from "../../storage/blog-cover-storage";

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
  storageProvider?: string;
};

function buildRequestBody(model: ImageModel, prompt: string): Record<string, unknown> {
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
    const detail = openaiCode || openaiType || `http_${response.status}`;
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
  options: {
    slugHint?: string;
    articleId?: string;
    storageProvider?: "local" | "supabase" | "auto";
  } = {}
): Promise<
  | {
      ok: true;
      imageUrl: string;
      revisedPrompt?: string;
      model?: string;
      storageProvider?: string;
    }
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
      const stored = await storeBlogCoverImage(
        {
          bytes,
          slugHint: options.slugHint || "article",
          articleId: options.articleId,
        },
        options.storageProvider || "local"
      );
      if (!stored) {
        return {
          ok: false,
          reason: "upload_failed",
          probe: {
            ok: false,
            reason: "upload_failed",
            modelTried,
            openaiMessage: "OpenAI succeeded but image storage failed (local + fallback)",
          },
        };
      }

      logger.info("OpenAI image generation completed", {
        model: result.model,
        latencyMs: Date.now() - started,
        bytes: bytes.length,
        storageProvider: stored.provider,
      });

      return {
        ok: true,
        imageUrl: stored.url,
        revisedPrompt: result.revisedPrompt,
        model: result.model,
        storageProvider: stored.provider,
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
    { slugHint: "probe-test", storageProvider: "auto" }
  );
  if (result.ok) {
    return {
      ok: true,
      reason: "ok",
      modelTried: [result.model || "unknown"],
      imageUrl: result.imageUrl,
      storageProvider: result.storageProvider,
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
