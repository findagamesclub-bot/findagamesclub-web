begin;
insert into auth.users (id, email) values
  ('e0000000-0000-0000-0000-000000000001', 'owner8@example.com'),
  ('e0000000-0000-0000-0000-000000000002', 'admin8@example.com'),
  ('e0000000-0000-0000-0000-000000000003', 'member8@example.com'),
  ('e0000000-0000-0000-0000-000000000004', 'stranger8@example.com');
update public.profiles set role = 'admin' where id = 'e0000000-0000-0000-0000-000000000002';
update public.profiles set full_name = 'Owner Eight' where id = 'e0000000-0000-0000-0000-000000000001';
update public.profiles set full_name = 'Member Eight' where id = 'e0000000-0000-0000-0000-000000000003';

-- `tables_available` matters: a club with none is closed for booking, which
-- the trigger answers with BOOKING_CLOSED.
insert into public.clubs (slug, name, city, status, owner_id, tables_available)
values ('army-club', 'Army Club', 'Didcot', 'active',
        'e0000000-0000-0000-0000-000000000001', 6);

create temp table c as select id from public.clubs where slug = 'army-club';
create temp table who as select
  'e0000000-0000-0000-0000-000000000001'::uuid as owner,
  'e0000000-0000-0000-0000-000000000002'::uuid as admin,
  'e0000000-0000-0000-0000-000000000003'::uuid as member,
  'e0000000-0000-0000-0000-000000000004'::uuid as stranger;
grant select on c, who to authenticated;

insert into public.club_memberships (club_id, profile_id, status, tier_key, joined_at, created_at)
  select id, 'e0000000-0000-0000-0000-000000000003', 'approved', 'basic', now(), now() from c;
insert into public.club_memberships (club_id, profile_id, status, tier_key, joined_at, created_at)
  select id, 'e0000000-0000-0000-0000-000000000001', 'approved', 'basic', now(), now() from c;

-- A night and a booking to hang a result on.
insert into public.club_sessions (club_id, day, time, label)
  select id, 'Thursday', '19:00 - 22:30', 'Club session' from c;
insert into public.club_bookings
  (club_id, club_session_id, session_date, booked_by, opponent_profile_id,
   opponent_name, game_title, table_index, status)
  -- The next Thursday, because a booking is refused on a day the night does
  -- not run: BOOKING_SESSION_WRONG_DAY. Never today, so the guard against a
  -- past date cannot fire either.
  select c.id, s.id,
         current_date + (((4 - extract(isodow from current_date))::int + 6) % 7 + 1),
         'e0000000-0000-0000-0000-000000000003'::uuid,
         'e0000000-0000-0000-0000-000000000001'::uuid, 'Owner Eight',
         'Warhammer 40,000', 1, 'booked'
    from c, public.club_sessions s where s.club_id = c.id;

create temp table bk as
  select id from public.club_bookings order by id desc limit 1;
grant select on bk to authenticated;
