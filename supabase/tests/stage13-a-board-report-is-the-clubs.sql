-- 0223 · a board report is the club's to answer, whoever wrote it.
--
-- Section 1 is the client's own case and the one that fails under 0128: a
-- board REPLY written by the owner, reported by a member, reaching the club's
-- own queue rather than only a site admin's. They have reported it five times
-- and tested it the same way every time, by replying to their own thread as
-- the owner.
--
-- Section 7 is the other half of 14c: the count beside the tabs and the tabs
-- themselves have to add up to every report at the club, or a club reading
-- "13" over a list of 12 has no way to tell a rule from a bug.
--
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage7-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

create or replace function pg_temp.notices(p_who uuid) returns int
language sql security definer as $fn$
  select count(*)::int from public.notifications
   where profile_id = p_who and kind = 'content-reported' $fn$;

insert into public.club_discussion_categories (club_id, label)
  select id, 'General' from c;

-- A thread by a member, and the owner's own reply under it, which is exactly
-- how the client tests: they reply to their own board as the person who runs
-- the club.
insert into public.club_discussion_posts (club_id, author_profile_id, category, title, content)
  select id, (select member from who), 'General', 'A members thread', 'Words' from c;

create temp table post as
  select id from public.club_discussion_posts where title = 'A members thread';
grant select on post to authenticated;

insert into public.club_discussion_replies (post_id, author_profile_id, content)
  select p.id, (select owner from who), 'adding a reply to be reported :)' from post p;
insert into public.club_discussion_replies (post_id, author_profile_id, content)
  select p.id, (select member from who), 'an ordinary reply' from post p;

-- A review, and a message the owner sent, which both stay with a site admin.
insert into public.club_reviews (club_id, author_profile_id, author_name, rating, comment)
  select id, (select member from who), 'Member Seven', 1, 'Not for me' from c;
insert into public.club_messages (club_id, sender_id, recipient_id, content)
  select id, (select owner from who), (select member from who), 'a private word' from c;

create temp table ids as
  select (select id from public.club_discussion_replies
           where content = 'adding a reply to be reported :)') as owner_reply,
         (select id from public.club_discussion_replies
           where content = 'an ordinary reply') as member_reply,
         (select id from post) as members_post,
         (select id from public.club_reviews limit 1) as review,
         (select id from public.club_messages limit 1) as message;
grant select on ids to authenticated;

do $$
declare
  v_club    bigint;
  v_i       record;
  v_here    int;
  v_away    jsonb;
  v_all     int;
  v_before  int;
begin
  select id into v_club from c;
  select * into v_i from ids;

  -- ====================================================================== 1
  -- BREAK TEST, and the client's own case. The owner's board reply, reported
  -- by a member, is the club's to answer. Under 0128 this is false.
  -- ====================================================================== 1
  if not public.club_may_judge(v_club, 'reply', v_i.owner_reply) then
    raise exception
      'FAIL 1: a board reply written by the club owner is still not theirs to '
      'answer — this is the report the client has filed five times';
  end if;
  raise notice 'PASS 1: break test — the owner''s own board reply is the club''s to answer';

  -- ====================================================================== 2
  -- And everything else on a board, whoever wrote it.
  -- ====================================================================== 2
  if not public.club_may_judge(v_club, 'reply', v_i.member_reply)
     or not public.club_may_judge(v_club, 'post', v_i.members_post) then
    raise exception 'FAIL 2: ordinary board content stopped reaching the club';
  end if;
  raise notice 'PASS 2: a member''s post and reply still reach the club';

  -- ====================================================================== 3
  -- A review of the club is still nobody's but a site admin's. The client
  -- never asked for this one and it is the conflict the queue exists to avoid.
  -- ====================================================================== 3
  if public.club_may_judge(v_club, 'review', v_i.review) then
    raise exception 'FAIL 3: a club can now rule on a review of itself';
  end if;
  raise notice 'PASS 3: a review of the club still goes to a site admin';

  -- ====================================================================== 4
  -- And a message one of the team wrote, which only its two people ever see.
  -- ====================================================================== 4
  if public.club_may_judge(v_club, 'message', v_i.message) then
    raise exception 'FAIL 4: the club can now rule on a message its owner sent';
  end if;
  raise notice 'PASS 4: a message the owner sent still goes to a site admin';

  -- ====================================================================== 5
  -- Reporting it tells the CLUB, which is "going back to club owner" in the
  -- client's own words. 0131 branches on the same function, so this follows
  -- rather than being wired a second time — and that is worth asserting,
  -- because a notice that fires on one path is worse than none.
  -- ====================================================================== 5
  v_before := pg_temp.notices((select owner from who));

  set local role authenticated;
  perform pg_temp.be((select member from who));
  perform public.flag_content('reply', v_i.owner_reply, 'rude');
  reset role;

  if pg_temp.notices((select owner from who)) <> v_before + 1 then
    raise exception 'FAIL 5: the club was not told about a report on its own board';
  end if;
  raise notice 'PASS 5: the club is told, which is what "back to the club owner" means';

  -- ====================================================================== 6
  -- It is in their queue, and they can answer it.
  -- ====================================================================== 6
  set local role authenticated;
  perform pg_temp.be((select owner from who));
  select count(*) into v_here
    from public.club_moderation_queue(v_club, '', '', '', 'waiting', 100, 0) q
   where q.target_type = 'reply' and q.target_id = v_i.owner_reply;
  reset role;

  if v_here <> 1 then
    raise exception 'FAIL 6: the report is not in the club''s queue (% rows)', v_here;
  end if;

  set local role authenticated;
  perform pg_temp.be((select owner from who));
  perform public.resolve_club_flag(
    (select f.id from public.moderation_flags f
      where f.target_type = 'reply' and f.target_id = v_i.owner_reply
      order by f.id desc limit 1),
    'keep', 'Read it in context, it is fine');
  reset role;
  raise notice 'PASS 6: it is in their queue and they can answer it';

  -- ====================================================================== 7
  -- The second half of 14c: "the below text mentions 13 reports, 5 answered,
  -- however only 12 are showing and 6 answered in the filters?" The two
  -- figures are about different sets and have to add up to every report at
  -- the club, or there is no way to tell a rule from a bug.
  -- ====================================================================== 7
  set local role authenticated;
  perform pg_temp.be((select owner from who));
  perform public.flag_content('review', v_i.review, 'unfair');
  reset role;

  set local role authenticated;
  perform pg_temp.be((select owner from who));
  v_here := (public.club_moderation_counts(v_club, '', '') ->> 'all')::int;
  v_away := public.club_moderation_elsewhere(v_club);
  reset role;

  select count(*) into v_all from public.moderation_flags f where f.club_id = v_club;

  if v_here + (v_away ->> 'waiting')::int + (v_away ->> 'answered')::int <> v_all then
    raise exception
      'FAIL 7: % here plus % elsewhere is not the % reports at this club',
      v_here, (v_away ->> 'waiting')::int + (v_away ->> 'answered')::int, v_all;
  end if;
  if (v_away ->> 'waiting')::int + (v_away ->> 'answered')::int = 0 then
    raise exception 'FAIL 7: nothing went elsewhere, so the sum proves nothing';
  end if;
  raise notice 'PASS 7: what is here plus what is elsewhere is every report at the club';

  raise notice 'ALL PASS · 0223 a board report is the club''s to answer';
end $$;

rollback;
