-- P0: Enable RLS (deny-by-default) on sensitive public tables.
-- Backend uses the service_role key which bypasses RLS.
-- anon/authenticated PostgREST roles get zero row access without policies.

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
      -- Explicit deny for anon/authenticated (service_role bypasses RLS)
      execute format('revoke all on table public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- Defense in depth: revoke sequence usage where present
do $$
declare
  seq text;
begin
  for seq in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'S'
      and c.relname like '%connected_mailboxes%'
  loop
    execute format('revoke all on sequence public.%I from anon, authenticated', seq);
  end loop;
exception
  when others then
    null;
end $$;
