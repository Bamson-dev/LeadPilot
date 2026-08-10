-- target: staging
alter table search_jobs add column if not exists license_email text;
create index if not exists idx_search_jobs_license_email on search_jobs (license_email) where license_email is not null;

update search_jobs set license_email = 'bamzonline01@gmail.com' where id = '22dfeea7-0013-4a9a-95b5-3a7709a7088d' and license_email is null;
update search_jobs set license_email = 'bamzonline01@gmail.com' where id = '292c6748-b91d-4f2f-8f16-5b19c438348e' and license_email is null;
update search_jobs set license_email = 'bamzonline01@gmail.com' where id = '625acd6b-1748-4a2d-bfc2-33525b5a8520' and license_email is null;
update search_jobs set license_email = 'bamzonline01@gmail.com' where id = '89f4e36e-16a1-4cc1-836e-08cf1452740f' and license_email is null;
update search_jobs set license_email = 'bamzonline01@gmail.com' where id = '4c523855-f850-4840-be54-187da5acdd3d' and license_email is null;
update search_jobs set license_email = 'bamidelematthew71@gmail.com' where id = 'c95e3048-958f-4139-a556-42fb7d0f421d' and license_email is null;
update search_jobs set license_email = 'bamzonline01@gmail.com' where id = 'f578f7e9-cc75-4d11-bc1f-6a106da92d50' and license_email is null;
update search_jobs set license_email = 'bamzonline01@gmail.com' where id = '64a7249e-1dba-4c3e-b4e6-bad42f21d051' and license_email is null;
update search_jobs set license_email = 'bamidelematthew71@gmail.com' where id = '96f422ad-9cc3-4a7d-9429-00914c4a7c8c' and license_email is null;
update search_jobs set license_email = 'bamzonline01@gmail.com' where id = '3950863e-2c5a-47fe-a768-15f81919a541' and license_email is null;
update search_jobs set license_email = 'bamzonline01@gmail.com' where id = 'c85b41b7-759e-435f-a294-d747412e5f46' and license_email is null;
update search_jobs set license_email = 'bamzonline01@gmail.com' where id = '2b2fbdd3-510e-49a8-a481-facd5518f101' and license_email is null;
update search_jobs set license_email = 'bamzonline01@gmail.com' where id = '6613ba03-a5ac-4891-8510-1bd3929bbcdb' and license_email is null;
update search_jobs set license_email = 'bamzonline01@gmail.com' where id = '8224ad3e-dd0c-47ba-bc94-52c8f8dd8a30' and license_email is null;
update search_jobs set license_email = 'bamzonline01@gmail.com' where id = '7b1d848c-9d62-44a3-99da-00a1370a77b2' and license_email is null;
update search_jobs set license_email = 'bamzonline01@gmail.com' where id = 'ea2328e1-4ce6-4dba-b426-b9a139db7b7d' and license_email is null;
update search_jobs set license_email = 'bamzonline01@gmail.com' where id = 'dffdc20e-abfa-4967-b803-e7c1c8ed30c7' and license_email is null;
update search_jobs set license_email = 'bamzonline01@gmail.com' where id = '39e0b274-400c-4357-a003-a75b6713db82' and license_email is null;
