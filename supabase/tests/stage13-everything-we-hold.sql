-- 0190 · one account, and everything the site holds on the person behind it.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

-- The member fills their profile in, which is what "all data we hold on them
-- for their profile" means.
update public.profiles
   set bio = 'Paints slowly, plays fast.',
       home_postcode = 'OX11 7HJ',
       preferred_travel_miles = 25,
       age_groups = array['Adults'],
       availability_days = array['Thursday', 'Saturday'],
       games_interested = array['Warhammer 40,000', 'Blood Bowl'],
       factions_armies = array['Adepta Sororitas'],
       play_style_tags = array['Narrative'],
       social_profiles = '{"bluesky": "https://bsky.app/profile/example"}'::jsonb
 where id = 'e0000000-0000-0000-0000-000000000003';

insert into public.member_codes (profile_id, code)
values ('e0000000-0000-0000-0000-000000000003', 'ABCD-2345');

-- A tier with a real label, because a club's own word for it is what the
-- screen prints and `basic` is not what anybody calls it.
insert into public.club_membership_tiers (club_id, tier_key, label, position)
  select id, 'basic', 'Standard Membership', 1 from c;

-- A second club, where they are only a member, so the ordering has something
-- to order. And the owner belongs to their own club, which is the case a team
-- list above a membership list would have printed twice.
insert into public.clubs (slug, name, city, status, owner_id)
values ('second-club', 'Second Club', 'Leeds', 'active',
        'e0000000-0000-0000-0000-000000000003');
-- Its own tier, with its own name for it. Every club names these itself, which
-- is why the function joins on (club, key) rather than on the key alone: a
-- `basic` at one club is not a `basic` at another.
insert into public.club_membership_tiers (club_id, tier_key, label, position)
  select id, 'basic', 'Standard Membership', 1
    from public.clubs where slug = 'second-club';
insert into public.club_memberships (club_id, profile_id, status, tier_key, joined_at)
  select id, 'e0000000-0000-0000-0000-000000000003', 'approved', 'basic', current_date
    from public.clubs where slug = 'second-club';

-- They left this club once and came back. Status text alone would hand back
-- 'cancelled' over 'approved', which is the screen saying somebody left a club
-- they are standing in.
insert into public.club_memberships
  (club_id, profile_id, status, tier_key, joined_at, created_at)
  select id, 'e0000000-0000-0000-0000-000000000003', 'cancelled', 'basic',
         current_date - 400, now() - interval '400 days' from c;

-- Something in every tally bucket worth proving.
insert into public.club_loyalty_transactions
  (club_id, profile_id, kind, category, source_key, available_delta, lifetime_delta, description)
  select id, 'e0000000-0000-0000-0000-000000000003', 'earned', 'manual', 'test-1', 300, 300, 'x' from c;
insert into public.club_discussion_categories (club_id, label) select id, 'General' from c;
insert into public.club_discussion_posts
  (club_id, author_profile_id, category, title, content)
  select id, 'e0000000-0000-0000-0000-000000000003', 'General', 'Mine', 'My words.' from c;
insert into public.club_reviews (club_id, author_profile_id, author_name, rating, comment)
  select id, 'e0000000-0000-0000-0000-000000000003', 'Member Eight', 4, 'Good club.' from c;
insert into public.club_messages (club_id, sender_id, recipient_id, content)
  select id, 'e0000000-0000-0000-0000-000000000003',
         'e0000000-0000-0000-0000-000000000001', 'Hello.' from c;

-- A report they filed, and one about something they wrote. The second is the
-- figure that decides whether a suspension is a first resort or a last one.
-- Somebody else's review, so the two figures stay apart. Reporting their own
-- would have counted once under each, and the assertion would have been
-- agreeing with a fixture rather than testing the function.
insert into public.club_reviews (club_id, author_profile_id, author_name, rating, comment)
  select id, 'e0000000-0000-0000-0000-000000000001', 'Owner Eight', 1, 'Not for me.' from c;
insert into public.moderation_flags
  (target_type, target_id, club_id, flagged_by, reason)
  select 'review',
         (select id from public.club_reviews
           where author_profile_id = 'e0000000-0000-0000-0000-000000000001'),
         c.id, 'e0000000-0000-0000-0000-000000000003', 'I filed this.' from c;
insert into public.moderation_flags
  (target_type, target_id, club_id, flagged_by, reason)
  select 'post', (select id from public.club_discussion_posts limit 1), c.id,
         'e0000000-0000-0000-0000-000000000004', 'About their post.' from c;

do $$
declare
  w record; v_club bigint; r record;
  v_names text[]; v_j jsonb; n integer;
