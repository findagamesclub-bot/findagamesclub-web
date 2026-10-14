-- 0181 · a round result is a result, wherever it was played.
--
-- The client, on item 16b: "when entering a score/result for an event or
-- competition/league, you should get the same options as the regular table
-- booking game e.g if Warhammer 40k you get all the options for the players
-- armies and the match context. You should be able to click an event round
-- game and see then those details of that match. NOT FIXED,
-- COMPETITION/LEAGUE STILL MISSING FULL RESULTS and MATCH CONTEXT when
-- entering scores, and full match context is not being shown on round results
-- for events or leagues/competitions."
--
-- And 16c: "the club player name does not autofill based on the club member
-- list."
--
-- Three different things were recorded in three different depths:
--
--   a table booking   army, scores, MVP units, turn order, battle role, AND
--                     mission, deployment and terrain (0044)
--   a table of a draw  faction, detachment, disposition, and a list (0163)
--   a league game      four boxes of free text, and nothing else (0024)
--
-- `put_result_army` has accepted the full per-side shape since 0135, so the
-- event half was a screen sending three fields out of nine rather than a
-- missing capability. The league half is genuinely new: 0024 wrote a round as
-- prose with scores under it, which is what legacy does, and there was no row
-- an army could hang off.
--
-- WHERE THE SETUP LIVES. On the game's own row, mirrored onto
-- `game_result_armies` by trigger. That is 0044 and 0141's shape exactly: a
-- booking keeps `result_mission` and the army rows carry a copy for the
-- rollups. Keeping it only on the army rows would mean a club that typed the
-- mission and no army had nowhere to put it, because `put_result_army`
-- deletes a side with nothing on it.
--
-- WHAT THIS CHANGES ABOUT WIN RATES. CLAUDE.md has said since stage 9 that
-- "competition matches cannot feed a win rate", because the names were free
-- text with no accounts behind them. That is the thing the client is asking
-- to change. A league game now carries both players' accounts and an outcome,
-- so it reaches both profiles and the Meta Tracker. Only where the two scores
-- are numbers: a club that types "W" or "3-1" leaves the outcome empty, which
-- is the same rule a podium already follows.

-- --------------------------------------------- how the game was set up
--
-- Three columns per game, the same three names `club_bookings` has carried
-- since 0044 so a reader moving between them is reading the same words.

alter table public.club_event_pairing_matches
  add column if not exists result_mission    text not null default '',
  add column if not exists result_deployment text not null default '',
  add column if not exists result_terrain    text not null default '';

alter table public.club_competition_matches
  add column if not exists result_mission    text not null default '',
  add column if not exists result_deployment text not null default '',
  add column if not exists result_terrain    text not null default '',
  add column if not exists player_one_id uuid references public.profiles (id)
    on delete set null,
  add column if not exists player_two_id uuid references public.profiles (id)
    on delete set null;

create index if not exists club_competition_matches_one_idx
  on public.club_competition_matches (player_one_id) where player_one_id is not null;
create index if not exists club_competition_matches_two_idx
  on public.club_competition_matches (player_two_id) where player_two_id is not null;

-- 0024 handed `authenticated` the whole table and let the policy do the rest,
-- which was right while every column was free text somebody typed. It is not
-- right for a profile id: attaching a result to an account is 0177's question
-- and is answered by `may_link_profile`, never by a column grant. Everything
-- about a match now moves through `save_competition_round` below.
revoke insert, update, delete on public.club_competition_matches
  from authenticated, anon;

-- --------------------------------------------- a league game is a source
--
-- `event_podium` and `competition` are a finish and a season's standing; a
-- `competition_match` is one game, which is why it is its own source rather
-- than more rows under `competition`.

alter table public.game_result_armies
  drop constraint if exists game_result_armies_source;
alter table public.game_result_armies
  add constraint game_result_armies_source check (source_type in
    ('booking', 'competition', 'competition_match', 'event_pairing', 'event_podium'));

-- 0172 opened a published round's armies to anybody, because the tables they
-- sit on are public. A league table and its rounds have been public since
-- 0024, so its games are read the same way: `competition_match` joins the two
-- source types that were already open.
--
-- Both policies are restated from 0172 with that one word added rather than
-- written fresh. The signed-in one carries `profile_id = auth.uid()`, which is
-- what lets somebody read their own army on a round nobody has published, and
-- rewriting it from memory is how that clause goes missing.

