-- Atomically claim one free trial search slot per signup email.
-- Safe across multiple backend replicas (row-level lock on update).

create or replace function claim_trial_search(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row free_trial_signups%rowtype;
begin
  update free_trial_signups
  set searches_used = searches_used + 1
  where email = lower(trim(p_email))
    and searches_used < 2
  returning * into v_row;

  if found then
    return jsonb_build_object(
      'allowed', true,
      'searches_used', v_row.searches_used,
      'searches_remaining', greatest(0, 2 - v_row.searches_used)
    );
  end if;

  select * into v_row from free_trial_signups where email = lower(trim(p_email));

  if not found then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'not_found',
      'searches_used', 0,
      'searches_remaining', 0
    );
  end if;

  return jsonb_build_object(
    'allowed', false,
    'reason', 'limit',
    'searches_used', v_row.searches_used,
    'searches_remaining', greatest(0, 2 - v_row.searches_used)
  );
end;
$$;
