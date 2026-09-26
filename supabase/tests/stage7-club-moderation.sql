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
  -- The club's own team, because the club is the one who answers a report on
  -- an ordinary member's post.
  assert pg_temp.notices(w.owner, 'content-reported') = 1,
    'the owner was not told about a report on their club';
  assert pg_temp.notices(w.helper, 'content-reported') = 1,
    'a helper was not told, and a helper can answer one';
  t := pg_temp.told(w.owner, 'content-reported');
  assert t like '%at Badge Club%' and t like '%a board post%'
     and t like '%/clubs/badge-club/manage/moderation%',
    'the club''s notice is wrong: ' || t;
  raise notice 'PASS told: the club is told, named, and linked to its own queue';

  -- The admin hears about the two nobody at the club may rule on, the review
  -- and the owner's own post, and about nothing else. Three were reported.
  assert pg_temp.notices(w.admin, 'content-reported') = 2,
    'the admin has ' || pg_temp.notices(w.admin, 'content-reported')
      || ' notices, expected the review and the team''s own post';
  t := pg_temp.told(w.admin, 'content-reported');
  assert t like '%a review%' and t like '%/admin/moderation%',
    'the admin was told about the wrong one: ' || t;
  raise notice 'PASS told: the admin hears only what only they can answer';

  -- Nobody at the club was told about the report on the owner's own post,
  -- which is the whole point of it going to an admin instead.
  assert pg_temp.notices(w.owner, 'content-reported') = 1,
    'the club was told about a report only an admin can answer';
  raise notice 'PASS told: the club hears nothing about its own team''s words';

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
  assert n = 1, 'a helper sees ' || n || ' reports, expected one';
  raise notice 'PASS gate: a helper sees the queue';

  -- ------------------------------------------------------- what the club sees
  perform pg_temp.be(w.owner);
  select count(*) into n from public.club_moderation_queue(v_club);
  assert n = 1, 'the club sees ' || n || ', expected only the ordinary member''s post';
  select target_id into f from public.club_moderation_queue(v_club);
  assert f = i.mine, 'the club is being shown the wrong report';
  raise notice 'PASS scope: a review and the team''s own words never reach the club';

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
  assert n = 1, 'an admin opening the club queue sees ' || n;
  raise notice 'PASS admin: a site admin can read a club''s own queue';

  -- The club is told who reported it (0129). 0128 returned 'Somebody' and the
  -- client asked for the name, having seen the argument against.
  perform pg_temp.be(w.owner);
  select reporter_name into s from public.club_moderation_queue(v_club);
  assert s = 'Member Seven', 'the club reads the reporter as ' || s;
  raise notice 'PASS name: the club is told who reported it';

  -- ------------------------------------------------------------- the counts
  j := public.club_moderation_counts(v_club);
  assert (j->>'open')::int = 1 and (j->>'all')::int = 1, 'counts are wrong: ' || j::text;
  raise notice 'PASS counts: they count what the club can actually see';

  -- --------------------------------------------------------- the club answers
  select id into f from public.moderation_flags
   where target_type = 'post' and target_id = i.theirs;
  begin
    perform public.resolve_club_flag(f, 'remove', 'mine to take down');
    raise exception 'NOT_REACHED';
  exception
    when others then
      assert sqlerrm like '%ADMIN_ONLY%',
        'wrong error answering a report about the team: ' || sqlerrm;
      raise notice 'PASS refuse: the club cannot answer a report about its own team';
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

  raise notice 'ALL PASS · 0128 club moderation';
end $$;

rollback;
