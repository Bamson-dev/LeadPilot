-- Extend device slots to support up to 4 devices per license
alter table license_keys
  add column if not exists device_three text,
  add column if not exists device_four text;

-- Sensible default: 4 devices (matches product default)
alter table license_keys
  alter column max_devices set default 4;

update license_keys
set max_devices = 4
where max_devices is null or max_devices < 1;

-- Clear whitespace-only phantom device entries that block registration
update license_keys
set device_one = null
where device_one is not null and trim(device_one) = '';

update license_keys
set device_two = null
where device_two is not null and trim(device_two) = '';

update license_keys
set device_three = null
where device_three is not null and trim(device_three) = '';

update license_keys
set device_four = null
where device_four is not null and trim(device_four) = '';
