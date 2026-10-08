-- 0168 · Team events: a draw at two levels
--
-- The client's words, as a new requirement rather than a revision: "Team
-- events, we will need a way to mark an event as a team event. In this setup,
-- there will be a team of players that needs to be created, and the draw would
-- be team vs team, and then player vs player from that team. Results and
-- overall winner etc would be at both levels also."
--
-- The shape this takes is a layer ON TOP of the draw, never beside it. A team
-- fixture owns the player tables inside it, and those tables are ordinary
-- `club_event_pairing_matches` rows with a parent. That is the whole design
-- decision and everything good about this follows from it:
--
--   the armies dialog, the scores dialog, the paste, the publish switch and
--   the audience control all keep working untouched;
--   `game_result_armies` keeps `source_type = 'event_pairing'`, so the Meta
--   Tracker counts a team event's games with no new source and no new rollup;
--   0163's outcome trigger stamps won, lost and drew on them already;
--   0164's cleanup still fires.
--
-- A second parallel table of team games would have had none of that and would
-- have had to be taught every one of them.
--
-- The convention the whole thing rests on: player_one plays for team_one. It
-- is structural rather than stated, because the fixture names both teams in
-- that order and the generator builds the tables from the fixture. A trigger
-- holds it for anybody with an account, which is the half that can be checked;
-- a name typed at the door is the club's own business.
--
-- A team's score is never typed. It is the sum of its own tables, kept by
-- trigger, because a team result that can disagree with the games under it is
-- the two-mechanisms-for-one-fact problem in the place it would be noticed
-- last. Both measures are kept, points and tables won, since team formats
-- differ on which one decides it and both are free once the rows are there.
--
-- Checked on a throwaway Postgres built from every migration.

alter table public.club_events
  add column if not exists team_event boolean not null default false;

grant select (team_event), insert (team_event), update (team_event)
  on public.club_events to authenticated;

-- ------------------------------------------------------------------- teams

create table if not exists public.club_event_teams (
  id bigint generated always as identity primary key,
  event_id bigint not null references public.club_events(id) on delete cascade,
  name text not null,
  captain_profile_id uuid references public.profiles(id) on delete set null,
  position smallint not null default 0,
  -- Where they finished. The club types it, the same as an individual placing,
  -- because a final table needs tiebreakers only the organiser knows.
  final_rank smallint,
  placement text not null default '',
  created_at timestamptz not null default now(),
  constraint club_event_teams_name_len
    check (char_length(btrim(name)) between 1 and 60),
  constraint club_event_teams_placement_len check (char_length(placement) <= 40),
  constraint club_event_teams_rank
    check (final_rank is null or final_rank between 1 and 999)
);

-- Two teams called Red at one event is no way to say which is meant, and the
-- draw is read at a glance across a hall.
create unique index if not exists club_event_teams_one_name
  on public.club_event_teams (event_id, lower(btrim(name)));
create index if not exists club_event_teams_event_idx
  on public.club_event_teams (event_id, position);

