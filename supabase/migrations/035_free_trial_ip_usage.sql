-- Per-IP free trial search cap (max 2 searches per IP across all emails).
-- Safe across multiple backend replicas via conditional updates.

create table if not exists free_trial_ip_usage (
  ip_address text primary key,
  searches_used integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists free_trial_ip_usage_searches_used_idx
  on free_trial_ip_usage (searches_used);

alter table free_trial_ip_usage enable row level security;

create or replace function claim_trial_ip_search(p_ip text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row free_trial_ip_usage%rowtype;
  v_current integer;
begin
  select * into v_row
  from free_trial_ip_usage
  where ip_address = trim(p_ip)
  for update;

  if found then
    v_current := v_row.searches_used;
    if v_current >= 2 then
      return jsonb_build_object(
        'allowed', false,
        'reason', 'limit',
        'searches_used', v_current,
        'searches_remaining', 0
      );
    end if;

    update free_trial_ip_usage
    set searches_used = v_current + 1,
        updated_at = now()
    where ip_address = trim(p_ip)
      and searches_used = v_current
    returning * into v_row;

    if found then
      return jsonb_build_object(
        'allowed', true,
        'searches_used', v_row.searches_used,
        'searches_remaining', greatest(0, 2 - v_row.searches_used)
      );
    end if;

    select * into v_row from free_trial_ip_usage where ip_address = trim(p_ip);
    return jsonb_build_object(
      'allowed', false,
      'reason', 'limit',
      'searches_used', v_row.searches_used,
      'searches_remaining', greatest(0, 2 - v_row.searches_used)
    );
  end if;

  insert into free_trial_ip_usage (ip_address, searches_used)
  values (trim(p_ip), 1)
  on conflict (ip_address) do nothing
  returning * into v_row;

  if found then
    return jsonb_build_object(
      'allowed', true,
      'searches_used', v_row.searches_used,
      'searches_remaining', greatest(0, 2 - v_row.searches_used)
    );
  end if;

  return claim_trial_ip_search(p_ip);
end;
$$;

create or replace function release_trial_ip_search(p_ip text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current integer;
begin
  select searches_used into v_current
  from free_trial_ip_usage
  where ip_address = trim(p_ip)
  for update;

  if not found or v_current <= 0 then
    return;
  end if;

  update free_trial_ip_usage
  set searches_used = v_current - 1,
      updated_at = now()
  where ip_address = trim(p_ip)
    and searches_used = v_current;
end;
$$;
