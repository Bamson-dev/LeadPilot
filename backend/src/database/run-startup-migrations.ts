import pg from "pg";
import { logger } from "../utils/logger";

const FREE_TRIAL_IP_USAGE_SQL = `
create table if not exists free_trial_ip_usage (
  ip_address text primary key,
  searches_used integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists free_trial_ip_usage_searches_used_idx
  on free_trial_ip_usage (searches_used);

alter table free_trial_ip_usage enable row level security;
`;

function supabaseProjectRefFromUrl(url: string): string | null {
  try {
    const hostname = new URL(url).hostname;
    const ref = hostname.split(".")[0]?.trim();
    return ref || null;
  } catch {
    return null;
  }
}

export async function runStartupMigrations(): Promise<void> {
  const password = process.env.SUPABASE_DB_PASSWORD?.trim();
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  if (!password || !supabaseUrl) {
    logger.info("[migrations] Skipping startup migrations — SUPABASE_DB_PASSWORD not set");
    return;
  }

  const ref = process.env.SUPABASE_PROJECT_REF?.trim() || supabaseProjectRefFromUrl(supabaseUrl);
  if (!ref) {
    logger.warn("[migrations] Could not resolve Supabase project ref from SUPABASE_URL");
    return;
  }

  const region = process.env.SUPABASE_DB_REGION?.trim() || "eu-west-1";
  const connectionString = `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-${region}.pooler.supabase.com:6543/postgres`;
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const exists = await client.query(
      "select to_regclass('public.free_trial_ip_usage') as table_exists"
    );
    if (exists.rows[0]?.table_exists) {
      logger.info("[migrations] free_trial_ip_usage already present", { ref });
      return;
    }

    await client.query(FREE_TRIAL_IP_USAGE_SQL);
    logger.info("[migrations] Applied free_trial_ip_usage startup migration", { ref });
  } catch (err) {
    logger.error("[migrations] Startup migration failed", {
      ref,
      error: err instanceof Error ? err.message : "unknown",
    });
    throw err;
  } finally {
    await client.end().catch(() => undefined);
  }
}
