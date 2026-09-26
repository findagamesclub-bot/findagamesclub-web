begin;
insert into auth.users (id, email) values
  ('d0000000-0000-0000-0000-000000000001', 'owner7@example.com'),
  ('d0000000-0000-0000-0000-000000000002', 'admin7@example.com'),
  ('d0000000-0000-0000-0000-000000000003', 'member7@example.com'),
  ('d0000000-0000-0000-0000-000000000004', 'helper7@example.com'),
  ('d0000000-0000-0000-0000-000000000005', 'stranger7@example.com');
update public.profiles set role = 'admin' where id = 'd0000000-0000-0000-0000-000000000002';
update public.profiles set full_name = 'Owner Seven' where id = 'd0000000-0000-0000-0000-000000000001';
update public.profiles set full_name = 'Member Seven' where id = 'd0000000-0000-0000-0000-000000000003';

insert into public.clubs (slug, name, city, status, owner_id)
values ('badge-club', 'Badge Club', 'Leeds', 'active',
        'd0000000-0000-0000-0000-000000000001');

create temp table c as select id from public.clubs where slug = 'badge-club';

-- Who is who, so a test reads `w.helper` rather than a uuid literal.
create temp table who as select
  'd0000000-0000-0000-0000-000000000001'::uuid as owner,
  'd0000000-0000-0000-0000-000000000002'::uuid as admin,
  'd0000000-0000-0000-0000-000000000003'::uuid as member,
  'd0000000-0000-0000-0000-000000000004'::uuid as helper,
  'd0000000-0000-0000-0000-000000000005'::uuid as stranger;

-- Both are owned by postgres and the blocks below run as `authenticated`, so
-- without this every read is a permission error about the wrong thing.
grant select on c, who to authenticated;

-- A helper, so the members.manage gate can be tested against a real role.
insert into public.club_team (club_id, profile_id, role)
  select id, 'd0000000-0000-0000-0000-000000000004', 'helper' from c;

-- One approved member, one who never joined.
insert into public.club_memberships (club_id, profile_id, status, tier_key, joined_at, created_at)
  select id, 'd0000000-0000-0000-0000-000000000003', 'approved', 'basic',
         now() - interval '400 days', now() - interval '400 days' from c;
-- The owner too, so awarding to yourself can be tested at all.
insert into public.club_memberships (club_id, profile_id, status, tier_key, joined_at, created_at)
  select id, 'd0000000-0000-0000-0000-000000000001', 'approved', 'basic',
         now() - interval '30 days', now() - interval '30 days' from c;
