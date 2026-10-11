-- 0177 · a member code links a typed name to an account across clubs.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

-- Fixtures are read as postgres, because the thing under test is what an
-- ordinary session may do and a select policy would otherwise hide the row
-- the test is measuring. Three suites have paid for this already.
create or replace function pg_temp.code_of(p_profile uuid)
returns text language sql security definer as $fn$
  select code::text from public.member_codes where profile_id = p_profile $fn$;

create or replace function pg_temp.standing_owner(p_id bigint)
returns uuid language sql security definer as $fn$
  select profile_id from public.club_competition_standings where id = p_id $fn$;

create or replace function pg_temp.result_owner(p_id bigint)
returns uuid language sql security definer as $fn$
  select member_profile_id from public.club_event_results where id = p_id $fn$;

create or replace function pg_temp.match_one(p_id bigint)
returns uuid language sql security definer as $fn$
  select player_one_id from public.club_event_pairing_matches where id = p_id $fn$;

create or replace function pg_temp.notices(p_kind text)
returns bigint language sql security definer as $fn$
  select count(*) from public.notifications where kind = p_kind $fn$;

-- A visitor from somewhere else: a real account, no membership here.
insert into auth.users (id, email)
  values ('e0000000-0000-0000-0000-000000000009', 'visitor@example.com');
update public.profiles set full_name = 'Vic Visitor'
 where id = 'e0000000-0000-0000-0000-000000000009';

insert into public.club_events (club_id, legacy_id, title, start_date)
  select id, '2026-05-05-code-open', 'Code Open', current_date - 7 from c;

do $$
declare
  w record; v_club bigint; v_event bigint; v_comp bigint;
  v_standing bigint; v_result bigint; v_round bigint; v_match bigint;
  v_visitor uuid := 'e0000000-0000-0000-0000-000000000009';
  v_code text; v_again text; v_hit integer; v_name text;
