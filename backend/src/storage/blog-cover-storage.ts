import { mkdir, readdir, stat, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { supabase } from "../database/client";
import { logger } from "../utils/logger";

export type ImageStorageProviderName = "local" | "supabase";

export type StoreCoverInput = {
  bytes: Buffer;
  articleId?: string;
  slugHint?: string;
};

export type StoreCoverResult = {
  url: string;
  provider: ImageStorageProviderName;
  filename: string;
};

const DEFAULT_ROOT = "/app/storage";
const COVERS_SUBDIR = "blog-covers";

let lastStorageError: string | null = null;
let lastStorageAt: string | null = null;

export function getStorageRoot(): string {
  return (process.env.LOCAL_STORAGE_ROOT || DEFAULT_ROOT).replace(/\/$/, "");
}

export function getBlogCoversDir(): string {
  return path.join(getStorageRoot(), COVERS_SUBDIR);
}

export function getPublicBackendBaseUrl(): string {
  return (
    process.env.PUBLIC_BACKEND_URL?.replace(/\/$/, "") ||
    process.env.BACKEND_PUBLIC_URL?.replace(/\/$/, "") ||
    "https://backend.leadthur.com"
  );
}

export function getLastStorageTelemetry(): {
  lastAt: string | null;
  lastError: string | null;
} {
  return { lastAt: lastStorageAt, lastError: lastStorageError };
}

function safeSlugHint(slugHint: string): string {
  return slugHint
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function buildFilename(input: StoreCoverInput): string {
  const base = input.articleId
    ? input.articleId.replace(/[^a-z0-9-]/gi, "").slice(0, 36)
    : safeSlugHint(input.slugHint || "article");
  return `${base || "article"}-${randomUUID().slice(0, 8)}.png`;
}

async function ensureCoversDir(): Promise<void> {
  await mkdir(getBlogCoversDir(), { recursive: true });
}

async function storeLocalCover(input: StoreCoverInput): Promise<StoreCoverResult | null> {
  try {
    await ensureCoversDir();
    const filename = buildFilename(input);
    const filePath = path.join(getBlogCoversDir(), filename);
    await writeFile(filePath, input.bytes);
    const url = `${getPublicBackendBaseUrl()}/media/blog-covers/${encodeURIComponent(filename)}`;
    lastStorageAt = new Date().toISOString();
    lastStorageError = null;
    logger.info("IMAGE_STORAGE_COMPLETED", {
      provider: "local",
      filename,
      bytes: input.bytes.length,
    });
    return { url, provider: "local", filename };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    lastStorageError = message.slice(0, 500);
    logger.error("IMAGE_STORAGE_FAILED", { provider: "local", error: message });
    return null;
  }
}

async function storeSupabaseCover(input: StoreCoverInput): Promise<StoreCoverResult | null> {
  const safe = safeSlugHint(input.slugHint || "article");
  const storagePath = `covers/${safe || "article"}-${randomUUID().slice(0, 8)}.png`;
  const { error } = await supabase.storage
    .from("blog-covers")
    .upload(storagePath, input.bytes, {
      contentType: "image/png",
      upsert: false,
    });
  if (error) {
    lastStorageError = error.message.slice(0, 500);
    logger.error("IMAGE_STORAGE_FAILED", {
      provider: "supabase",
      error: error.message,
    });
    return null;
  }
  const { data } = supabase.storage.from("blog-covers").getPublicUrl(storagePath);
  const url = data.publicUrl || null;
  if (!url) return null;
  lastStorageAt = new Date().toISOString();
  lastStorageError = null;
  logger.info("IMAGE_STORAGE_COMPLETED", { provider: "supabase", path: storagePath });
  return { url, provider: "supabase", filename: path.basename(storagePath) };
}

export async function storeBlogCoverImage(
  input: StoreCoverInput,
  preferred: "local" | "supabase" | "auto" = "local"
): Promise<StoreCoverResult | null> {
  const tryLocalFirst = preferred === "local" || preferred === "auto";
  const trySupabase = preferred === "supabase" || preferred === "auto";

  if (tryLocalFirst) {
    const local = await storeLocalCover(input);
    if (local) return local;
  }
  if (trySupabase) {
    return storeSupabaseCover(input);
  }
  return null;
}

export async function getLocalStorageStats(): Promise<{
  enabled: boolean;
  path: string;
  imageCount: number;
  bytesUsed: number;
  healthy: boolean;
  lastError: string | null;
  lastWriteAt: string | null;
}> {
  const dir = getBlogCoversDir();
  let imageCount = 0;
  let bytesUsed = 0;
  let healthy = true;
  try {
    await ensureCoversDir();
    const files = await readdir(dir);
    for (const file of files) {
      if (!/\.(png|jpe?g|webp)$/i.test(file)) continue;
      const st = await stat(path.join(dir, file));
      if (st.isFile()) {
        imageCount += 1;
        bytesUsed += st.size;
      }
    }
  } catch {
    healthy = false;
  }
  const telemetry = getLastStorageTelemetry();
  return {
    enabled: true,
    path: dir,
    imageCount,
    bytesUsed,
    healthy,
    lastError: telemetry.lastError,
    lastWriteAt: telemetry.lastAt,
  };
}
