-- Idempotency + payout admin notes (payment_reference may already exist from 004)

alter table license_keys
add column if not exists payment_reference text unique;

alter table payout_requests
add column if not exists status_note text;
