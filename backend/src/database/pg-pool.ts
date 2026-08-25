import pg from "pg";
import { supabaseProjectRefFromUrl } from "../utils/supabase-config";
import { logger } from "../utils/logger";

let pool: pg.Pool | null = null;

export function isPgConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_DB_PASSWORD?.trim() && process.env.SUPABASE_URL?.trim()
  );
}

export function getPgPool(): pg.Pool | null {
  if (!isPgConfigured()) return null;
  if (pool) return pool;

  const password = process.env.SUPABASE_DB_PASSWORD!.trim();
  const ref =
    process.env.SUPABASE_PROJECT_REF?.trim() ||
    supabaseProjectRefFromUrl(process.env.SUPABASE_URL);
  if (!ref) return null;

  const region = process.env.SUPABASE_DB_REGION?.trim() || "eu-west-1";
  pool = new pg.Pool({
    connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-${region}.pooler.supabase.com:6543/postgres`,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30_000,
  });

  pool.on("error", (err) => {
    logger.warn("[pg-pool] idle client error", { error: err.message });
  });

  return pool;
}

export async function queryPg<T extends Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[] | null> {
  const client = getPgPool();
  if (!client) return null;
  try {
    const result = await client.query(text, params);
    return result.rows as T[];
  } catch (err) {
    logger.error("[pg-pool] query failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return null;
  }
}

/** Lightweight probe for health checks. */
export async function probePgReady(): Promise<boolean> {
  const rows = await queryPg<{ ok: number }>("select 1 as ok");
  return rows?.[0]?.ok === 1;
}
