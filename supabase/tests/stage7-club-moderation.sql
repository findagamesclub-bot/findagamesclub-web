-- 0128 · the club answers its own reports first.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage7-seed.sql

insert into public.club_discussion_categories (club_id, label)
  select id, 'General' from c;

-- Three things to report: a member's post, the owner's own post, and a review.
insert into public.club_discussion_posts (club_id, author_profile_id, category, title, content)
  select id, 'd0000000-0000-0000-0000-000000000003', 'General',
         'Members post', 'Words from an ordinary member' from c;
insert into public.club_discussion_posts (club_id, author_profile_id, category, title, content)
  select id, 'd0000000-0000-0000-0000-000000000001', 'General',
         'Owners post', 'Words from the person who runs the club' from c;
insert into public.club_reviews (club_id, author_profile_id, author_name, rating, comment)
  select id, 'd0000000-0000-0000-0000-000000000003', 'Member Seven', 1,
         'This club is rubbish' from c;

create temp table ids as
  select (select id from public.club_discussion_posts where title = 'Members post') as mine,
         (select id from public.club_discussion_posts where title = 'Owners post') as theirs,
         (select id from public.club_reviews limit 1) as review;
grant select on ids to authenticated;

create or replace function pg_temp.state(p_table text, p_id bigint) returns text
language plpgsql security definer as $fn$
declare v_removed boolean;
begin
  execute format('select removed_at is not null from public.%I where id = $1', p_table)
    into v_removed using p_id;
  if v_removed is null then return 'gone'; end if;
  return case when v_removed then 'removed' else 'live' end;
end $fn$;

create or replace function pg_temp.notices(p_who uuid, p_kind text) returns int
language sql security definer as $fn$
  select count(*)::int from public.notifications
   where profile_id = p_who and kind = p_kind $fn$;

create or replace function pg_temp.told(p_who uuid, p_kind text) returns text
language sql security definer as $fn$
  select title || ' | ' || body || ' | ' || href from public.notifications
   where profile_id = p_who and kind = p_kind order by id desc limit 1 $fn$;

create or replace function pg_temp.notice(p_who uuid, p_kind text) returns text
language sql security definer as $fn$
  select body from public.notifications
   where profile_id = p_who and kind = p_kind order by id desc limit 1 $fn$;

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

set local role authenticated;

