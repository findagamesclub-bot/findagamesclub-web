-- 0206 · the club is told a report exists without being shown it.
--
-- The assertion that matters is 3: the count and the queue are two readings of
-- one rule, so a report is in exactly one of them and never in both.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

-- A thread with two replies: one the owner wrote, one the member wrote. That
-- pair is the client's own test data in miniature, and it is the whole item:
-- the two are reported identically and land in different places.
create or replace function pg_temp.seed_board()
returns table (post_id bigint, owner_reply bigint, member_reply bigint)
language plpgsql security definer as $fn$
declare v_club bigint; v_post bigint; v_owner bigint; v_member bigint;
begin
  select id into v_club from public.clubs where slug = 'army-club';

  insert into public.club_discussion_posts
    (club_id, author_profile_id, title, content, category)
  values (v_club, 'e0000000-0000-0000-0000-000000000003',
          'Terrain night', 'Who is bringing boards?', 'General')
  returning id into v_post;

  insert into public.club_discussion_replies (post_id, author_profile_id, content)
  values (v_post, 'e0000000-0000-0000-0000-000000000001', 'hello from owner')
  returning id into v_owner;

  insert into public.club_discussion_replies (post_id, author_profile_id, content)
  values (v_post, 'e0000000-0000-0000-0000-000000000003', 'hello from a member')
  returning id into v_member;

  return query select v_post, v_owner, v_member;
end $fn$;

create temp table b as select * from pg_temp.seed_board();
grant select on b to authenticated;

set local role authenticated;

do $$
declare
  w record; f record; v_club bigint; n bigint; v_else jsonb; v_err text;
begin
  select * into w from who;
  select * into f from b;
  select id into v_club from c;

  -- Both reported by the same person, in the same words, a second apart.
  perform pg_temp.be(w.member);
  perform public.flag_content('reply', f.owner_reply, 'this is not right wording');
  perform public.flag_content('reply', f.member_reply, 'issue with comment');
  -- A third the club can answer, so the two sides of the rule hold different
  -- numbers. With two reports they are one and one, and an elsewhere count
  -- that had dropped the `not` would read 1 and look correct.
  perform public.flag_content('post', f.post_id, 'bad language used');

  -- 1 · A reply the MEMBER wrote is the club's to answer. This is the half the
  --     client says does not work, and it does.
  perform pg_temp.be(w.owner);
  select count(*) into n
    from public.club_moderation_queue(v_club, '', 'open', 'hello from a member', 'waiting', 100, 0);
  if n <> 1 then
    raise exception 'FAIL 1: a member''s reply did not reach the club queue, got %', n;
  end if;

  -- 2 · A reply the OWNER wrote is not, which is 0128's rule and the actual
  --     reason their test looked broken.
  select count(*) into n
    from public.club_moderation_queue(v_club, '', 'open', 'hello from owner', 'waiting', 100, 0);
  if n <> 0 then
    raise exception 'FAIL 2: the club could answer a report about its own owner';
  end if;

  -- 3 · And the count says so. Two readings of one rule: the owner's reply is
  --     in exactly one of them, and the member's is in the other.
  v_else := public.club_moderation_elsewhere(v_club);
  if (v_else ->> 'waiting')::int <> 1 then
    raise exception 'FAIL 3: elsewhere says % waiting, expected only the owner''s reply',
      v_else ->> 'waiting';
  end if;
  -- And the club's own queue holds the other two, which is what makes the two
  -- numbers a partition of the three rather than two counts that happen to
  -- look right.
  select count(*) into n
    from public.club_moderation_queue(v_club, '', 'open', '', 'waiting', 100, 0);
  if n <> 2 then
    raise exception 'FAIL 3b: the club queue holds % of the three, expected 2', n;
  end if;

  -- 4 · It counts and never returns a row, so nothing about the content, the
  --     reporter or the author can leak through it.
  if jsonb_typeof(v_else) <> 'object'
     or not (v_else ? 'waiting' and v_else ? 'answered')
     or (select count(*) from jsonb_object_keys(v_else)) <> 2 then
    raise exception 'FAIL 4: elsewhere returned more than two counts: %', v_else;
  end if;

  -- 5 · Answering the one the club CAN answer does not move the other number.
  select id into n from public.club_moderation_queue(
    v_club, '', 'open', 'hello from a member', 'waiting', 100, 0) limit 1;
  perform public.resolve_club_flag(n, 'keep', 'Fine on a second read.');
  v_else := public.club_moderation_elsewhere(v_club);
  if (v_else ->> 'waiting')::int <> 1 or (v_else ->> 'answered')::int <> 0 then
    raise exception 'FAIL 5: answering the club''s own report moved the elsewhere count: %',
      v_else;
  end if;

  -- 6 · The site admin holds the other one, which is where it was meant to go.
  perform pg_temp.be(w.admin);
  select count(*) into n
    from public.moderation_queue('', 'open', 'hello from owner', 'waiting', 100, 0);
  if n <> 1 then
    raise exception 'FAIL 6: the admin queue does not hold the owner''s reply, got %', n;
  end if;

  -- 7 · Once the admin rules on it, the club's count moves from waiting to
  --     answered rather than disappearing. "It was dealt with" is the answer
  --     the club was missing in the first place.
  select id into n from public.moderation_queue('', 'open', 'hello from owner', 'waiting', 100, 0)
   limit 1;
  perform public.resolve_moderation_flag(n, 'keep', 'Left up.');
  perform pg_temp.be(w.owner);
  v_else := public.club_moderation_elsewhere(v_club);
  if (v_else ->> 'waiting')::int <> 0 or (v_else ->> 'answered')::int <> 1 then
    raise exception 'FAIL 7: elsewhere did not follow the admin''s answer: %', v_else;
  end if;

  -- 8 · And it is the club's own number, not the site's.
  perform pg_temp.be(w.stranger);
  begin
    perform public.club_moderation_elsewhere(v_club);
    raise exception 'FAIL 8: a stranger read the club''s elsewhere count';
  exception when insufficient_privilege then null;
  end;
end $$;

rollback;

\echo '0206 what went elsewhere: all pass'
