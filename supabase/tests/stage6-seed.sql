begin;
insert into auth.users (id, email) values
  ('c0000000-0000-0000-0000-000000000001', 'owner@example.com'),
  ('c0000000-0000-0000-0000-000000000002', 'admin@example.com'),
  ('c0000000-0000-0000-0000-000000000003', 'member@example.com'),
  ('c0000000-0000-0000-0000-000000000004', 'busy@example.com'),
  ('c0000000-0000-0000-0000-000000000005', 'quiet@example.com');
update public.profiles set role='admin' where id='c0000000-0000-0000-0000-000000000002';
update public.profiles set full_name='Owner One' where id='c0000000-0000-0000-0000-000000000001';
update public.profiles set full_name='Busy Bee'  where id='c0000000-0000-0000-0000-000000000004';
update public.profiles set full_name='Quiet Cat' where id='c0000000-0000-0000-0000-000000000005';

insert into public.clubs (slug, name, city, status, owner_id) values
  ('real-club','Real Club','Leeds','active','c0000000-0000-0000-0000-000000000001'),
  ('other-club','Other Club','Hull','paused',null);

create temp table ids as
  select (select id from public.clubs where slug='real-club') as club,
         (select id from public.clubs where slug='other-club') as other;

-- Same weekday as today, so every seeded booking below satisfies the
-- BOOKING_SESSION_WRONG_DAY trigger without hard-coding a day of the week.
insert into public.club_sessions (club_id, day, time, label, position)
  select club, trim(to_char(public.london_today(), 'FMDay')), '19:00', 'Club night', 0 from ids;

-- Two approved members, one pending. Only approved count on the roster.
insert into public.club_memberships (club_id, profile_id, status, tier_key, joined_at, created_at)
  select club, 'c0000000-0000-0000-0000-000000000004', 'approved', 'basic',
         now() - interval '10 days', now() - interval '10 days' from ids;
insert into public.club_memberships (club_id, profile_id, status, tier_key, joined_at, created_at)
  select club, 'c0000000-0000-0000-0000-000000000005', 'approved', 'basic',
         now() - interval '200 days', now() - interval '200 days' from ids;
insert into public.club_memberships (club_id, profile_id, status, tier_key, created_at)
  select club, 'c0000000-0000-0000-0000-000000000003', 'pending', 'basic',
         now() - interval '2 days' from ids;

-- Three bookings inside the window, one cancelled, one outside it.
-- Triggers off for the inserts only: the booking guards refuse a date in the
-- past, which is exactly what analytics reads. This turns them off to write
-- history, not to test around them.
alter table public.club_bookings disable trigger user;
insert into public.club_bookings (club_id, booked_by, session_date, status, total_price,
                                  club_session_id, session_day, session_time, session_label,
                                  game_title)
  select club, 'c0000000-0000-0000-0000-000000000004', public.london_today() - 7, 'booked', 10,
         (select id from public.club_sessions limit 1), trim(to_char(public.london_today(), 'FMDay')),'19:00','Club night',
         'Warhammer 40,000' from ids;
insert into public.club_bookings (club_id, booked_by, session_date, status, total_price,
                                  club_session_id, session_day, session_time, session_label,
                                  game_title)
  select club, 'c0000000-0000-0000-0000-000000000004', public.london_today() - 14, 'booked', 10,
         (select id from public.club_sessions limit 1), trim(to_char(public.london_today(), 'FMDay')),'19:00','Club night',
         'Warhammer 40,000' from ids;
insert into public.club_bookings (club_id, booked_by, session_date, status, total_price,
                                  club_session_id, session_day, session_time, session_label,
                                  game_title)
  select club, 'c0000000-0000-0000-0000-000000000005', public.london_today() - 21, 'booked', 10,
         (select id from public.club_sessions limit 1), trim(to_char(public.london_today(), 'FMDay')),'19:00','Club night',
         'Warhammer 40,000' from ids;
update public.club_bookings set status = 'cancelled', cancelled_at = now()
 where session_date = public.london_today() - 21;
insert into public.club_bookings (club_id, booked_by, session_date, status, total_price,
                                  club_session_id, session_day, session_time, session_label,
                                  game_title)
  select club, 'c0000000-0000-0000-0000-000000000004', public.london_today() - 301, 'booked', 10,
         (select id from public.club_sessions limit 1), trim(to_char(public.london_today(), 'FMDay')),'19:00','Club night',
         'Warhammer 40,000' from ids;

alter table public.club_bookings enable trigger user;

-- One post and one reply inside the window; one removed post that must not count.
insert into public.club_discussion_posts (club_id, author_profile_id, category, title, content, created_at)
  select club, 'c0000000-0000-0000-0000-000000000004', 'general', 'Hello', 'Body',
         now() - interval '4 days' from ids;
insert into public.club_discussion_posts (club_id, author_profile_id, category, title, content, created_at, removed_at)
  select club, 'c0000000-0000-0000-0000-000000000005', 'general', 'Gone', 'Body',
         now() - interval '4 days', now() from ids;
insert into public.club_discussion_replies (post_id, author_profile_id, content, created_at)
  select (select id from public.club_discussion_posts where title='Hello'),
         'c0000000-0000-0000-0000-000000000005', 'Reply', now() - interval '3 days';

-- An event with 40 places, 2 sold, 1 cancelled.
insert into public.club_events (club_id, legacy_id, title, start_date, status)
  select club, 'e-soon', 'Soon', public.london_today() + 3, 'published' from ids;
insert into public.club_events (club_id, legacy_id, title, start_date, status)
  select club, 'e-past', 'Past One', public.london_today() - 10, 'published' from ids;
insert into public.club_event_ticket_types (event_id, label, quantity_available)
  select id, 'Standard', 40 from public.club_events where legacy_id = 'e-past';
insert into public.club_event_bookings (club_id, event_id, profile_id, status, total, full_name, email, reference)
  select club, (select id from public.club_events where legacy_id='e-past'),
         'c0000000-0000-0000-0000-000000000004', 'reserved', 25, 'Busy Bee', 'b@e.com', 'R1' from ids;
insert into public.club_event_bookings (club_id, event_id, profile_id, status, total, full_name, email, reference)
  select club, (select id from public.club_events where legacy_id='e-past'),
         'c0000000-0000-0000-0000-000000000005', 'reserved', 25, 'Quiet Cat', 'q@e.com', 'R2' from ids;
insert into public.club_event_bookings (club_id, event_id, profile_id, status, total, full_name, email, reference)
  select club, (select id from public.club_events where legacy_id='e-past'),
         'c0000000-0000-0000-0000-000000000003', 'reserved', 25, 'Nope', 'n@e.com', 'R3' from ids;
update public.club_event_bookings set status='cancelled', cancelled_at=now() where reference='R3';
