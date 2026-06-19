-- Ensure all licenses allow 4 devices (product default).
update license_keys
set max_devices = 4
where max_devices is null or max_devices < 4;

alter table license_keys
  alter column max_devices set default 4;
