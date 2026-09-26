-- 0132 · the event board's sort key lives in SQL now.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage7-seed.sql

insert into public.club_events (club_id, legacy_id, title, start_date, status)
  select id, 'board-paging-test', 'Paging Test', current_date + 30, 'published' from c;

create temp table ev as
  select id from public.club_events where legacy_id = 'board-paging-test';
grant select on ev to authenticated;

-- Two threads, the older one written first. Timestamps are set by hand because
-- `now()` is fixed inside a transaction and every row would share a second.
insert into public.club_event_board_posts
  (event_id, author_profile_id, title, content, created_at, last_activity_at)
  select id, 'd0000000-0000-0000-0000-000000000003'::uuid, 'Older thread', 'words',
         now() - interval '3 days', now() - interval '3 days' from ev
  union all
  select id, 'd0000000-0000-0000-0000-000000000003'::uuid, 'Newer thread', 'words',
         now() - interval '1 day', now() - interval '1 day' from ev;

create temp table posts as
  select (select id from public.club_event_board_posts where title = 'Older thread') as older,
         (select id from public.club_event_board_posts where title = 'Newer thread') as newer;
grant select on posts to authenticated;

create or replace function pg_temp.order_of(p_event bigint) returns text[]
language sql security definer as $fn$
  select array_agg(title order by last_activity_at desc)
    from public.club_event_board_posts
   where event_id = p_event and removed_at is null $fn$;

create or replace function pg_temp.activity(p_post bigint) returns timestamptz
language sql security definer as $fn$
  select last_activity_at from public.club_event_board_posts where id = p_post $fn$;

do $$
declare v_event bigint; p record; names text[]; before timestamptz;
begin
  select id into v_event from ev;
  select * into p from posts;

  -- ------------------------------------------------------------- the backfill
  names := pg_temp.order_of(v_event);
  assert names = array['Newer thread', 'Older thread'],
    'the starting order is wrong: ' || names::text;
  raise notice 'PASS backfill: a thread with no replies sorts by when it was written';

  -- ------------------------------------------------------- a reply moves it up
  before := pg_temp.activity(p.older);
  insert into public.club_event_board_replies
    (post_id, author_profile_id, content, created_at)
  values (p.older, 'd0000000-0000-0000-0000-000000000001', 'answering', now());

  assert pg_temp.activity(p.older) > before,
    'replying did not move the thread up the board';
  names := pg_temp.order_of(v_event);
  assert names = array['Older thread', 'Newer thread'],
    'the order did not change after a reply: ' || names::text;
  raise notice 'PASS touch: a reply moves its thread to the top';

  -- ------------------------------------------ and an older reply never moves it
  before := pg_temp.activity(p.older);
  insert into public.club_event_board_replies
    (post_id, author_profile_id, content, created_at)
  values (p.older, 'd0000000-0000-0000-0000-000000000001', 'older words',
          now() - interval '10 days');
  assert pg_temp.activity(p.older) = before,
    'a reply dated in the past dragged the thread back down';
  raise notice 'PASS greatest: a backdated reply never moves a thread down';

  -- --------------------------------------------------- nobody may write it
  -- The column is not in any grant, so a member cannot move their own thread
  -- up the board without replying to it.
  perform set_config('request.jwt.claims',
    json_build_object('sub', 'd0000000-0000-0000-0000-000000000003',
                      'role', 'authenticated')::text, true);
  begin
    set local role authenticated;
    update public.club_event_board_posts
       set last_activity_at = now() + interval '100 days' where id = p.newer;
    reset role;
    raise exception 'NOT_REACHED';
  exception
    when insufficient_privilege then
      reset role;
      raise notice 'PASS grant: a member cannot write the sort key by hand';
    when others then
      reset role;
      if sqlerrm = 'NOT_REACHED' then
        raise exception 'a member wrote last_activity_at directly';
      end if;
      raise notice 'PASS grant: a member cannot write the sort key by hand';
  end;

  raise notice 'ALL PASS · 0132 event board paging';
end $$;

rollback;
