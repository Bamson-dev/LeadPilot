-- Run this in Supabase SQL Editor to verify Activation Tracker data

-- Total activated users ever
select count(*) as total_activated_users
from license_keys
where activated = true;

-- Activations today
select count(*) as activations_today
from license_keys
where activated = true
and date(activated_at) = current_date;

-- Activations last 7 days
select count(*) as activations_last_7_days
from license_keys
where activated = true
and activated_at >= now() - interval '7 days';

-- Activations last 30 days
select count(*) as activations_last_30_days
from license_keys
where activated = true
and activated_at >= now() - interval '30 days';

-- Daily breakdown last 14 days
select
  date(activated_at) as day,
  count(*) as activations
from license_keys
where activated = true
and activated_at >= now() - interval '14 days'
group by date(activated_at)
order by day desc;

-- This month
select count(*) as activations_this_month
from license_keys
where activated = true
and date_trunc('month', activated_at) = date_trunc('month', current_date);
