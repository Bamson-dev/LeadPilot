-- Clear phantom device slot values that block first-time activation
update license_keys
set device_one = null
where device_one is not null
  and lower(trim(device_one)) in ('null', 'undefined', 'none', 'n/a', '0', '');

update license_keys
set device_two = null
where device_two is not null
  and lower(trim(device_two)) in ('null', 'undefined', 'none', 'n/a', '0', '');

update license_keys
set device_three = null
where device_three is not null
  and lower(trim(device_three)) in ('null', 'undefined', 'none', 'n/a', '0', '');

update license_keys
set device_four = null
where device_four is not null
  and lower(trim(device_four)) in ('null', 'undefined', 'none', 'n/a', '0', '');