drop policy if exists game_result_armies_public_anon on public.game_result_armies;

create policy game_result_armies_public_anon on public.game_result_armies
  for select to anon
  using (
    source_type in ('event_podium', 'competition', 'competition_match')
    or (source_type = 'event_pairing'
        and public.pairing_army_is_public(source_id)));

drop policy if exists game_result_armies_select on public.game_result_armies;

create policy game_result_armies_select on public.game_result_armies
  for select to authenticated
  using (
    source_type in ('event_podium', 'competition', 'competition_match')
    or profile_id = (select auth.uid())
    or (source_type = 'event_pairing'
        and public.pairing_army_is_public(source_id))
    or (club_id is not null
        and (public.is_club_member(club_id) or public.can_manage_club(club_id)))
  );

-- --------------------------------------------- the six deployments, once
--
-- 0044 normalises and checks this list inline inside `record_booking_result`,
-- which was the only writer that needed it. Two more need it now, and three
-- copies of one closed list is how a seventh deployment ends up accepted in
-- one place and refused in another. The constraint on each column is what
-- actually holds; the function is so the refusal names the field rather than
-- arriving as a raw 23514.
--
-- `record_booking_result` still carries its own copy. Fold it into this the
-- next time that function is touched; it is not rewritten here because
-- retyping two hundred lines to save three is how a working writer breaks.

create or replace function public.normalise_deployment(p_value text)
returns text
language plpgsql immutable
as $$
declare
  v text := replace(replace(lower(btrim(coalesce(p_value, ''))), ' ', '-'), '_', '-');
begin
  if v <> '' and v not in
     ('search-and-destroy', 'dawn-of-war', 'hammer-and-anvil',
      'sweeping-engagement', 'tipping-point', 'crucible-of-battle') then
    raise exception 'RESULT_BAD_DEPLOYMENT';
  end if;
  return v;
end;
$$;

revoke all on function public.normalise_deployment(text) from public, anon;
grant execute on function public.normalise_deployment(text) to authenticated;

alter table public.club_event_pairing_matches
  drop constraint if exists club_event_pairing_matches_deployment;
alter table public.club_event_pairing_matches
  add constraint club_event_pairing_matches_deployment
  check (result_deployment in ('', 'search-and-destroy', 'dawn-of-war',
         'hammer-and-anvil', 'sweeping-engagement', 'tipping-point',
         'crucible-of-battle'));

alter table public.club_competition_matches
  drop constraint if exists club_competition_matches_deployment;
alter table public.club_competition_matches
  add constraint club_competition_matches_deployment
  check (result_deployment in ('', 'search-and-destroy', 'dawn-of-war',
         'hammer-and-anvil', 'sweeping-engagement', 'tipping-point',
         'crucible-of-battle'));

-- --------------------------------------------- saving a round and its games
--
-- One function rather than the delete-and-reinsert `replaceMatches` did, and
-- that is not tidying. A game now owns army rows, and 0164's rule is that a
-- polymorphic id needs a delete path per source; with one, a round saved to
-- fix a typo in its title would have taken every army in it. So a game that
-- stays keeps its id.
--
-- It is also one statement, which is the lesson `save_event_team` paid for in
-- 0168: a service doing the delete and the insert in two round trips can take
-- a round's games away and then fail to put them back.
--
-- An account is attached through `may_link_profile` (0177), never from the
-- caller's say-so: the club's own approved member, somebody holding a ticket
-- for one of its events, or somebody who handed over their member code.

