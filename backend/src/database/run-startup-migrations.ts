import pg from "pg";
import { mapOldSequenceStepToV3 } from "../services/trial-email-content-v3";
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

const TRIAL_EMAIL_SEQUENCE_V2_SQL = `
alter table public.free_trial_signups
  add column if not exists sequence_version integer not null default 1;

alter table public.free_trial_signups
  add column if not exists post_search_email_scheduled_at timestamptz;

alter table public.free_trial_signups
  add column if not exists post_search_email_sent_at timestamptz;

alter table public.free_trial_signups
  add column if not exists post_search_query text;

alter table public.free_trial_signups
  add column if not exists post_search_location text;

alter table public.trial_email_opens
  drop constraint if exists trial_email_opens_step_check;

alter table public.trial_email_opens
  add constraint trial_email_opens_step_check check (step >= 1 and step <= 100);

create index if not exists free_trial_signups_post_search_due_idx
  on public.free_trial_signups (post_search_email_scheduled_at)
  where post_search_email_sent_at is null
    and converted = false
    and sequence_paused = false;
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
    const ipTable = await client.query(
      "select to_regclass('public.free_trial_ip_usage') as table_exists"
    );
    if (!ipTable.rows[0]?.table_exists) {
      await client.query(FREE_TRIAL_IP_USAGE_SQL);
      logger.info("[migrations] Applied free_trial_ip_usage startup migration", { ref });
    } else {
      logger.info("[migrations] free_trial_ip_usage already present", { ref });
    }

    const v2Column = await client.query(
      "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'free_trial_signups' and column_name = 'sequence_version'"
    );
    if (v2Column.rows.length === 0) {
      await client.query(TRIAL_EMAIL_SEQUENCE_V2_SQL);
      logger.info("[migrations] Applied trial email sequence v2 startup migration", { ref });
    } else {
      logger.info("[migrations] trial email sequence v2 columns already present", { ref });
    }

    // Migrate active v1/v2 nurture users onto the 30-email (v3) sequence proportionally.
    // Idempotent: only rows with sequence_version < 3 are touched.
    const pending = await client.query<{
      id: string;
      email: string;
      sequence_step: number;
      sequence_version: number;
      converted: boolean;
      sequence_paused: boolean;
    }>(
      `select id, email, sequence_step, sequence_version, converted, sequence_paused
       from public.free_trial_signups
       where sequence_version < 3`
    );

    let migrated = 0;
    let completed = 0;
    for (const row of pending.rows) {
      const oldMax = row.sequence_version === 1 ? 15 : 20;
      const newStep = mapOldSequenceStepToV3(row.sequence_step ?? 0, oldMax);
      await client.query(
        `update public.free_trial_signups
         set sequence_step = $1, sequence_version = 3
         where id = $2 and sequence_version < 3`,
        [newStep, row.id]
      );
      migrated += 1;
      if (newStep >= 30) completed += 1;
    }

    if (migrated > 0) {
      logger.info("[migrations] Migrated trial email sequence users to v3", {
        ref,
        migrated,
        markedComplete: completed,
        remainingPending: pending.rows.length - migrated,
      });
    } else {
      logger.info("[migrations] No trial sequence v1/v2 users left to migrate to v3", { ref });
    }
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
