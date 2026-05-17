-- Separate extracted vs generated emails + source tracking

alter table leads
  add column if not exists extracted_email text,
  add column if not exists generated_email text,
  add column if not exists email_source text check (email_source in ('extracted', 'generated'));

-- Backfill display email from legacy column when present
update leads
set
  extracted_email = coalesce(extracted_email, email),
  email_source = coalesce(email_source, case when email is not null then 'extracted' end)
where email is not null and extracted_email is null;