create or replace function public.save_competition_round(
  p_competition bigint,
  p_round       bigint,
  p_title       text,
  p_summary     text,
  p_posted_on   date,
  p_games       jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club    bigint;
  v_round   bigint := p_round;
  v_game    jsonb;
  v_id      bigint;
  v_one     uuid;
  v_two     uuid;
  v_keep    bigint[] := '{}';
  v_index   integer := 0;
begin
  select c.club_id into v_club
    from public.club_competitions c where c.id = p_competition;
  if v_club is null then
    raise exception 'COMPETITION_NOT_FOUND' using errcode = 'check_violation';
  end if;

  if not (public.club_can(v_club, 'results.manage') or public.can_manage_club(v_club)
          or public.is_admin()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  if v_round is null then
    insert into public.club_competition_updates
      (competition_id, posted_on, title, summary, position)
    values (p_competition, p_posted_on, left(coalesce(p_title, ''), 160),
            left(coalesce(p_summary, ''), 2000),
            coalesce((select max(position) + 1 from public.club_competition_updates
                       where competition_id = p_competition), 0))
    returning id into v_round;
  else
    update public.club_competition_updates
       set posted_on = p_posted_on,
           title     = left(coalesce(p_title, ''), 160),
           summary   = left(coalesce(p_summary, ''), 2000)
     where id = v_round and competition_id = p_competition;
    if not found then
      raise exception 'ROUND_NOT_FOUND' using errcode = 'check_violation';
    end if;
  end if;

  for v_game in select * from jsonb_array_elements(coalesce(p_games, '[]'::jsonb))
  loop
    v_one := nullif(btrim(coalesce(v_game ->> 'playerOneId', '')), '')::uuid;
    v_two := nullif(btrim(coalesce(v_game ->> 'playerTwoId', '')), '')::uuid;

    -- A name the club typed is theirs to type. An ACCOUNT behind it is the
    -- other person's to agree to, which is what 0177 settled.
    if v_one is not null and not public.may_link_profile(v_club, v_one, '') then
      raise exception 'RESULT_LINK_NOT_ALLOWED: %', coalesce(v_game ->> 'playerOne', '')
        using errcode = 'check_violation';
    end if;
    if v_two is not null and not public.may_link_profile(v_club, v_two, '') then
      raise exception 'RESULT_LINK_NOT_ALLOWED: %', coalesce(v_game ->> 'playerTwo', '')
        using errcode = 'check_violation';
    end if;

    v_id := nullif(btrim(coalesce(v_game ->> 'id', '')), '')::bigint;

    if v_id is null then
      insert into public.club_competition_matches
        (update_id, player_one, player_one_score, player_two, player_two_score,
         player_one_id, player_two_id, position)
      values (v_round,
              left(coalesce(v_game ->> 'playerOne', ''), 200),
              left(coalesce(v_game ->> 'playerOneScore', ''), 40),
              left(coalesce(v_game ->> 'playerTwo', ''), 200),
              left(coalesce(v_game ->> 'playerTwoScore', ''), 40),
              v_one, v_two, v_index)
      returning id into v_id;
    else
      -- Pinned to this round, so an id from somebody else's competition
      -- cannot be steered into it by a hand-rolled call.
      update public.club_competition_matches
         set player_one       = left(coalesce(v_game ->> 'playerOne', ''), 200),
             player_one_score = left(coalesce(v_game ->> 'playerOneScore', ''), 40),
             player_two       = left(coalesce(v_game ->> 'playerTwo', ''), 200),
             player_two_score = left(coalesce(v_game ->> 'playerTwoScore', ''), 40),
             player_one_id    = v_one,
             player_two_id    = v_two,
             position         = v_index
       where id = v_id and update_id = v_round;
      if not found then
        raise exception 'GAME_NOT_FOUND' using errcode = 'check_violation';
      end if;
    end if;

    v_keep  := v_keep || v_id;
    v_index := v_index + 1;
  end loop;

  -- Whatever the club took off the round. Its army rows go with it, by the
  -- delete trigger below.
  delete from public.club_competition_matches
   where update_id = v_round and not (id = any (v_keep));

  return v_round;
end;
$$;

revoke all on function public.save_competition_round(
  bigint, bigint, text, text, date, jsonb) from public, anon;
grant execute on function public.save_competition_round(
  bigint, bigint, text, text, date, jsonb) to authenticated;

-- --------------------------------------------- the armies on a league game

create or replace function public.save_competition_match_result(
  p_match      bigint,
  p_armies     jsonb,
  p_mission    text default '',
  p_deployment text default '',
  p_terrain    text default ''
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match record;
  v_club  bigint;
  v_date  date;
  v_cat   record;
begin
  select m.*, c.club_id, coalesce(u.posted_on, c.start_date, public.london_today()) as played_on
    into v_match
    from public.club_competition_matches m
    join public.club_competition_updates u on u.id = m.update_id
    join public.club_competitions c on c.id = u.competition_id
   where m.id = p_match;

  if v_match is null then
    raise exception 'GAME_NOT_FOUND' using errcode = 'check_violation';
  end if;

  v_club := v_match.club_id;
  v_date := v_match.played_on;

  if not (public.club_can(v_club, 'results.manage') or public.can_manage_club(v_club)
          or public.is_admin()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  -- The setup is the game's, not a side's, so it lands on the match and the
  -- trigger copies it onto whichever army rows exist.
  update public.club_competition_matches
     set result_mission    = left(btrim(coalesce(p_mission, '')), 160),
         result_deployment = public.normalise_deployment(p_deployment),
         result_terrain    = left(btrim(coalesce(p_terrain, '')), 160)
   where id = p_match;

  select * into v_cat from public.club_catalogue_version(v_club);

  if p_armies ? 'one' then
    perform public.put_result_army('competition_match', p_match, 'one', v_club, v_date,
      v_match.player_one_id, v_match.player_one, p_armies -> 'one',
      v_cat.edition_id, v_cat.catalogue_version);
  end if;
  if p_armies ? 'two' then
    perform public.put_result_army('competition_match', p_match, 'two', v_club, v_date,
      v_match.player_two_id, v_match.player_two, p_armies -> 'two',
      v_cat.edition_id, v_cat.catalogue_version);
  end if;

  return true;
end;
$$;

revoke all on function public.save_competition_match_result(
  bigint, jsonb, text, text, text) from public, anon;
grant execute on function public.save_competition_match_result(
  bigint, jsonb, text, text, text) to authenticated;

-- --------------------------------------------- the draw's own setup
--
-- `save_pairing_armies` gained the three setup arguments. 0136's two-argument
-- signature is dropped first: a default parameter makes a NEW function in
-- Postgres rather than replacing one, which 0136, 0165, 0171 and 0178 have
-- each paid for.

drop function if exists public.save_pairing_armies(bigint, jsonb);

create or replace function public.save_pairing_armies(
  p_match      bigint,
  p_armies     jsonb,
  p_mission    text default '',
  p_deployment text default '',
  p_terrain    text default ''
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_match record; v_club bigint; v_date date; v_cat record;
begin
  select m.*, e.club_id, e.start_date into v_match
    from public.club_event_pairing_matches m
    join public.club_events e on e.id = m.event_id
   where m.id = p_match;
  if v_match is null then raise exception 'PAIRING_NOT_FOUND'; end if;

  v_club := v_match.club_id;
  v_date := v_match.start_date;
  if not public.can_manage_club(v_club) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  update public.club_event_pairing_matches
     set result_mission    = left(btrim(coalesce(p_mission, '')), 160),
         result_deployment = public.normalise_deployment(p_deployment),
         result_terrain    = left(btrim(coalesce(p_terrain, '')), 160)
   where id = p_match;

  select * into v_cat from public.club_catalogue_version(v_club);

  if p_armies ? 'one' then
    perform public.put_result_army('event_pairing', p_match, 'one', v_club, v_date,
      v_match.player_one_id, v_match.player_one, p_armies -> 'one',
      v_cat.edition_id, v_cat.catalogue_version);
  end if;
  if p_armies ? 'two' then
    perform public.put_result_army('event_pairing', p_match, 'two', v_club, v_date,
      v_match.player_two_id, v_match.player_two, p_armies -> 'two',
      v_cat.edition_id, v_cat.catalogue_version);
  end if;

  -- 0163's own last paragraph, kept. The table may already have been played,
  -- and without this an army typed after the scores never gains an outcome
  -- and the event's win rates stay empty. It is restated because this
  -- function is being replaced to take the setup, and the first draft was
  -- rebuilt from 0136's body rather than 0163's: the suite caught it with
  -- "a table scored 80 to 60 did not read as a win". BUILD A REPLACEMENT
  -- FROM THE LATEST DEFINITION, not the first one with that name.
  update public.game_result_armies a
     set outcome = public.booking_outcome(a.side, v_match.score_one, v_match.score_two)
   where a.source_type = 'event_pairing' and a.source_id = p_match;

  return true;
end;
$$;

revoke all on function public.save_pairing_armies(bigint, jsonb, text, text, text)
  from public, anon;
grant execute on function public.save_pairing_armies(bigint, jsonb, text, text, text)
  to authenticated;

-- --------------------------------------------- the setup reaches the rollups
--
-- Same shape as 0141 and 0163, and for the same reason: the scores and the
-- setup move from more than one screen, so a trigger on the row is what keeps
-- the army rows in step rather than every writer remembering to.

create or replace function public.pairing_setup_meta()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.game_result_armies a
     set mission    = coalesce(new.result_mission, ''),
         deployment = coalesce(new.result_deployment, ''),
         terrain    = coalesce(new.result_terrain, '')
   where a.source_type = 'event_pairing' and a.source_id = new.id;
  return null;
end $$;

drop trigger if exists pairing_setup_meta on public.club_event_pairing_matches;
create trigger pairing_setup_meta
  after insert or update of result_mission, result_deployment, result_terrain
  on public.club_event_pairing_matches
  for each row execute function public.pairing_setup_meta();

revoke all on function public.pairing_setup_meta() from public, anon;

/**
 * A league game's outcome and setup, onto its army rows.
 *
 * The scores are TEXT on this table and have been since 0024, because a club
 * types what it likes into them. So the outcome is only stamped where both
 * sides read as a number: "W" or "3-1" leaves it empty, which is the rule a
 * podium already follows and is why `meta_rows` will not count it.
 */
create or replace function public.competition_match_meta()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_one numeric;
  v_two numeric;
begin
  -- Cast inside the body, never in the DECLARE list: a declaration that
  -- raises is outside this block's own handler, so "W" would take the whole
  -- round save down rather than simply leaving the outcome empty. Found by
  -- the suite, which types "W" on purpose.
  begin
    v_one := nullif(btrim(coalesce(new.player_one_score, '')), '')::numeric;
    v_two := nullif(btrim(coalesce(new.player_two_score, '')), '')::numeric;
  exception when others then
    v_one := null; v_two := null;
  end;

  update public.game_result_armies a
     set outcome    = public.booking_outcome(a.side, v_one, v_two),
         mission    = coalesce(new.result_mission, ''),
         deployment = coalesce(new.result_deployment, ''),
         terrain    = coalesce(new.result_terrain, ''),
         profile_id = case when a.side = 'one' then new.player_one_id
                           else new.player_two_id end,
         player_name = case when a.side = 'one' then new.player_one
                            else new.player_two end
   where a.source_type = 'competition_match' and a.source_id = new.id;
  return null;
end $$;

drop trigger if exists competition_match_meta on public.club_competition_matches;
create trigger competition_match_meta
  after insert or update on public.club_competition_matches
  for each row execute function public.competition_match_meta();

revoke all on function public.competition_match_meta() from public, anon;

/**
 * And the other order: armies typed after the scores.
 *
 * 0163's own second trigger, for a league. An army row knows nothing about
 * the game it came from, so what the match already says is stamped on as it
 * lands rather than being left empty until somebody re-saves the round.
 */
create or replace function public.competition_army_meta()
returns trigger
language plpgsql security definer set search_path = public as $$
declare m record; v_one numeric; v_two numeric;
begin
  if new.source_type <> 'competition_match' then return new; end if;

  select * into m from public.club_competition_matches where id = new.source_id;
  if m is null then return new; end if;

  begin
    v_one := nullif(btrim(coalesce(m.player_one_score, '')), '')::numeric;
    v_two := nullif(btrim(coalesce(m.player_two_score, '')), '')::numeric;
  exception when others then
    v_one := null; v_two := null;
  end;

  new.outcome    := public.booking_outcome(new.side, v_one, v_two);
  new.mission    := coalesce(m.result_mission, '');
  new.deployment := coalesce(m.result_deployment, '');
  new.terrain    := coalesce(m.result_terrain, '');
  return new;
end $$;

drop trigger if exists competition_army_meta on public.game_result_armies;
create trigger competition_army_meta
  before insert or update on public.game_result_armies
  for each row execute function public.competition_army_meta();

revoke all on function public.competition_army_meta() from public, anon;

/**
 * A game that goes takes its armies with it.
 *
 * 0164's rule: `source_id` is polymorphic and carries no foreign key, so the
 * cleanup has to be a trigger and somebody has to remember to write it. The
 * one nobody writes is the one nobody notices, and here it would be a round
 * saved to fix a typo leaving phantom armies in the Meta Tracker for ever.
 */
create or replace function public.competition_match_armies_gone()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.game_result_armies
   where source_type = 'competition_match' and source_id = old.id;
  return old;
end $$;

drop trigger if exists competition_match_armies_gone on public.club_competition_matches;
create trigger competition_match_armies_gone
  after delete on public.club_competition_matches
  for each row execute function public.competition_match_armies_gone();

revoke all on function public.competition_match_armies_gone() from public, anon;

-- --------------------------------------------- reading it back
--
-- Through functions rather than selects, which is not a dodge: every column
-- this stage adds landed after 0151, `src/types/database.ts` has not been
-- regenerated since, and `npm run check:columns` is right to refuse a select
-- naming one. Same shape as `my_coaching_bookings` and `club_event_door_list`.
--
-- `security invoker`, so the policies decide what comes back: a league table
-- and its rounds have been public since 0024, and 0172's rule stands for a
-- draw. A definer here would be writing those two audiences out a second time.

create or replace function public.competition_games(p_competition bigint)
returns table (
  id bigint, update_id bigint, "position" smallint,
  player_one text, player_one_score text, player_one_id uuid,
  player_two text, player_two_score text, player_two_id uuid,
  mission text, deployment text, terrain text
)
language sql stable security invoker set search_path = public as $$
  select m.id, m.update_id, m.position,
         m.player_one, m.player_one_score, m.player_one_id,
         m.player_two, m.player_two_score, m.player_two_id,
         m.result_mission, m.result_deployment, m.result_terrain
    from public.club_competition_matches m
    join public.club_competition_updates u on u.id = m.update_id
   where u.competition_id = p_competition
   order by u.position desc, m.position;
$$;

grant execute on function public.competition_games(bigint) to anon, authenticated;

/** Every army on one competition's games, for the rounds a reader is shown. */
create or replace function public.competition_game_armies(p_competition bigint)
returns table (
  source_id bigint, side text,
  faction_id text, faction_label text, detachment text, disposition text,
  list_id bigint, list_name text, list_version_number integer, snapshot jsonb,
  mvp_units text[], underwhelming_units text[],
  primary_score integer, secondary_score integer, painted boolean,
  first_turn text, battle_role text, outcome text
)
language sql stable security invoker set search_path = public as $$
  select a.source_id, a.side,
         a.faction_id, a.faction_label, a.detachment, a.disposition,
         a.list_id, a.list_name, a.list_version_number, a.snapshot,
         a.mvp_units, a.underwhelming_units,
         a.primary_score, a.secondary_score, a.painted,
         a.first_turn, a.battle_role, a.outcome
    from public.game_result_armies a
   where a.source_type = 'competition_match'
     and a.source_id in (
       select m.id from public.club_competition_matches m
         join public.club_competition_updates u on u.id = m.update_id
        where u.competition_id = p_competition);
$$;

grant execute on function public.competition_game_armies(bigint) to anon, authenticated;

/**
 * Every army on one event's draw, with the setup beside it.
 *
 * Replaces the select `findPairingArmies` was doing. It was reading nine
 * columns and needed six more, every one of them post-0151, so the choice was
 * an RPC or a check that cannot see what it is checking.
 */
create or replace function public.event_pairing_armies(p_event bigint)
returns table (
  source_id bigint, side text,
  faction_id text, faction_label text, detachment text, disposition text,
  list_id bigint, list_name text, list_version_number integer, snapshot jsonb,
  mvp_units text[], underwhelming_units text[],
  primary_score integer, secondary_score integer, painted boolean,
  first_turn text, battle_role text, outcome text,
  mission text, deployment text, terrain text
)
language sql stable security invoker set search_path = public as $$
  select a.source_id, a.side,
         a.faction_id, a.faction_label, a.detachment, a.disposition,
         a.list_id, a.list_name, a.list_version_number, a.snapshot,
         a.mvp_units, a.underwhelming_units,
         a.primary_score, a.secondary_score, a.painted,
         a.first_turn, a.battle_role, a.outcome,
         m.result_mission, m.result_deployment, m.result_terrain
    from public.game_result_armies a
    join public.club_event_pairing_matches m on m.id = a.source_id
   where a.source_type = 'event_pairing' and m.event_id = p_event;
$$;

grant execute on function public.event_pairing_armies(bigint) to anon, authenticated;

-- --------------------------------------------- naming a list on a league game
--
-- 0163 restricted `club_set_result_list` to the two event sources, which was
-- the whole of what could carry an army then. A league game can now, and the
-- argument 0163 made for a tournament applies here word for word: the club
-- types the round up afterwards from what it was handed, so naming which of
-- that player's lists it was is the organiser's job. It still cannot say
-- WHOSE: the list has to belong to the account the row is already filed
-- under, which is the check further down and is unchanged.
--
-- Transformed from 0163's own text rather than retyped. Rebuilding
-- `save_pairing_armies` from 0136's body instead of 0163's is what dropped
-- its outcome stamp earlier in this migration, and the suite caught it.

create or replace function public.club_set_result_list(
  p_source text, p_source_id bigint, p_side text, p_list bigint
) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  v_row public.game_result_armies%rowtype;
  v_list public.army_lists%rowtype;
  v_version public.army_list_versions%rowtype;
  v_army jsonb;
begin
  if p_source not in ('event_podium', 'event_pairing', 'competition_match') then
    raise exception 'RESULT_NOT_FOUND';
  end if;

  select * into v_row from public.game_result_armies
   where source_type = p_source and source_id = p_source_id and side = p_side;
  -- The army row is what a list hangs off, so a result nobody has named a
  -- faction on has nothing to attach one to yet.
  if v_row.id is null then raise exception 'RESULT_NOT_FOUND'; end if;

  -- `club_can` is false for a site admin with no team row, which is the clause
  -- every function guarded by it has needed since 0128.
  -- A league game is the club's own results work, not its events work, so it
  -- asks for the capability that screen is already behind. Everything else
  -- about this function is 0163's and is copied rather than retyped.
  if not (public.club_can(v_row.club_id,
            case when p_source = 'competition_match' then 'results.manage'
                 else 'events.manage' end)
          or public.can_manage_club(v_row.club_id) or public.is_admin()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  if p_list is null then
    update public.game_result_armies
       set list_id = null, list_version_id = null, list_name = '',
           list_version_number = null, snapshot = '{}'::jsonb
     where id = v_row.id;

    if p_source = 'event_podium' then
      update public.club_event_results
         set army = coalesce(army, '{}'::jsonb)
                      - 'armyListId' - 'armyListName' - 'armyListVersionSnapshot'
       where id = p_source_id;
    end if;
    return;
  end if;

  select * into v_list from public.army_lists
   where id = p_list and deleted_at is null;
  if v_list.id is null then raise exception 'ARMY_LIST_NOT_FOUND'; end if;
  if v_list.club_id <> v_row.club_id then raise exception 'ARMY_WRONG_CLUB'; end if;
  -- Whose list it is, not whose it might have been. A free-text name on a
  -- placing has no account behind it and therefore no list to pick from.
  if v_row.profile_id is null or v_list.profile_id <> v_row.profile_id then
    raise exception 'ARMY_NOT_THEIRS';
  end if;

  select * into v_version from public.army_list_versions
   where id = v_list.current_version_id;
  if v_version.id is null then raise exception 'ARMY_LIST_NOT_FOUND'; end if;

  update public.game_result_armies
     set list_id = v_list.id,
         list_version_id = v_version.id,
         list_name = left(v_list.name, 200),
         list_version_number = v_version.version_number,
         -- Frozen, so a later edit to the list does not rewrite history. Same
         -- shape 0145 writes, because the tracker reads both the same way.
         snapshot = jsonb_build_object(
           'units', v_version.units,
           'detachments', v_version.detachment_selections,
           'totalPoints', v_version.total_points,
           'catalogueVersion', v_version.catalogue_version)
   where id = v_row.id;

  -- And into the placing's own jsonb, in legacy's key names. The event page
  -- has read `armyListVersionSnapshot` since Milestone 2 and nothing has ever
  -- written it: the unit-by-unit list on a podium card is a reader that has
  -- been waiting for a writer.
  if p_source = 'event_podium' then
    select coalesce(r.army, '{}'::jsonb) into v_army
      from public.club_event_results r where r.id = p_source_id;
    if v_army is null then raise exception 'PLACING_NOT_FOUND'; end if;

    update public.club_event_results
       set army = v_army || jsonb_build_object(
             -- The id as well as the name, so the editor can open with the
             -- right one chosen rather than matching on a string somebody is
             -- free to reuse.
             'armyListId', v_list.id,
             'armyListName', v_list.name,
             'armyListVersionSnapshot', jsonb_build_object(
               'pointsLimit', v_version.points_limit,
               'totalPoints', v_version.total_points,
               'versionNumber', v_version.version_number,
               'catalogueVersion', v_version.catalogue_version,
               'units', v_version.units))
     where id = p_source_id;
  end if;
end $$;

