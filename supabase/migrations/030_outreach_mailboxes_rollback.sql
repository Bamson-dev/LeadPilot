-- Optional rollback for migration 030. Run ONLY in a separate tab when you need to re-apply 030 from scratch.
-- Safe to run even when tables are already gone (uses IF EXISTS throughout).

drop table if exists sent_emails cascade;
drop table if exists outreach_credit_transactions cascade;
drop table if exists connected_mailboxes cascade;
drop table if exists email_suppression cascade;
drop table if exists email_templates cascade;
drop table if exists outreach_accounts cascade;
drop function if exists update_outreach_accounts_timestamp() cascade;
