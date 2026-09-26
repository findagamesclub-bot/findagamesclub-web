-- 0125 · searching, counting and paging the awards.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage7-seed.sql

-- Two more members, so sorting by name and paging have something to do.
insert into auth.users (id, email) values
  ('d0000000-0000-0000-0000-000000000006', 'anna7@example.com'),
  ('d0000000-0000-0000-0000-000000000007', 'zoe7@example.com');
update public.profiles set full_name = 'Anna Able'
 where id = 'd0000000-0000-0000-0000-000000000006';
update public.profiles set full_name = 'Zoe Zephyr'
 where id = 'd0000000-0000-0000-0000-000000000007';
insert into public.club_memberships (club_id, profile_id, status, tier_key, joined_at, created_at)
  select id, 'd0000000-0000-0000-0000-000000000006', 'approved', 'basic', now(), now() from c;
insert into public.club_memberships (club_id, profile_id, status, tier_key, joined_at, created_at)
  select id, 'd0000000-0000-0000-0000-000000000007', 'approved', 'basic', now(), now() from c;

-- Awarding stamps `now()`, so every row would share a timestamp and the two
-- date sorts would be testing nothing. Set them by hand, as postgres.
create or replace function pg_temp.dated(p_award bigint, p_ago interval)
returns void language sql security definer as $fn$
  update public.member_badges set awarded_at = now() - p_ago where id = p_award $fn$;

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

set local role authenticated;

do $$
declare
  v_club bigint; v_alpha bigint; v_beta bigint; v_zulu bigint;
  w record; n bigint; j jsonb; names text[]; total bigint;