create table if not exists public.club_event_team_players (
  id bigint generated always as identity primary key,
  team_id bigint not null references public.club_event_teams(id) on delete cascade,
  event_id bigint not null references public.club_events(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  player_name text not null default '',
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  constraint club_event_team_players_name_len
    check (char_length(player_name) <= 80),
  -- An account or a name. A row with neither is a seat nobody is in.
  constraint club_event_team_players_somebody
    check (profile_id is not null or btrim(player_name) <> '')
);

-- Nobody plays for two teams at one event, by account or by name.
create unique index if not exists club_event_team_players_one_account
  on public.club_event_team_players (event_id, profile_id)
  where profile_id is not null;
create unique index if not exists club_event_team_players_one_name
  on public.club_event_team_players (event_id, lower(btrim(player_name)))
  where profile_id is null and btrim(player_name) <> '';
create index if not exists club_event_team_players_team_idx
  on public.club_event_team_players (team_id, position);

-- ------------------------------------------------------------- the fixtures

create table if not exists public.club_event_team_matches (
  id bigint generated always as identity primary key,
  pairing_id bigint not null references public.club_event_pairings(id) on delete cascade,
  event_id bigint not null references public.club_events(id) on delete cascade,
  table_label text not null default '',
  team_one bigint references public.club_event_teams(id) on delete cascade,
  team_two bigint references public.club_event_teams(id) on delete cascade,
  -- Derived from the tables underneath, never typed. Nulls rather than noughts
  -- for the same reason a table's score is nullable: nobody has played yet is
  -- not nil-nil.
  score_one integer,
  score_two integer,
  games_one smallint not null default 0,
  games_two smallint not null default 0,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  constraint club_event_team_matches_two_teams check (team_one is distinct from team_two)
);

create index if not exists club_event_team_matches_pairing_idx
  on public.club_event_team_matches (pairing_id, position);
create index if not exists club_event_team_matches_event_idx
  on public.club_event_team_matches (event_id);

alter table public.club_event_pairing_matches
  add column if not exists team_match_id bigint
    references public.club_event_team_matches(id) on delete cascade;

create index if not exists club_event_pairing_matches_team_idx
  on public.club_event_pairing_matches (team_match_id)
  where team_match_id is not null;

grant select (team_match_id), insert (team_match_id), update (team_match_id)
  on public.club_event_pairing_matches to authenticated;

-- ----------------------------------------------------------- grants and RLS

-- Supabase hands out a whole-table grant on creation, including TRUNCATE,
-- which ignores row security. `revoke all` then grant back, per 0151.
revoke all on public.club_event_teams from authenticated, anon;
revoke all on public.club_event_team_players from authenticated, anon;
revoke all on public.club_event_team_matches from authenticated, anon;

grant select on public.club_event_teams to authenticated, anon;
grant insert (event_id, name, captain_profile_id, position, final_rank, placement)
  on public.club_event_teams to authenticated;
grant update (name, captain_profile_id, position, final_rank, placement)
  on public.club_event_teams to authenticated;
grant delete on public.club_event_teams to authenticated;

grant select on public.club_event_team_players to authenticated, anon;
grant insert (team_id, event_id, profile_id, player_name, position)
  on public.club_event_team_players to authenticated;
grant update (profile_id, player_name, position)
  on public.club_event_team_players to authenticated;
grant delete on public.club_event_team_players to authenticated;

grant select on public.club_event_team_matches to authenticated, anon;
grant insert (pairing_id, event_id, table_label, team_one, team_two, position)
  on public.club_event_team_matches to authenticated;
grant update (table_label, team_one, team_two, position)
  on public.club_event_team_matches to authenticated;
grant delete on public.club_event_team_matches to authenticated;

alter table public.club_event_teams enable row level security;
alter table public.club_event_team_players enable row level security;
alter table public.club_event_team_matches enable row level security;

/**
 * Who is playing is part of a tournament's public face, the way its ticket
 * types are. A team event publishes its teams before anybody arrives, and the
 * draw is unreadable without the names in it. The roster stays gated, because
 * that is a list of bookings with money on them; this is a list of teams.
 *
 * Two policies rather than one, for 0090's reason: `club_can` is revoked from
 * `anon`, so a single policy naming it fails every signed-out visitor with a
 * permission error instead of hiding a draft's teams.
 */
create policy club_event_teams_public_anon on public.club_event_teams
  for select to anon using (exists (
    select 1 from public.club_events e
     where e.id = club_event_teams.event_id and e.status = 'published'));

create policy club_event_teams_public on public.club_event_teams
  for select to authenticated using (exists (
    select 1 from public.club_events e
     where e.id = club_event_teams.event_id
       and (e.status = 'published' or public.club_can(e.club_id, 'events.manage'))));

create policy club_event_teams_write on public.club_event_teams
  for all to authenticated using (exists (
    select 1 from public.club_events e
     where e.id = club_event_teams.event_id
       and public.club_can(e.club_id, 'events.manage')))
  with check (exists (
    select 1 from public.club_events e
     where e.id = club_event_teams.event_id
       and public.club_can(e.club_id, 'events.manage')));

create policy club_event_team_players_public_anon on public.club_event_team_players
  for select to anon using (exists (
    select 1 from public.club_events e
     where e.id = club_event_team_players.event_id and e.status = 'published'));

create policy club_event_team_players_public on public.club_event_team_players
  for select to authenticated using (exists (
    select 1 from public.club_events e
     where e.id = club_event_team_players.event_id
       and (e.status = 'published' or public.club_can(e.club_id, 'events.manage'))));

create policy club_event_team_players_write on public.club_event_team_players
  for all to authenticated using (exists (
    select 1 from public.club_events e
     where e.id = club_event_team_players.event_id
       and public.club_can(e.club_id, 'events.manage')))
  with check (exists (
    select 1 from public.club_events e
     where e.id = club_event_team_players.event_id
       and public.club_can(e.club_id, 'events.manage')));

-- A fixture is part of the draw, so it is gated by the round exactly as the
-- tables under it are. Any other answer and a team score would be readable a
-- round before the draw it belongs to.
create policy club_event_team_matches_public_anon on public.club_event_team_matches
  for select to anon using (exists (
    select 1 from public.club_event_pairings p
     where p.id = club_event_team_matches.pairing_id and p.published));

create policy club_event_team_matches_public on public.club_event_team_matches
  for select to authenticated using (exists (
    select 1 from public.club_event_pairings p
     where p.id = club_event_team_matches.pairing_id
       and (p.published or exists (
         select 1 from public.club_events e
          where e.id = p.event_id and public.club_can(e.club_id, 'events.manage')))));

create policy club_event_team_matches_write on public.club_event_team_matches
  for all to authenticated using (exists (
    select 1 from public.club_events e
     where e.id = club_event_team_matches.event_id
       and public.club_can(e.club_id, 'events.manage')))
  with check (exists (
    select 1 from public.club_events e
     where e.id = club_event_team_matches.event_id
       and public.club_can(e.club_id, 'events.manage')));

do $$
declare t text;
begin
  foreach t in array array['club_event_teams', 'club_event_team_players',
                           'club_event_team_matches'] loop
    if exists (
      select 1 from information_schema.role_table_grants
       where table_name = t and grantee = 'authenticated'
         and privilege_type in ('INSERT', 'UPDATE'))
    then
      raise exception 'WHOLE TABLE GRANT LEFT ON %', t;
    end if;
  end loop;
end $$;

-- ------------------------------------------------------- the derived score

/**
 * A team's result is the sum of its own tables.
 *
 * `score_one` and `score_two` stay null until somebody has typed a score, so
 * an undrawn fixture reads as "not played" rather than as a nil-nil draw.
 * `games_one` and `games_two` count tables won outright, because team formats
 * are split between deciding on points and deciding on games and both are free
 * once the tables are in.
 */
create or replace function public.refresh_team_match_score(p_match bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_match is null then return; end if;

  update public.club_event_team_matches m
     set score_one = t.one, score_two = t.two,
         games_one = coalesce(t.won_one, 0), games_two = coalesce(t.won_two, 0)
    from (
      select sum(pm.score_one) as one, sum(pm.score_two) as two,
             count(*) filter (where pm.score_one > pm.score_two) as won_one,
             count(*) filter (where pm.score_two > pm.score_one) as won_two
        from public.club_event_pairing_matches pm
       where pm.team_match_id = p_match
         and pm.score_one is not null and pm.score_two is not null
    ) t
   where m.id = p_match;
end $$;

create or replace function public.team_match_score_changed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.refresh_team_match_score(old.team_match_id);
  if tg_op <> 'DELETE' and new.team_match_id is distinct from old.team_match_id then
    perform public.refresh_team_match_score(new.team_match_id);
  end if;
  return null;
end $$;

-- `old` is null on an insert, so that case needs its own statement rather than
-- a clever one: `old.team_match_id` would raise.
create or replace function public.team_match_table_added() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.refresh_team_match_score(new.team_match_id);
  return null;
end $$;

drop trigger if exists pairing_match_team_score on public.club_event_pairing_matches;
create trigger pairing_match_team_score
  after update or delete on public.club_event_pairing_matches
  for each row execute function public.team_match_score_changed();

drop trigger if exists pairing_match_team_score_new on public.club_event_pairing_matches;
create trigger pairing_match_team_score_new
  after insert on public.club_event_pairing_matches
  for each row execute function public.team_match_table_added();

/**
 * player_one plays for team_one.
 *
 * The convention the fixture rests on, held for anybody with an account. A
 * name typed at the door carries no account and cannot be checked, which is
 * the same line every other part of the draw draws.
 */
create or replace function public.team_table_sides() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_one bigint; v_two bigint;
begin
  if new.team_match_id is null then return new; end if;

  select team_one, team_two into v_one, v_two
    from public.club_event_team_matches where id = new.team_match_id;

  if new.player_one_id is not null and v_one is not null
     and not exists (select 1 from public.club_event_team_players
                      where team_id = v_one and profile_id = new.player_one_id) then
    raise exception 'TEAM_PLAYER_WRONG_SIDE';
  end if;

  if new.player_two_id is not null and v_two is not null
     and not exists (select 1 from public.club_event_team_players
                      where team_id = v_two and profile_id = new.player_two_id) then
    raise exception 'TEAM_PLAYER_WRONG_SIDE';
  end if;

  return new;
end $$;

drop trigger if exists pairing_match_team_sides on public.club_event_pairing_matches;
create trigger pairing_match_team_sides
  before insert or update of player_one_id, player_two_id, team_match_id
  on public.club_event_pairing_matches
  for each row execute function public.team_table_sides();

-- --------------------------------------------- the podium, at both levels

/**
 * A team on the podium puts every one of its players there.
 *
 * 0167 gives a member first, second or third for an individual placing. A team
 * event has no individual placing for most of the field, so without this the
 * people who actually won it would be the only podium at the club with no
 * badge. Same door, so the two cannot drift.
 */
create or replace function public.team_placing_badges() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_club bigint; v_title text; r record;
begin
  if coalesce(new.final_rank, 0) not between 1 and 3 then return new; end if;
  if old.final_rank is not distinct from new.final_rank then return new; end if;

  select e.club_id, e.title into v_club, v_title
    from public.club_events e where e.id = new.event_id;
  if v_club is null then return new; end if;

  for r in select profile_id from public.club_event_team_players
            where team_id = new.id and profile_id is not null
  loop
    perform public.award_podium_badge(v_club, r.profile_id, new.final_rank::integer,
      coalesce(nullif(btrim(new.placement), ''), 'Placed') || ' with ' ||
        btrim(new.name) || ' at ' ||
        coalesce(nullif(btrim(v_title), ''), 'one of our events') || '.');
  end loop;

  return new;
end $$;

drop trigger if exists club_event_teams_podium on public.club_event_teams;
create trigger club_event_teams_podium
  after update of final_rank on public.club_event_teams
  for each row execute function public.team_placing_badges();

-- ------------------------------------------------------------- the reads

/**
 * A team and everybody in it, in one transaction.
 *
 * The players are replaced wholesale rather than diffed, because the one thing
 * a captain changes is the order they play in and a diff would have to work
 * that out from names. Wholesale means a delete and an insert, and those have
 * to be the same transaction: the one-team-per-person index refuses somebody
 * already in another team, so a service doing it in two round trips would take
 * a team's players away and then fail to put them back.
 *
 * Definer with its own guard, because that is what makes it one statement.
 * `club_can` is false for a site admin with no team row, hence `is_admin`.
 */
create or replace function public.save_event_team(
  p_event bigint, p_team bigint, p_name text, p_captain uuid,
  p_position integer, p_players jsonb)
returns bigint
language plpgsql security definer set search_path = public as $$
declare v_club bigint; v_team bigint; v_name text := btrim(coalesce(p_name, ''));
begin
  select club_id into v_club from public.club_events where id = p_event;
  if v_club is null then raise exception 'EVENT_NOT_FOUND'; end if;
  if not (public.club_can(v_club, 'events.manage') or public.is_admin()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;
  if v_name = '' then raise exception 'TEAM_NAME_REQUIRED'; end if;

  if p_team is null then
    insert into public.club_event_teams (event_id, name, captain_profile_id, position)
      values (p_event, v_name, p_captain, coalesce(p_position, 0))
      returning id into v_team;
  else
    update public.club_event_teams
       set name = v_name, captain_profile_id = p_captain,
           position = coalesce(p_position, position)
     where id = p_team and event_id = p_event
     returning id into v_team;
    if v_team is null then raise exception 'TEAM_NOT_FOUND'; end if;
  end if;

  delete from public.club_event_team_players where team_id = v_team;

  insert into public.club_event_team_players
    (team_id, event_id, profile_id, player_name, position)
  select v_team, p_event,
         nullif(p.value ->> 'profileId', '')::uuid,
         btrim(coalesce(p.value ->> 'name', '')),
         (p.ordinality - 1)::smallint
    from jsonb_array_elements(coalesce(p_players, '[]'::jsonb))
           with ordinality as p(value, ordinality)
   where nullif(btrim(coalesce(p.value ->> 'name', '')), '') is not null
      or nullif(p.value ->> 'profileId', '') is not null;

  return v_team;
end $$;

/**
 * Whether this event runs as teams.
 *
 * A function and not a select, because `src/types/database.ts` has been stale
 * since 0151 and `npm run check:columns` is right to refuse a column it has
 * never heard of. Definer, because the answer is one bit about an event the
 * reader can already see and a draft's own team has to read it too.
 */
create or replace function public.event_is_team_event(p_event bigint)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select team_event from public.club_events where id = p_event), false)
$$;

/**
 * Every team at an event, with who is in it.
 *
 * One read rather than one per team. Invoker, so the policies above decide who
 * sees a draft's teams, and a second guard written by hand would be a second
 * thing to get wrong.
 */
create or replace function public.event_teams(p_event bigint)
returns table (
  id bigint, name text, "position" smallint, final_rank smallint, placement text,
  captain_profile_id uuid, players jsonb
)
language sql stable security invoker set search_path = public as $$
  select t.id, t.name, t.position, t.final_rank, t.placement, t.captain_profile_id,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id', p.id, 'profileId', p.profile_id,
                    'name', p.player_name, 'position', p.position)
                  order by p.position, p.id)
             from public.club_event_team_players p where p.team_id = t.id
         ), '[]'::jsonb)
    from public.club_event_teams t
   where t.event_id = p_event
   order by coalesce(t.final_rank, 9999), t.position, lower(t.name)
