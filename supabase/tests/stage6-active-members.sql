\i supabase/tests/stage6-seed.sql
-- Two outsiders: neither is on the roster, both do something in the window.
insert into auth.users (id, email) values
  ('c0000000-0000-0000-0000-000000000009', 'outsider1@example.com'),
  ('c0000000-0000-0000-0000-00000000000a', 'outsider2@example.com');
insert into public.club_event_bookings (club_id, event_id, profile_id, status, total,
                                        full_name, email, reference)
  select (select id from public.clubs where slug='real-club'),
         (select id from public.club_events where legacy_id='e-past'),
         'c0000000-0000-0000-0000-000000000009', 'reserved', 25, 'Out One', 'o1@e.com', 'R9';
insert into public.club_discussion_posts (club_id, author_profile_id, category, title, content, created_at)
  select id, 'c0000000-0000-0000-0000-00000000000a', 'general', 'Hi there', 'Body',
         now() - interval '2 days' from public.clubs where slug='real-club';

select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare c bigint; j jsonb;
begin
  select id into c from public.clubs where slug='real-club';
  j := public.club_analytics_summary(c, public.london_today() - 90, public.london_today());
  assert (j->>'members')::int = 2, 'roster is 2, got ' || (j->>'members');
  assert (j->>'activeMembers')::int = 2,
    'active members must be members, got ' || (j->>'activeMembers');
  assert (j->>'activeVisitors')::int = 2,
    'two outsiders turned up, got ' || (j->>'activeVisitors');
  assert (j->>'activeRate')::numeric = 100,
    'the rate is members over roster, got ' || (j->>'activeRate');
  assert (j->>'activeRate')::numeric <= 100, 'the rate can never exceed 100';
  assert (j->>'activeMembers')::int <= (j->>'members')::int,
    'active members can never exceed the roster';
  raise notice 'PASS 0119: active members are members, and the rate cannot exceed 100';
  -- Outsiders still count in the raw totals, because they really did book.
  assert (j->>'posts')::int = 2, 'the outsider post still counts, got ' || (j->>'posts');
  assert (j->>'eventTickets')::int = 3, 'the outsider ticket still counts, got ' || (j->>'eventTickets');
  raise notice 'PASS 0119: what they did still counts, only who they are changed';
end $$;
rollback;