begin
  select * into w from who;
  select id into v_club from c;
  select id into v_event from public.club_events where legacy_id = '2026-05-05-code-open';

  -- 1 · A code is made on the first look and is stable on the second.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_visitor, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_code := public.my_member_code();
  v_again := public.my_member_code();
  reset role;

  if v_code is null or length(v_code) <> 8 then
    raise exception 'FAIL 1: a member code reads %', coalesce(v_code, '<null>');
  end if;
  if v_code <> v_again then
    raise exception 'FAIL 2: looking twice made two codes, % and %', v_code, v_again;
  end if;
  -- No 0, O, 1, I or L, because those are what somebody mistypes off a phone.
  if v_code ~ '[01OIL]' then
    raise exception 'FAIL 3: the alphabet let an ambiguous character through (%)', v_code;
  end if;

  -- 2 · AND NOBODY ELSE CAN READ IT. This is the whole opt-in: a code on
  --     `profiles` would be readable by every signed-in account on the site,
  --     because that table's select policy is `using (true)`.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if exists (select 1 from public.member_codes where profile_id = v_visitor) then
    reset role;
    raise exception 'FAIL 4: somebody else could read a member code straight off the table';
  end if;
  reset role;

  -- 3 · The club can ask about one exact code and gets the name back.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select m.full_name into v_name from public.member_by_code(v_club, v_code) m;
  reset role;
  if v_name is distinct from 'Vic Visitor' then
    raise exception 'FAIL 5: a code lookup answered %', coalesce(v_name, '<nothing>');
  end if;

  -- 4 · Hyphens and case are display, not data.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if not exists (select 1 from public.member_by_code(v_club,
        lower(substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4)))) then
    reset role;
    raise exception 'FAIL 6: the same code typed with a hyphen did not match';
  end if;
  -- And a wrong one is nothing rather than an error, so the screen can word it.
  if exists (select 1 from public.member_by_code(v_club, 'ZZZZZZZZ')) then
    reset role;
    raise exception 'FAIL 7: an unknown code found somebody';
  end if;
  reset role;

  -- 5 · A stranger cannot walk the table one code at a time.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.stranger, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.member_by_code(v_club, v_code);
    reset role;
    raise exception 'FAIL 8: a stranger looked a member code up';
  exception when insufficient_privilege then reset role;
  end;
  perform set_config('request.jwt.claims', null, true);

  -- ---------------------------------------------------------------- linking

  insert into public.club_competitions (club_id, title, season, type, status)
    values (v_club, 'Code League', '2026', 'league', 'active') returning id into v_comp;
  insert into public.club_competition_standings
    (competition_id, member_name, rank, played, wins, draws, losses, points)
    values (v_comp, 'Vic Visitor', 1, 5, 4, 0, 1, 12) returning id into v_standing;

  -- 6 · 0032's rule, unchanged: without a code a visitor is refused.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.link_standing_member(v_standing, v_visitor);
    reset role;
    raise exception 'FAIL 9: a visitor was linked with no code and no membership';
  exception when raise_exception then
    reset role;
    if sqlerrm <> 'MEMBER_CODE_NEEDED' then raise; end if;
  end;

  -- 7 · With the code, the same link goes through. This is the item.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.link_standing_member(v_standing, v_visitor, v_code);
  reset role;
  if pg_temp.standing_owner(v_standing) is distinct from v_visitor then
    raise exception 'FAIL 10: a code did not link the standing';
  end if;

  -- 8 · And a wrong code does not. The server checks rather than trusting that
  --     the browser resolved it, or a club could post any id it liked.
  insert into public.club_competition_standings
    (competition_id, member_name, rank, played, wins, draws, losses, points)
    values (v_comp, 'Vic Visitor', 2, 5, 3, 0, 2, 9) returning id into v_standing;
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.link_standing_member(v_standing, v_visitor, 'ZZZZZZZZ');
    reset role;
    raise exception 'FAIL 11: a wrong code linked somebody anyway';
  exception when raise_exception then
    reset role;
    if sqlerrm <> 'MEMBER_CODE_NEEDED' then raise; end if;
  end;

  -- 9 · The club's own approved member still needs no code at all.
  insert into public.club_competition_standings
    (competition_id, member_name, rank, played, wins, draws, losses, points)
    values (v_comp, 'Member Eight', 3, 5, 2, 0, 3, 6) returning id into v_standing;
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.link_standing_member(v_standing, w.member);
  reset role;
  if pg_temp.standing_owner(v_standing) is distinct from w.member then
    raise exception 'FAIL 12: a club member needed a code';
  end if;

  -- 10 · Rotating leaves what was already linked alone, which is what makes a
  --      code safe to read out across a hall.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_visitor, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_again := public.rotate_member_code();
  reset role;
  if v_again = v_code then
    raise exception 'FAIL 13: rotating returned the same code';
  end if;
  if pg_temp.code_of(v_visitor) <> v_again then
    raise exception 'FAIL 14: the new code was not the one stored';
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if exists (select 1 from public.member_by_code(v_club, v_code)) then
    reset role;
    raise exception 'FAIL 15: the retired code still found somebody';
  end if;
  reset role;
  v_code := v_again;

  -- --------------------------------------------------------- that is me

  insert into public.club_event_results (event_id, member_name, rank, placement)
    values (v_event, 'Vic Visitor', 1, '1st') returning id into v_result;
  insert into public.club_event_pairings (event_id, round, published)
    values (v_event, 1, true) returning id into v_round;
  insert into public.club_event_pairing_matches
    (pairing_id, event_id, table_label, player_one, player_two,
     score_one, score_two, "position")
    values (v_round, v_event, '1', 'Vic Visitor', 'Member Eight', 90, 70, 0)
    returning id into v_match;

  -- 11 · Being on the sheet is not enough on its own. Without a ticket there
  --      is nothing saying they were ever there.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_visitor, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_hit := public.claimable_event_names(v_event);
  reset role;
  if v_hit <> 0 then
    raise exception 'FAIL 16: % rows were claimable with no ticket', v_hit;
  end if;

  insert into public.club_event_bookings
    (club_id, event_id, profile_id, full_name, email, reference, status)
    values (v_club, v_event, v_visitor, 'Vic Visitor', 'visitor@example.com',
            'REF-CODE-1', 'reserved');

  -- 12 · With one, all three rows are theirs: the placing and both sides of
  --      the draw they are named on.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_visitor, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_hit := public.claimable_event_names(v_event);
  reset role;
  if v_hit <> 2 then
    raise exception 'FAIL 17: a ticket holder was offered % rows, not 2', v_hit;
  end if;

  -- 13 · Somebody else's name is not claimable, whoever holds a ticket.
  insert into public.club_event_bookings
    (club_id, event_id, profile_id, full_name, email, reference, status)
    values (v_club, v_event, w.stranger, 'Stranger Eight', 'stranger8@example.com',
            'REF-CODE-2', 'reserved');
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.stranger, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_hit := public.claimable_event_names(v_event);
  reset role;
  if v_hit <> 0 then
    raise exception 'FAIL 18: a ticket holder could claim % rows of somebody else''s', v_hit;
  end if;

  -- 14 · One press takes all of them, and the club is told.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_visitor, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_hit := public.claim_event_names(v_event);
  reset role;
  perform set_config('request.jwt.claims', null, true);

  if v_hit <> 2 then
    raise exception 'FAIL 19: the claim attached % rows, not 2', v_hit;
  end if;
  if pg_temp.result_owner(v_result) is distinct from v_visitor then
    raise exception 'FAIL 20: the placing was not claimed';
  end if;
  if pg_temp.match_one(v_match) is distinct from v_visitor then
    raise exception 'FAIL 21: the table of the draw was not claimed';
  end if;
  if pg_temp.notices('event-name-claimed') = 0 then
    raise exception 'FAIL 22: nobody at the club was told about a claim';
  end if;

  -- 15 · And there is nothing left to claim, so the button goes.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_visitor, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_hit := public.claimable_event_names(v_event);
  reset role;
  perform set_config('request.jwt.claims', null, true);
  if v_hit <> 0 then
    raise exception 'FAIL 23: % rows were still offered after claiming them', v_hit;
  end if;


  -- 16 · The placing dialog is held to the same rule as the matching screen.
  --      It was not: `save_event_placing` took any profile id at all, so the
  --      consent 0032 asks for lived on one of two paths to the same column,
  --      and the one that hands out a podium badge was the open one.
  insert into auth.users (id, email)
    values ('e0000000-0000-0000-0000-000000000010', 'outsider@example.com');
  update public.profiles set full_name = 'Olive Outsider'
   where id = 'e0000000-0000-0000-0000-000000000010';

  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.save_event_placing(v_event, null, 4, 'Olive Outsider',
      'e0000000-0000-0000-0000-000000000010'::uuid, '', '');
    reset role;
    raise exception 'FAIL 24: a placing linked a stranger with no code';
  exception when raise_exception then
    reset role;
    if sqlerrm <> 'MEMBER_CODE_NEEDED' then raise; end if;
  end;

  -- 17 · And goes through once they hand their code over.
  perform set_config('request.jwt.claims',
    json_build_object('sub', 'e0000000-0000-0000-0000-000000000010'::uuid,
                      'role', 'authenticated')::text, true);
  set local role authenticated;
  v_code := public.my_member_code();
  reset role;

  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_result := public.save_event_placing(v_event, null, 4, 'Olive Outsider',
    'e0000000-0000-0000-0000-000000000010'::uuid, '', '', '', v_code);
  reset role;
  perform set_config('request.jwt.claims', null, true);

  if pg_temp.result_owner(v_result) is distinct
     from 'e0000000-0000-0000-0000-000000000010'::uuid then
    raise exception 'FAIL 25: a code did not link the placing';
  end if;

  -- 18 · A placing with no account at all is untouched by any of this. Most
  --      of a results sheet is still names nobody has claimed.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_result := public.save_event_placing(v_event, null, 5, 'Nobody At All',
    null, '', '');
  reset role;
  perform set_config('request.jwt.claims', null, true);
  if pg_temp.result_owner(v_result) is not null then
    raise exception 'FAIL 26: an unlinked placing came back linked';
  end if;

  raise notice 'stage13 member code: all pass';
end $$;

rollback;
