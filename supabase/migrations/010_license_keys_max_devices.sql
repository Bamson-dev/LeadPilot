alter table license_keys
add column if not exists max_devices integer default 2;
