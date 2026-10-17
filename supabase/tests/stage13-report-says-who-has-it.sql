-- 0196 · the member's own list saying who is looking at each report.
--
-- The point is not that `with_club` has a value. It is that the member's list
-- and the club's queue cannot disagree about who has something, because the
-- client read those two screens side by side three times and concluded the
-- routing was broken when it was right.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

-- Two board posts: one by an ordinary member, one by the owner. Written as
-- postgres, because the fixture is not what is under test.
create or replace function pg_temp.seed_posts()
returns table (by_member bigint, by_owner bigint)
language plpgsql security definer as $fn$
declare v_club bigint; v_m bigint; v_o bigint;
begin
  select id into v_club from public.clubs where slug = 'army-club';
  insert into public.club_discussion_posts
    (club_id, author_profile_id, category, title, content)
  values (v_club, 'e0000000-0000-0000-0000-000000000003', 'General',
          'Paints', 'Which primer is everybody using?')
  returning id into v_m;
  insert into public.club_discussion_posts
    (club_id, author_profile_id, category, title, content)
  values (v_club, 'e0000000-0000-0000-0000-000000000001', 'General',
          'From the owner', 'hello from owner')
  returning id into v_o;
  return query select v_m, v_o;
end $fn$;

create temp table posts as select * from pg_temp.seed_posts();
grant select on posts to authenticated;

set local role authenticated;

do $$
declare
  w record; p record; v_club bigint;
  v_member_flag bigint; v_owner_flag bigint;
  v_with_club boolean; v_in_club_queue bigint;
begin
  select * into w from who;
  select * into p from posts;
  select id into v_club from c;

  -- The member reports both posts, which is the client's own 16 Oct pair:
  -- one by somebody ordinary, one by the owner.
  perform pg_temp.be(w.member);
  v_member_flag := public.flag_content('post', p.by_member, 'bad language used');
  v_owner_flag  := public.flag_content('post', p.by_owner,  'this is not right wording');

  -- 1 · A report about an ordinary member's post is the club's.
  select r.with_club into v_with_club
    from public.my_reports('any', '', '', 'recent', 100, 0) r
   where r.id = v_member_flag;
  if v_with_club is not true then
    raise exception 'FAIL 1: a report on a member''s post did not read as the club''s: %',
      v_with_club;
  end if;

  -- 2 · A report about the OWNER's post is not, and this is the whole item.
  select r.with_club into v_with_club
    from public.my_reports('any', '', '', 'recent', 100, 0) r
   where r.id = v_owner_flag;
  if v_with_club is not false then
    raise exception 'FAIL 2: a report on the owner''s own post read as the club''s: %',
      v_with_club;
  end if;

  -- 3 · And the two screens agree. The club's queue holds exactly the one the
  -- member's list says it holds, which is the comparison the client made.
  perform pg_temp.be(w.owner);
  select count(*) into v_in_club_queue
    from public.club_moderation_queue(v_club, '', 'open', '', 'waiting', 100, 0) q
   where q.id = v_member_flag;
  if v_in_club_queue <> 1 then
    raise exception 'FAIL 3: the club queue is missing the report its member was told it had';
  end if;

  select count(*) into v_in_club_queue
    from public.club_moderation_queue(v_club, '', 'open', '', 'waiting', 100, 0) q
   where q.id = v_owner_flag;
  if v_in_club_queue <> 0 then
    raise exception 'FAIL 4: the club queue holds a report about its own owner';
  end if;

  -- 5 · A stranger reading their own list sees neither, because it is not
  -- theirs. `my_reports` filters on flagged_by and nothing else does.
  perform pg_temp.be(w.stranger);
  if (select count(*) from public.my_reports('any', '', '', 'recent', 100, 0)) <> 0 then
    raise exception 'FAIL 5: somebody read another person''s reports';
  end if;

  -- 6 · The dead 0127 signatures are gone, so a caller that forgets an
  -- argument fails loudly instead of quietly getting a shape with no
  -- `with_club` in it.
  if to_regprocedure('public.my_reports(text, integer, integer)') is not null then
    raise exception 'FAIL 6: the old three-argument my_reports is still callable';
  end if;
  if to_regprocedure('public.my_report_counts()') is not null then
    raise exception 'FAIL 6: the old no-argument my_report_counts is still callable';
  end if;

  raise notice 'all six pass';
end $$;

reset role;
rollback;