do $$
declare v_club bigint; w record; i record; n int; j jsonb; s text; t text; f bigint;
begin
  select * into w from who;
  select id into v_club from c;
  select * into i from ids;

  -- The member reports all three.
  perform pg_temp.be(w.member);
  perform public.flag_content('post', i.mine, 'not on');
  perform public.flag_content('post', i.theirs, 'the owner said this');
  perform public.flag_content('review', i.review, 'unfair');

  -- ----------------------------------------------------- who was told (0131)
  -- The club's own team hears about BOTH board posts, since 0223: the one an
  -- ordinary member wrote and the one the owner wrote. A board is the club's
  -- own room, whoever spoke in it. These two used to expect 1, back when
  -- anything the team wrote went to a site admin instead.
  assert pg_temp.notices(w.owner, 'content-reported') = 2,
    'the owner has ' || pg_temp.notices(w.owner, 'content-reported')
      || ' notices, expected both board posts';
  assert pg_temp.notices(w.helper, 'content-reported') = 2,
    'a helper has ' || pg_temp.notices(w.helper, 'content-reported')
      || ' notices, and a helper can answer either';
  t := pg_temp.told(w.owner, 'content-reported');
  assert t like '%at Badge Club%' and t like '%a board post%'
     and t like '%/clubs/badge-club/manage/moderation%',
    'the club''s notice is wrong: ' || t;
  raise notice 'PASS told: the club is told, named, and linked to its own queue';

  -- The admin hears about the one nobody at the club may rule on, the review,
  -- and about nothing else. Three were reported.
  assert pg_temp.notices(w.admin, 'content-reported') = 1,
    'the admin has ' || pg_temp.notices(w.admin, 'content-reported')
      || ' notices, expected only the review';
  t := pg_temp.told(w.admin, 'content-reported');
  assert t like '%a review%' and t like '%/admin/moderation%',
    'the admin was told about the wrong one: ' || t;
  raise notice 'PASS told: the admin hears only what only they can answer';

  -- And the three split cleanly between them: two to the club, one to the
  -- admin, none counted twice and none dropped. That partition is what the
  -- numbers above are really asserting, so it is worth saying once directly.
  assert pg_temp.notices(w.owner, 'content-reported')
       + pg_temp.notices(w.admin, 'content-reported') = 3,
    'the three reports did not split cleanly between the club and the admin';
  raise notice 'PASS told: a review goes to the admin and a board stays at the club';

  -- ---------------------------------------------------------------- the gate
  perform pg_temp.be(w.stranger);
  begin
    perform public.club_moderation_queue(v_club);
    raise exception 'NOT_REACHED';
  exception
    when insufficient_privilege then raise notice 'PASS gate: a stranger is refused';
    when others then raise exception 'wrong error for a stranger: %', sqlerrm;
  end;
  perform pg_temp.be(w.member);
  begin
    perform public.club_moderation_queue(v_club);
    raise exception 'NOT_REACHED';
  exception
    when insufficient_privilege then raise notice 'PASS gate: a plain member is refused';
    when others then raise exception 'wrong error for a member: %', sqlerrm;
  end;

  -- A helper may, because taking a post down is already theirs.
  perform pg_temp.be(w.helper);
  select count(*) into n from public.club_moderation_queue(v_club);
  assert n = 2, 'a helper sees ' || n || ' reports, expected both board posts';
  raise notice 'PASS gate: a helper sees the queue';

  -- ------------------------------------------------------- what the club sees
  perform pg_temp.be(w.owner);
  -- Both board posts since 0223, and the review still not. What the club may
  -- never rule on is a review OF ITSELF, which is the conflict of interest
  -- the queue exists to prevent; its own team's words on its own board are a
  -- different question and the client asked for them to come here.
  select count(*) into n from public.club_moderation_queue(v_club);
  assert n = 2, 'the club sees ' || n || ', expected both board posts';
  select count(*) into n from public.club_moderation_queue(v_club) q
   where q.target_id = i.review;
  assert n = 0, 'a review of the club reached the club''s own queue';
  raise notice 'PASS scope: a review never reaches the club, a board always does';

  -- And the admin still has all three.
  perform pg_temp.be(w.admin);
  select count(*) into n from public.moderation_queue('', 'open', '');
  assert n = 3, 'the admin sees ' || n || ' of three';
  raise notice 'PASS scope: the admin keeps every one of them';

  -- An admin can open a club's own queue too. `club_role_of` is null for an
  -- admin with no team row, while `getClubAccess` hands them every capability,
  -- so without the extra clause the console page would read "would not load"
  -- about a queue that works.
  select count(*) into n from public.club_moderation_queue(v_club);
  assert n = 2, 'an admin opening the club queue sees ' || n;
  raise notice 'PASS admin: a site admin can read a club''s own queue';

  -- The club is told who reported it (0129). 0128 returned 'Somebody' and the
  -- client asked for the name, having seen the argument against.
  perform pg_temp.be(w.owner);
  select reporter_name into s from public.club_moderation_queue(v_club);
  assert s = 'Member Seven', 'the club reads the reporter as ' || s;
  raise notice 'PASS name: the club is told who reported it';

  -- ------------------------------------------------------------- the counts
  j := public.club_moderation_counts(v_club);
  assert (j->>'open')::int = 2 and (j->>'all')::int = 2, 'counts are wrong: ' || j::text;
  raise notice 'PASS counts: they count what the club can actually see';

  -- --------------------------------------------------------- the club answers
  -- What the club cannot answer is a review OF ITSELF, and that line
  -- has not moved: a club ruling on a bad review of itself is the one
  -- conflict of interest this whole queue exists to prevent.
  select id into f from public.moderation_flags
   where target_type = 'review' and target_id = i.review;
  begin
    perform public.resolve_club_flag(f, 'remove', 'we did not like it');
    raise exception 'NOT_REACHED';
  exception
    when others then
      assert sqlerrm like '%ADMIN_ONLY%',
        'wrong error answering a review of the club: ' || sqlerrm;
      raise notice 'PASS refuse: the club cannot rule on a review of itself';
  end;

  select id into f from public.moderation_flags
   where target_type = 'post' and target_id = i.mine;
  assert public.resolve_club_flag(f, 'remove', 'Not what the board is for.'),
    'the club could not answer';
  assert pg_temp.state('club_discussion_posts', i.mine) = 'removed',
    'the post was not taken down';
  assert pg_temp.notices(w.member, 'report-answered') = 1,
    'the reporter was not told the club had answered';
  raise notice 'PASS answer: the club takes it down and the reporter is told';

  -- ------------------------------------------------------------ the overrule
  perform pg_temp.be(w.admin);
  assert public.resolve_moderation_flag(f, 'keep', 'Fine on a second read.'),
    'the admin could not overrule the club';
  assert pg_temp.state('club_discussion_posts', i.mine) = 'live',
    'the admin kept it but the post is still down';
  select status into s from public.moderation_flags where id = f;
  assert s = 'dismissed', 'the flag still reads ' || s;
  -- One unread notice per report, rewritten rather than repeated:
  -- `notify_person` de-duplicates on the flag while it is unread, which is
  -- right here. Telling somebody twice about one report is noise; telling them
  -- the wrong outcome is not. So the count holds and the words move.
  assert pg_temp.notices(w.member, 'report-answered') = 1,
    'the overrule wrote a second notice instead of correcting the first';
  s := pg_temp.notice(w.member, 'report-answered');
  assert s like '%left up%' and s like '%Fine on a second read.%',
    'the notice still says the old outcome: ' || s;
  raise notice 'PASS overrule: an admin puts it back and the notice is corrected';

  -- Answering it the same way again changes nothing and says nothing.
  perform public.resolve_moderation_flag(f, 'keep', 'Still fine.');
  assert pg_temp.notice(w.member, 'report-answered') = s,
    'the same answer twice rewrote the notice';
  raise notice 'PASS quiet: the same answer twice tells nobody again';

  -- ------------------------------------------- the team's own board post
  -- Last, because answering it writes the reporter another notice and the
  -- de-duplication assertions above count them. A report about the OWNER's
  -- own board post is the club's to answer since 0223; this used to expect
  -- ADMIN_ONLY, on 0128's rule that nobody rules on themselves. The client
  -- overruled that for boards in item 14b: "for board reports, I think it
  -- should go to club owner, as will be hard to manage with lots of clubs
  -- for admin."
  perform pg_temp.be(w.owner);
  select id into f from public.moderation_flags
   where target_type = 'post' and target_id = i.theirs;
  assert public.resolve_club_flag(f, 'keep', 'Fine as it stands.'),
    'the club could not answer a report about its own owner''s board post';
  assert pg_temp.notices(w.member, 'report-answered') = 2,
    'the reporter was not told about the second answer';
  raise notice 'PASS answer: a board post by the team is the club''s to answer';

  raise notice 'ALL PASS · 0128 club moderation';
end $$;

rollback;