begin
  select * into w from who;
  select id into v_club from c;

  perform pg_temp.be(w.owner);
  v_alpha := public.save_club_badge(v_club, null, 'Alpha award',
    'Given for turning up', 'star', 'club', true);
  v_beta := public.save_club_badge(v_club, null, 'Beta prize',
    'Given for painting', 'brush', 'service', true);
  v_zulu := public.save_club_badge(v_club, null, 'Zulu relic',
    'Nobody gets this any more', 'shield', 'campaign', false);

  -- Alpha to three people, Beta to one, Zulu to one. Zulu is retired, so it
  -- has to be awarded while live and retired afterwards.
  perform pg_temp.dated(public.award_member_badge(v_alpha, w.member, 'swamp table'),
                        interval '3 days');
  perform pg_temp.dated(public.award_member_badge(v_alpha,
    'd0000000-0000-0000-0000-000000000006', ''), interval '2 days');
  perform pg_temp.dated(public.award_member_badge(v_alpha,
    'd0000000-0000-0000-0000-000000000007', ''), interval '1 day');
  perform pg_temp.dated(public.award_member_badge(v_beta, w.member, 'the ogres'),
                        interval '10 days');
  perform public.save_club_badge(v_club, v_zulu, 'Zulu relic',
    'Nobody gets this any more', 'shield', 'campaign', true);
  perform pg_temp.dated(public.award_member_badge(v_zulu, w.member, ''),
                        interval '20 days');
  perform public.save_club_badge(v_club, v_zulu, 'Zulu relic',
    'Nobody gets this any more', 'shield', 'campaign', false);

  -- ------------------------------------------------------------- the gate
  perform pg_temp.be(w.helper);
  begin
    perform public.club_badge_awards_page(v_club);
    raise exception 'NOT_REACHED';
  exception
    when insufficient_privilege then
      raise notice 'PASS gate: a helper cannot read the awards';
    when others then raise exception 'wrong error for a helper: %', sqlerrm;
  end;
  begin
    perform public.club_badge_award_counts(v_club);
    raise exception 'NOT_REACHED';
  exception
    when insufficient_privilege then
      raise notice 'PASS gate: a helper cannot read the counts';
    when others then raise exception 'wrong error for a helper: %', sqlerrm;
  end;

  perform pg_temp.be(w.owner);

  -- ------------------------------------------------------------- unfiltered
  select count(*), max(total_count) into n, total
    from public.club_badge_awards_page(v_club);
  assert n = 5, 'expected five awards, got ' || n;
  assert total = 5, 'total_count should be five, got ' || total;
  raise notice 'PASS all: five awards and a total to match';

  -- ------------------------------------------------------------- searching
  select count(*) into n from public.club_badge_awards_page(v_club, null, 'Anna');
  assert n = 1, 'search by member name found ' || n;
  select count(*) into n from public.club_badge_awards_page(v_club, null, 'Beta');
  assert n = 1, 'search by badge name found ' || n;
  select count(*) into n from public.club_badge_awards_page(v_club, null, 'ogres');
  assert n = 1, 'search by note found ' || n;
  select count(*) into n from public.club_badge_awards_page(v_club, null, 'nobody at all');
  assert n = 0, 'a search matching nothing found ' || n;
  raise notice 'PASS search: member, badge and note all match';

  -- ------------------------------------------------------------- the states
  -- The split is on the badge, not the award: a retired badge stays on
  -- whoever already had it, and "who holds something we stopped giving out"
  -- is the question this tab answers.
  select count(*) into n from public.club_badge_awards_page(v_club, null, '', 'live');
  assert n = 4, 'live badges hold ' || n || ' awards, expected four';
  select count(*) into n from public.club_badge_awards_page(v_club, null, '', 'retired');
  assert n = 1, 'retired badges hold ' || n || ' awards, expected one';
  raise notice 'PASS state: live and retired split on the badge';

  -- ------------------------------------------------------------- one badge
  select count(*) into n from public.club_badge_awards_page(v_club, v_alpha);
  assert n = 3, 'Alpha is held by ' || n || ', expected three';
  select count(*) into n from public.club_badge_awards_page(v_club, v_alpha, 'Zoe');
  assert n = 1, 'Alpha plus a name found ' || n;
  raise notice 'PASS badge: one badge narrows, and narrows further';

  -- ------------------------------------------------------------- the counts
  j := public.club_badge_award_counts(v_club);
  assert (j->>'all')::int = 5 and (j->>'live')::int = 4 and (j->>'retired')::int = 1,
    'counts are wrong: ' || j::text;
  assert (j->>'all')::int = (j->>'live')::int + (j->>'retired')::int,
    'the tabs do not add up: ' || j::text;
  j := public.club_badge_award_counts(v_club, null, 'Anna');
  assert (j->>'all')::int = 1, 'the search did not narrow the counts: ' || j::text;
  j := public.club_badge_award_counts(v_club, v_zulu);
  assert (j->>'live')::int = 0 and (j->>'retired')::int = 1,
    'the badge did not narrow the counts: ' || j::text;
  raise notice 'PASS counts: they narrow with the search and the badge';

  -- ------------------------------------------------------------- paging
  select count(*), max(total_count) into n, total
    from public.club_badge_awards_page(v_club, null, '', '', 'recent', 2, 0);
  assert n = 2, 'a page of two returned ' || n;
  assert total = 5, 'the total is the count before paging, got ' || total;
  select count(*) into n
    from public.club_badge_awards_page(v_club, null, '', '', 'recent', 2, 99);
  assert n = 0, 'paging past the end returned ' || n;
  raise notice 'PASS paging: the total survives the page, the end is empty';

  -- ------------------------------------------------------------- sorting
  select array_agg(member_name order by ord) into names from (
    select member_name, row_number() over () as ord
      from public.club_badge_awards_page(v_club, v_alpha, '', '', 'member')) s;
  assert names = array['Anna Able', 'Member Seven', 'Zoe Zephyr'],
    'by member came out as ' || names::text;

  -- The note is empty on both ends, so assert on the badge and the person.
  select array_agg(label || ' / ' || member_name order by ord) into names from (
    select label, member_name, row_number() over () as ord
      from public.club_badge_awards_page(v_club, null, '', '', 'oldest', 1, 0)) s;
  assert names = array['Zulu relic / Member Seven'],
    'oldest first came out as ' || names::text;

  select array_agg(label || ' / ' || member_name order by ord) into names from (
    select label, member_name, row_number() over () as ord
      from public.club_badge_awards_page(v_club, null, '', '', 'recent', 1, 0)) s;
  assert names = array['Alpha award / Zoe Zephyr'],
    'newest first came out as ' || names::text;
  raise notice 'PASS sort: by member, oldest first and newest first all hold';

  raise notice 'ALL PASS · 0125 badge filters';
end $$;

rollback;
