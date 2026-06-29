import type { ConnectionOptions } from "bullmq";
import { logger } from "../utils/logger";

let cachedConnection: ConnectionOptions | null = null;
let redisAvailable: boolean | null = null;

export function getRedisUrl(): string | undefined {
  return process.env.REDIS_URL?.trim() || undefined;
}

export function getRedisConnectionOptions(): ConnectionOptions | null {
  const url = getRedisUrl();
  if (!url) return null;

  if (!cachedConnection) {
    cachedConnection = { url, maxRetriesPerRequest: null };
  }
  return cachedConnection;
}

/** Probe Redis once at startup — does not throw. */
export async function probeRedisConnection(): Promise<boolean> {
  if (redisAvailable !== null) return redisAvailable;

  const options = getRedisConnectionOptions();
  if (!options) {
    redisAvailable = false;
    return false;
  }

  try {
    const url = getRedisUrl();
    if (!url) {
      redisAvailable = false;
      return false;
    }

    const { default: IORedis } = await import("ioredis");
    const client = new IORedis(url, {
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
      lazyConnect: true,
    });
    await client.connect();
    await client.ping();
    await client.quit();
    redisAvailable = true;
    logger.info("Redis connection OK — BullMQ search queue enabled");
    return true;
  } catch (err) {
    redisAvailable = false;
    logger.warn(
      "Search queue disabled: Redis unavailable. Falling back to inline processing.",
      { error: err instanceof Error ? err.message : "unknown" }
    );
    return false;
  }
}

export function isRedisQueueEnabled(): boolean {
  return redisAvailable === true;
}

export function resetRedisProbeForTests(): void {
  redisAvailable = null;
  cachedConnection = null;
}
