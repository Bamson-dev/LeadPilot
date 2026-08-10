import pg from "pg";
import { mapOldSequenceStepToV3 } from "../services/trial-email-content-v3";
import { computeNextSequenceEmailAt } from "../services/trial-sequence-schedule";
import { logger } from "../utils/logger";
import { CONTENT_AUTOMATION_SQL } from "./content-automation-sql";
import { GOOGLE_SEARCH_CONSOLE_SQL } from "../google-search-console/sql";

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

const RLS_DENY_PUBLIC_SENSITIVE_SQL = `
do $$
declare
  t text;
  tables text[] := array[
    'connected_mailboxes',
    'outreach_accounts',
    'outreach_credit_transactions',
    'sent_emails',
    'email_templates',
    'email_suppression',
    'outreach_followup_batches',
    'outreach_followup_steps',
    'outreach_paystack_plans',
    'blog_posts',
    'content_automation_settings',
    'content_topics',
    'content_jobs',
    'content_sources',
    'content_generation_runs',
    'content_quality_checks',
    'content_performance',
    'google_search_console_connections',
    'google_search_console_oauth_states',
    'google_search_console_daily',
    'google_search_console_pages',
    'google_search_console_queries',
    'google_search_console_sync_runs',
    'search_history',
    'user_searches',
    'lead_statuses',
    'domain_email_cache',
    'ai_message_log',
    'topup_purchases',
    'site_settings'
  ];
begin
  foreach t in array tables
  loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all on table public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;
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

const TRIAL_SEQUENCE_NEXT_SEND_SQL = `
alter table public.free_trial_signups
  add column if not exists next_sequence_email_at timestamptz;

create index if not exists free_trial_signups_next_sequence_due_idx
  on public.free_trial_signups (next_sequence_email_at)
  where converted = false
    and sequence_paused = false
    and next_sequence_email_at is not null;
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

    await client.query(RLS_DENY_PUBLIC_SENSITIVE_SQL);
    logger.info("[migrations] Ensured RLS deny-by-default on sensitive public tables", { ref });

    const v2Column = await client.query(
      "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'free_trial_signups' and column_name = 'sequence_version'"
    );
    if (v2Column.rows.length === 0) {
      await client.query(TRIAL_EMAIL_SEQUENCE_V2_SQL);
      logger.info("[migrations] Applied trial email sequence v2 startup migration", { ref });
    } else {
      logger.info("[migrations] trial email sequence v2 columns already present", { ref });
    }

    const nextSendColumn = await client.query(
      "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'free_trial_signups' and column_name = 'next_sequence_email_at'"
    );
    if (nextSendColumn.rows.length === 0) {
      await client.query(TRIAL_SEQUENCE_NEXT_SEND_SQL);
      logger.info("[migrations] Applied next_sequence_email_at column", { ref });
    } else {
      logger.info("[migrations] next_sequence_email_at column already present", { ref });
    }

    const contentJobs = await client.query(
      "select to_regclass('public.content_jobs') as table_exists"
    );
    if (!contentJobs.rows[0]?.table_exists) {
      await client.query(CONTENT_AUTOMATION_SQL);
      logger.info("[migrations] Applied content automation tables", { ref });
    } else {
      logger.info("[migrations] content automation tables already present", { ref });
    }

    const gscTable = await client.query(
      "select to_regclass('public.google_search_console_connections') as table_exists"
    );
    if (!gscTable.rows[0]?.table_exists) {
      await client.query(GOOGLE_SEARCH_CONSOLE_SQL);
      logger.info("[migrations] Applied Google Search Console tables", { ref });
    } else {
      logger.info("[migrations] Google Search Console tables already present", { ref });
    }

    // Migrate active v1/v2 nurture users onto the 30-email (v3) sequence proportionally.
    // Idempotent: only rows with sequence_version < 3 are touched.
    const pending = await client.query<{
      id: string;
      email: string;
      sequence_step: number;
      sequence_version: number;
      signed_up_at: string;
      converted: boolean;
      sequence_paused: boolean;
    }>(
      `select id, email, sequence_step, sequence_version, signed_up_at, converted, sequence_paused
       from public.free_trial_signups
       where sequence_version < 3`
    );

    const migrationReferenceTime = new Date();
    let migrated = 0;
    let completed = 0;
    for (const row of pending.rows) {
      const oldMax = row.sequence_version === 1 ? 15 : 20;
      const newStep = mapOldSequenceStepToV3(row.sequence_step ?? 0, oldMax);
      const nextStep = newStep >= 30 ? null : newStep + 1;
      const nextSendAt =
        nextStep === null
          ? null
          : computeNextSequenceEmailAt(
              row.signed_up_at,
              3,
              nextStep,
              migrationReferenceTime
            );
      await client.query(
        `update public.free_trial_signups
         set sequence_step = $1,
             sequence_version = 3,
             next_sequence_email_at = $2
         where id = $3 and sequence_version < 3`,
        [newStep, nextSendAt, row.id]
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

    // Backfill next_sequence_email_at for v3 users migrated before scheduling was added.
    const needsSchedule = await client.query<{
      id: string;
      signed_up_at: string;
      sequence_step: number;
    }>(
      `select id, signed_up_at, sequence_step
       from public.free_trial_signups
       where sequence_version = 3
         and converted = false
         and sequence_step < 30
         and next_sequence_email_at is null`
    );

    let backfilled = 0;
    const backfillReferenceTime = new Date();
    for (const row of needsSchedule.rows) {
      const nextStep = row.sequence_step + 1;
      const nextSendAt = computeNextSequenceEmailAt(
        row.signed_up_at,
        3,
        nextStep,
        backfillReferenceTime
      );
      await client.query(
        `update public.free_trial_signups
         set next_sequence_email_at = $1
         where id = $2 and next_sequence_email_at is null`,
        [nextSendAt, row.id]
      );
      backfilled += 1;
    }

    if (backfilled > 0) {
      logger.info("[migrations] Backfilled next_sequence_email_at for v3 trial users", {
        ref,
        backfilled,
      });
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
