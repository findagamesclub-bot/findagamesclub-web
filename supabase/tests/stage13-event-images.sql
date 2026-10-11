-- 0173 · an event carries up to five pictures, and the first one is the hero.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

-- Read as postgres, so a fixture can be counted whatever the policy is doing
-- to the session under test.
create or replace function pg_temp.hero(p_event bigint)
returns public.club_events language sql security definer as $fn$
  select * from public.club_events where id = p_event $fn$;

create or replace function pg_temp.shots(p_event bigint)
returns bigint language sql security definer as $fn$
  select count(*) from public.club_event_images where event_id = p_event $fn$;

insert into public.club_events (club_id, legacy_id, title, start_date, status, logo_src, logo_alt)
  select id, '2026-07-07-picture-day', 'Picture Day', current_date + 30, 'published',
         'https://example.test/old.jpg', 'The old one' from c;
insert into public.club_events (club_id, legacy_id, title, start_date, status)
  select id, '2026-07-08-secret-day', 'Secret Day', current_date + 31, 'draft' from c;

do $$
declare
  w record; v_event bigint; v_draft bigint; v_row public.club_events;
  v_first bigint; v_seen bigint;
begin
  select * into w from who;
  select id into v_event from public.club_events where legacy_id = '2026-07-07-picture-day';
  select id into v_draft from public.club_events where legacy_id = '2026-07-08-secret-day';

  -- 0 · The backfill ran before this event existed, so seed its first picture
  --     the way the migration would have.
  insert into public.club_event_images (event_id, src, alt, "position")
    values (v_event, 'https://example.test/old.jpg', 'The old one', 0)
    returning id into v_first;

  -- 1 · Five fit. The sixth does not, and says so.
  insert into public.club_event_images (event_id, src, alt, "position")
  values (v_event, 'https://example.test/b.jpg', 'Two', 1),
         (v_event, 'https://example.test/c.jpg', 'Three', 2),
         (v_event, 'https://example.test/d.jpg', 'Four', 3),
         (v_event, 'https://example.test/e.jpg', 'Five', 4);

  begin
    insert into public.club_event_images (event_id, src, alt, "position")
      values (v_event, 'https://example.test/f.jpg', 'Six', 5);
    raise exception 'FAIL 1: a sixth picture was accepted';
  exception when raise_exception then
    if sqlerrm <> 'TOO_MANY_EVENT_IMAGES' then raise; end if;
  end;

  if pg_temp.shots(v_event) <> 5 then
    raise exception 'FAIL 1b: the event holds % pictures, not 5', pg_temp.shots(v_event);
  end if;

  -- 2 · The first picture is mirrored onto the event's own columns, which is
  --     what every existing reader goes through.
  v_row := pg_temp.hero(v_event);
  if v_row.logo_src <> 'https://example.test/old.jpg' or v_row.logo_alt <> 'The old one' then
    raise exception 'FAIL 2: the hero reads % / %', v_row.logo_src, v_row.logo_alt;
  end if;

  -- 3 · Reordering changes the hero without anybody writing to club_events.
  update public.club_event_images set "position" = 9 where id = v_first;
  v_row := pg_temp.hero(v_event);
  if v_row.logo_src <> 'https://example.test/b.jpg' or v_row.logo_alt <> 'Two' then
    raise exception 'FAIL 3: after reordering the hero reads % / %',
      v_row.logo_src, v_row.logo_alt;
  end if;

  -- 4 · Taking the last picture off empties the columns, so the event goes
  --     back to borrowing the club's photo rather than keeping a dead URL.
  delete from public.club_event_images where event_id = v_event;
  v_row := pg_temp.hero(v_event);
  if coalesce(v_row.logo_src, '') <> '' or v_row.logo_path is not null then
    raise exception 'FAIL 4: the hero still reads % / % after every picture went',
      v_row.logo_src, v_row.logo_path;
  end if;

  -- 5 · A picture on a published event is public. One on a draft is the
  --     club's, the same as the draft itself.
  insert into public.club_event_images (event_id, src, alt, "position")
    values (v_event, 'https://example.test/live.jpg', 'Live', 0);
  insert into public.club_event_images (event_id, src, alt, "position")
    values (v_draft, 'https://example.test/draft.jpg', 'Draft', 0);

  set local role anon;
  select count(*) into v_seen from public.club_event_images where event_id = v_event;
  reset role;
  if v_seen <> 1 then
    raise exception 'FAIL 5: anon read % pictures on a published event, not 1', v_seen;
  end if;

  set local role anon;
  select count(*) into v_seen from public.club_event_images where event_id = v_draft;
  reset role;
  if v_seen <> 0 then
    raise exception 'FAIL 6: anon read % pictures on a DRAFT event', v_seen;
  end if;

  -- 7 · The club's own team reads its draft.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_seen from public.club_event_images where event_id = v_draft;
  reset role;
  if v_seen <> 1 then
    raise exception 'FAIL 7: the owner read % pictures on their own draft, not 1', v_seen;
  end if;

  -- 8 · A stranger cannot add one, and the policy is what stops them rather
  --     than the absence of a grant.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.stranger, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into public.club_event_images (event_id, src, alt, "position")
      values (v_event, 'https://example.test/nope.jpg', 'Nope', 3);
    reset role;
    raise exception 'FAIL 8: a stranger added a picture to somebody else''s event';
  exception when insufficient_privilege then reset role;
  end;
  perform set_config('request.jwt.claims', null, true);

  -- 9 · And cannot take one off either.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.stranger, 'role', 'authenticated')::text, true);
  set local role authenticated;
  delete from public.club_event_images where event_id = v_event;
  reset role;
  perform set_config('request.jwt.claims', null, true);
  if pg_temp.shots(v_event) <> 1 then
    raise exception 'FAIL 9: a stranger deleted a picture (% left)',
      pg_temp.shots(v_event);
  end if;

  -- 10 · The saver replaces the whole list in one go, and the cap applies to
  --      what it is handed rather than only to one insert at a time.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.save_event_images(v_event, jsonb_build_array(
    jsonb_build_object('src', 'https://example.test/1.jpg', 'alt', 'One'),
    jsonb_build_object('src', 'https://example.test/2.jpg', 'alt', 'Two'),
    -- Neither a src nor a path, so it is dropped rather than stored as a row
    -- nothing can render.
    jsonb_build_object('src', '', 'alt', 'Nothing')));
  reset role;
  perform set_config('request.jwt.claims', null, true);

  if pg_temp.shots(v_event) <> 2 then
    raise exception 'FAIL 10: the saver left % pictures, not 2', pg_temp.shots(v_event);
  end if;
  v_row := pg_temp.hero(v_event);
  if v_row.logo_src <> 'https://example.test/1.jpg' then
    raise exception 'FAIL 10b: the hero reads % after the saver ran', v_row.logo_src;
  end if;

  -- 11 · Six handed to the saver is refused outright, before anything is
  --      deleted, so a club that pastes too many keeps what it had.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.save_event_images(v_event, jsonb_build_array(
      jsonb_build_object('src', 'a'), jsonb_build_object('src', 'b'),
      jsonb_build_object('src', 'c'), jsonb_build_object('src', 'd'),
      jsonb_build_object('src', 'e'), jsonb_build_object('src', 'f')));
    reset role;
    raise exception 'FAIL 11: the saver accepted six pictures';
  exception when raise_exception then
    reset role;
    if sqlerrm <> 'TOO_MANY_EVENT_IMAGES' then raise; end if;
  end;
  perform set_config('request.jwt.claims', null, true);

  if pg_temp.shots(v_event) <> 2 then
    raise exception 'FAIL 11b: a refused save left % pictures, not the 2 it had',
      pg_temp.shots(v_event);
  end if;

  -- 12 · A stranger cannot call it, and the guard is what stops them.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.stranger, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.save_event_images(v_event, jsonb_build_array(
      jsonb_build_object('src', 'https://example.test/theirs.jpg')));
    reset role;
    raise exception 'FAIL 12: a stranger saved pictures onto somebody else''s event';
  exception when insufficient_privilege then reset role;
  end;
  perform set_config('request.jwt.claims', null, true);

  raise notice 'stage13 event images: all pass';
end $$;

rollback;
