-- Separate verified vs predicted emails on business leads
alter table business_leads
  add column if not exists verified_email text,
  add column if not exists predicted_email text,
  add column if not exists predicted_email_secondary text,
  add column if not exists prediction_confidence smallint,
  add column if not exists prediction_confidence_secondary smallint;

-- Backfill verified from legacy email when source was extracted/website
update business_leads
set verified_email = email
where verified_email is null
  and email is not null
  and email_source in ('extracted', 'website');

-- Legacy generated rows become predicted (confidence unknown — re-run search to refresh)
update business_leads
set
  predicted_email = email,
  email = null,
  email_source = 'predicted'
where email is not null
  and email_source = 'generated'
  and predicted_email is null;