begin
  select * into w from who;
  select id into v_club from c;

  -- 1 · A member reaches none of the three. The gate is inside each function
  --     rather than on the page: a server action and an RPC are both public
  --     endpoints, and the admin layout says nothing about who can post here.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.member, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.admin_account_profile(w.member);
  if n <> 0 then reset role; raise exception 'FAIL 1: a member read a profile'; end if;
  select count(*) into n from public.admin_account_clubs(w.member);
  if n <> 0 then reset role; raise exception 'FAIL 2: a member read the clubs'; end if;
  v_j := public.admin_account_tally(w.member);
  reset role;
  if v_j <> '{}'::jsonb then
    raise exception 'FAIL 3: a member read the tally (%)', v_j;
  end if;

  -- 2 · And an admin reads the profile whole. Every field, because "what do
  --     you hold on me" has to be answerable from one screen.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select * into r from public.admin_account_profile(w.member);
  reset role;

  if r.bio <> 'Paints slowly, plays fast.' then
    raise exception 'FAIL 4: the bio did not come back (%)', r.bio;
  end if;
  -- The only real-world location the site stores about a person, and the
  -- reason this function needs a gate at all.
  if r.home_postcode <> 'OX11 7HJ' then
    raise exception 'FAIL 5: the postcode did not come back (%)', r.home_postcode;
  end if;
  if r.travel_miles <> 25 then
    raise exception 'FAIL 6: the travel distance is %', r.travel_miles;
  end if;
  if array_length(r.games_interested, 1) <> 2
     or array_length(r.availability_days, 1) <> 2 then
    raise exception 'FAIL 7: the list fields did not come back whole';
  end if;
  if r.social_profiles ->> 'bluesky' is null then
    raise exception 'FAIL 8: the social links did not come back';
  end if;
  if r.member_code <> 'ABCD-2345' then
    raise exception 'FAIL 9: the member code is % rather than theirs', r.member_code;
  end if;

  -- 3 · Running a club and belonging to it is ONE row about ONE club. Two
  --     lists would print Army Club twice and leave the reader to work out it
  --     was the same place.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.admin_account_clubs(w.member);
  if n <> 2 then
    reset role;
    raise exception 'FAIL 10: % club rows for somebody attached to two', n;
  end if;

  select array_agg(name order by ord) into v_names from (
    select name, row_number() over () as ord
      from public.admin_account_clubs(w.member)) q;

  select * into r from public.admin_account_clubs(w.member)
   where slug = 'second-club';
  reset role;

  -- 4 · The club they run leads, whatever it is called. "Second Club" sorts
  --     after "Army Club" by name as well, so the fixture would have passed
  --     either way; the owner test below is the one that means something.
  if v_names[1] <> 'Second Club' then
    raise exception 'FAIL 11: the club they run is not first (%)', v_names;
  end if;

  if r.team_role <> 'owner' then
    raise exception 'FAIL 12: their own club does not say owner (%)', r.team_role;
  end if;
  if r.membership_status <> 'approved' then
    raise exception 'FAIL 13: the membership on their own club reads %',
      r.membership_status;
  end if;
  -- The club's own word, not the key.
  if r.tier_label <> 'Standard Membership' then
    raise exception 'FAIL 14: the tier reads % rather than the club''s label',
      r.tier_label;
  end if;

  -- 5 · And where somebody left and came back, the LIVE membership wins.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select * into r from public.admin_account_clubs(w.member) where club_id = v_club;
  reset role;
  if r.membership_status <> 'approved' then
    raise exception 'FAIL 15: a cancelled membership beat the live one (%)',
      r.membership_status;
  end if;
  if r.team_role <> '' then
    raise exception 'FAIL 16: they are on no team at this club, got %', r.team_role;
  end if;
  if r.lifetime <> 300 then
    raise exception 'FAIL 17: the loyalty total is % rather than 300', r.lifetime;
  end if;

  -- 6 · The tally counts what is there, cancelled rows included: this is "what
  --     do we hold", not "what is live".
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_j := public.admin_account_tally(w.member);
  reset role;

  if (v_j ->> 'boardPosts')::int <> 1 then
    raise exception 'FAIL 18: boardPosts is %', v_j ->> 'boardPosts';
  end if;
  if (v_j ->> 'reviews')::int <> 1 then
    raise exception 'FAIL 19: reviews is %', v_j ->> 'reviews';
  end if;
  if (v_j ->> 'messages')::int <> 1 then
    raise exception 'FAIL 20: messages is %', v_j ->> 'messages';
  end if;
  if (v_j ->> 'reportsFiled')::int <> 1 then
    raise exception 'FAIL 21: reportsFiled is %', v_j ->> 'reportsFiled';
  end if;
  -- The one that is not a column on anything: a flag carries who reported it
  -- and not who wrote the thing, so this walks six tables through
  -- `flag_author`. It is also the figure an admin most needs.
  if (v_j ->> 'reportsAbout')::int <> 1 then
    raise exception 'FAIL 22: reportsAbout is % rather than 1', v_j ->> 'reportsAbout';
  end if;
  -- The seed books them a table, which is the only booking in here.
  if (v_j ->> 'tableBookings')::int <> 1 then
    raise exception 'FAIL 23: tableBookings is %', v_j ->> 'tableBookings';
  end if;
  -- Nothing invented. A figure that is zero still comes back, because "they
  -- have written no reviews" is an answer and a missing key is not.
  if not (v_j ? 'armyLists' and v_j ? 'claims' and v_j ? 'badges'
          and v_j ? 'listings' and v_j ? 'coaching' and v_j ? 'orders'
          and v_j ? 'eventTickets' and v_j ? 'boardReplies') then
    raise exception 'FAIL 24: the tally is missing a figure (%)', v_j;
  end if;

  -- 7 · Somebody attached to nothing reads as nothing rather than erroring,
  --     which is what an admin opening a brand new account sees.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.admin_account_clubs(w.stranger);
  v_j := public.admin_account_tally(w.stranger);
  reset role;
  if n <> 0 then
    raise exception 'FAIL 25: a stranger is attached to % clubs', n;
  end if;
  if (v_j ->> 'reviews')::int <> 0 then
    raise exception 'FAIL 26: a stranger has written % reviews', v_j ->> 'reviews';
  end if;
end $$;

rollback;
\echo '0190 everything we hold: all pass'