$$;

/**
 * The whole team draw for an event, fixtures with their tables inside them.
 *
 * One read for every round rather than one per round, which is the call
 * `getRoundArmies` already made: five rounds of ten fixtures is one query and
 * not five. Invoker again, so a round that is not on show is hidden by the
 * fixture's own policy.
 */
create or replace function public.event_team_draw(p_event bigint)
returns table (
  id bigint, pairing_id bigint, round smallint, table_label text,
  team_one bigint, team_one_name text, team_two bigint, team_two_name text,
  score_one integer, score_two integer, games_one smallint, games_two smallint,
  "position" smallint, published boolean, tables jsonb
)
language sql stable security invoker set search_path = public as $$
  select m.id, m.pairing_id, pr.round, m.table_label,
         m.team_one, one.name, m.team_two, two.name,
         m.score_one, m.score_two, m.games_one, m.games_two, m.position,
         pr.published,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id', pm.id, 'tableLabel', pm.table_label,
                    'playerOne', pm.player_one, 'playerOneId', pm.player_one_id,
                    'playerTwo', pm.player_two, 'playerTwoId', pm.player_two_id,
                    'scoreOne', pm.score_one, 'scoreTwo', pm.score_two,
                    'position', pm.position)
                  order by pm.position, pm.id)
             from public.club_event_pairing_matches pm where pm.team_match_id = m.id
         ), '[]'::jsonb)
    from public.club_event_team_matches m
    join public.club_event_pairings pr on pr.id = m.pairing_id
    left join public.club_event_teams one on one.id = m.team_one
    left join public.club_event_teams two on two.id = m.team_two
   where m.event_id = p_event
   order by pr.round, m.position, m.id
$$;

revoke all on function public.refresh_team_match_score(bigint) from public, anon, authenticated;
revoke all on function public.team_match_score_changed() from public, anon, authenticated;
revoke all on function public.team_match_table_added() from public, anon, authenticated;
revoke all on function public.team_table_sides() from public, anon, authenticated;
revoke all on function public.team_placing_badges() from public, anon, authenticated;
revoke all on function public.save_event_team(bigint, bigint, text, uuid, integer, jsonb)
  from public, anon;
grant execute on function public.save_event_team(bigint, bigint, text, uuid, integer, jsonb)
  to authenticated;
revoke all on function public.event_is_team_event(bigint) from public;
grant execute on function public.event_is_team_event(bigint) to authenticated, anon;
revoke all on function public.event_teams(bigint) from public;
revoke all on function public.event_team_draw(bigint) from public;
grant execute on function public.event_teams(bigint) to authenticated, anon;
grant execute on function public.event_team_draw(bigint) to authenticated, anon;
