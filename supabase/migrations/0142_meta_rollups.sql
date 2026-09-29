-- 0142 · What wins, and what people take
--
-- The client asked for the Meta Tracker twice ("replicate local app"), for
-- club faction and disposition analytics ("missing from M2 ... see Didcot club
-- for example"), and for event analytics with a win rate per faction and
-- disposition. All three read the same rows and the same rules, so they read
-- the same functions.
--
-- Legacy's rules, copied (club_store.py:24430 onwards):
--
--   * A table booking counts only once the club has settled it. 0141 stores
--     that as `confirmed`.
--   * Podiums and league standings strengthen faction and unit signals and
--     create no wins or losses. They carry `outcome = ''`, so they count
--     towards representation and are excluded from every win rate.
--   * Anything under two games is an early signal: shown, and flagged. Hiding
--     it makes a quiet club look like a broken page.
--   * Nothing in the future.
--
-- **The guard is in the function, not the page.** These are granted to
-- `authenticated`, so anybody can call them with their own JWT: a named club
-- is refused unless the caller is in it, runs it, or is an admin. The global
-- sample (`p_club` null) is open to anyone signed in, which is what the site
-- wide tracker is.
--
-- And the guard is `perform`ed, never `select`ed. A `stable` function whose
-- result nothing reads may be optimised away, which is how 0117 handed a
-- club's takings to a stranger.
--
-- Checked on a throwaway Postgres built from every migration: a stranger is
-- refused one club and allowed the global view, an unsettled game is not
-- counted, a podium moves representation without moving a win rate, a
-- one-game row is flagged early, and a matchup reads the same game from both
-- sides.

/**
 * May this reader see this slice?
 *
 * Null is the global sample. A club is the club's own business, which is the
 * same line `club_faction_analytics` draws in legacy (25775: the scope picker
 * offers only your approved clubs).
 */
create or replace function public.meta_scope_allowed(p_club bigint)
returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'META_SIGN_IN'; end if;
  if p_club is null then return; end if;
  if public.is_club_member(p_club) or public.can_manage_club(p_club)
     or public.is_admin() then
    return;
  end if;
  raise exception 'META_NOT_YOURS' using errcode = 'insufficient_privilege';
end $$;

/**
 * The rows every rollup starts from.
 *
 * One place that knows the four rules, so a section cannot quietly disagree
 * with the one above it about what counts.
 */
create or replace function public.meta_rows(
  p_club bigint, p_from date, p_to date
) returns setof public.game_result_armies
language sql stable security definer set search_path = public as $$
  select a.* from public.game_result_armies a
   where a.confirmed
     and a.faction_id <> ''
     and a.played_on is not null
     and a.played_on <= public.london_today()
     and (p_from is null or a.played_on >= p_from)
     and (p_to is null or a.played_on <= p_to)
     and (p_club is null or a.club_id = p_club)
$$;

/**
 * Faction by faction: how often it turns up, and how it does when it does.
 *
 * `games` counts only rows that carry an outcome, because a podium is not a
 * game. `appearances` counts every row, which is what representation means.
 */
create or replace function public.meta_factions(
  p_club bigint default null, p_from date default null, p_to date default null
) returns table (
  faction_id text, faction_label text,
  appearances bigint, games bigint, wins bigint, draws bigint, losses bigint,
  win_rate numeric, representation numeric, podiums bigint, average_vp numeric,
  early_signal boolean
)
language plpgsql stable security definer set search_path = public as $$
declare v_total bigint;
begin
  perform public.meta_scope_allowed(p_club);

  select count(*) into v_total from public.meta_rows(p_club, p_from, p_to);

  return query
  select r.faction_id,
         max(r.faction_label),
         count(*),
         count(*) filter (where r.outcome <> ''),
         count(*) filter (where r.outcome = 'won'),
         count(*) filter (where r.outcome = 'drew'),
         count(*) filter (where r.outcome = 'lost'),
         case when count(*) filter (where r.outcome <> '') = 0 then 0
              else round(100.0 * count(*) filter (where r.outcome = 'won')
                         / count(*) filter (where r.outcome <> ''), 1) end,
         case when coalesce(v_total, 0) = 0 then 0
              else round(100.0 * count(*) / v_total, 1) end,
         count(*) filter (where r.source_type = 'event_podium'),
         round(avg(r.total_vp) filter (where r.total_vp is not null), 1),
         count(*) filter (where r.outcome <> '') < 2
    from public.meta_rows(p_club, p_from, p_to) r
   group by r.faction_id
   order by 8 desc, 4 desc, 2;
end $$;

/** A faction's detachments, on the same measures. */
create or replace function public.meta_detachments(
  p_club bigint default null, p_from date default null, p_to date default null
) returns table (
  faction_id text, faction_label text, detachment text,
  appearances bigint, games bigint, wins bigint, win_rate numeric,
  early_signal boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.meta_scope_allowed(p_club);
  return query
  select r.faction_id, max(r.faction_label), r.detachment,
         count(*),
         count(*) filter (where r.outcome <> ''),
         count(*) filter (where r.outcome = 'won'),
         case when count(*) filter (where r.outcome <> '') = 0 then 0
              else round(100.0 * count(*) filter (where r.outcome = 'won')
                         / count(*) filter (where r.outcome <> ''), 1) end,
         count(*) filter (where r.outcome <> '') < 2
    from public.meta_rows(p_club, p_from, p_to) r
   where r.detachment <> ''
   group by r.faction_id, r.detachment
   order by 7 desc, 5 desc, 3;
end $$;

/**
 * A detachment's dispositions.
 *
 * Grouped by faction AND detachment, never by disposition alone: a disposition
 * belongs to a detachment, and "Purge the Foe" means something different under
 * each one. It is the rule the pickers enforce and the rollups have to respect
 * it or the number underneath is a different question's answer.
 */
create or replace function public.meta_dispositions(
  p_club bigint default null, p_from date default null, p_to date default null
) returns table (
  faction_id text, faction_label text, detachment text, disposition text,
  appearances bigint, games bigint, wins bigint, win_rate numeric,
  early_signal boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.meta_scope_allowed(p_club);
  return query
  select r.faction_id, max(r.faction_label), r.detachment, r.disposition,
         count(*),
         count(*) filter (where r.outcome <> ''),
         count(*) filter (where r.outcome = 'won'),
         case when count(*) filter (where r.outcome <> '') = 0 then 0
              else round(100.0 * count(*) filter (where r.outcome = 'won')
                         / count(*) filter (where r.outcome <> ''), 1) end,
         count(*) filter (where r.outcome <> '') < 2
    from public.meta_rows(p_club, p_from, p_to) r
   where r.disposition <> ''
   group by r.faction_id, r.detachment, r.disposition
   order by 8 desc, 6 desc, 4;
end $$;

/**
 * Faction into faction.
 *
 * The opponent is the other side of the same game, which is why 0141 does not
 * store it: `game_result_armies_one_side` makes this join a primary-key probe.
 * Only rows with an outcome, so a podium cannot become a matchup.
 */
create or replace function public.meta_matchups(
  p_club bigint default null, p_from date default null, p_to date default null
) returns table (
  faction_id text, faction_label text,
  opponent_id text, opponent_label text,
  games bigint, wins bigint, win_rate numeric, early_signal boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.meta_scope_allowed(p_club);
  return query
  select mine.faction_id, max(mine.faction_label),
         theirs.faction_id, max(theirs.faction_label),
         count(*),
         count(*) filter (where mine.outcome = 'won'),
         round(100.0 * count(*) filter (where mine.outcome = 'won') / count(*), 1),
         count(*) < 2
    from public.meta_rows(p_club, p_from, p_to) mine
    join public.game_result_armies theirs
      on theirs.source_type = mine.source_type
     and theirs.source_id = mine.source_id
     and theirs.side <> mine.side
   where mine.outcome <> '' and theirs.faction_id <> ''
   group by mine.faction_id, theirs.faction_id
   order by 7 desc, 5 desc, 2;
end $$;

/**
 * Missions, deployments, terrain, who went first, and who attacked.
 *
 * One call with a `kind` column rather than five round trips for five strips
 * of the same section. Counting waves rather than queries is the rule the
 * bookings tab learned the hard way.
 */
create or replace function public.meta_battle_context(
  p_club bigint default null, p_from date default null, p_to date default null
) returns table (
  kind text, value text, games bigint, wins bigint, win_rate numeric,
  early_signal boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.meta_scope_allowed(p_club);
  return query
  with played as (
    select * from public.meta_rows(p_club, p_from, p_to) where outcome <> ''
  ), spread as (
    select 'mission'::text as kind, mission as value, outcome from played
    union all select 'deployment', deployment, outcome from played
    union all select 'terrain', terrain, outcome from played
    union all select 'first_turn', first_turn, outcome from played
    union all select 'battle_role', battle_role, outcome from played
  )
  select s.kind, s.value, count(*),
         count(*) filter (where s.outcome = 'won'),
         round(100.0 * count(*) filter (where s.outcome = 'won') / count(*), 1),
         count(*) < 2
    from spread s
   where s.value <> ''
   group by s.kind, s.value
   order by 1, 3 desc, 2;
end $$;

/**
 * Units, as the people who played them tagged them.
 *
 * Legacy is careful about this one and the caveat says so on screen: these
 * blend appearances with MVP and underwhelming tags, so they read as a
 * coaching signal rather than a datasheet ranking.
 */
create or replace function public.meta_units(
  p_club bigint default null, p_from date default null, p_to date default null
) returns table (
  faction_id text, faction_label text, unit_name text,
  mvp bigint, underwhelming bigint, games bigint, early_signal boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.meta_scope_allowed(p_club);
  return query
  with tagged as (
    select r.faction_id, r.faction_label, u as unit_name, 1 as mvp, 0 as poor
      from public.meta_rows(p_club, p_from, p_to) r,
           lateral unnest(r.mvp_units) u
    union all
    select r.faction_id, r.faction_label, u, 0, 1
      from public.meta_rows(p_club, p_from, p_to) r,
           lateral unnest(r.underwhelming_units) u
  )
  select t.faction_id, max(t.faction_label), t.unit_name,
         sum(t.mvp)::bigint, sum(t.poor)::bigint, count(*)::bigint,
         count(*) < 2
    from tagged t
   where btrim(t.unit_name) <> ''
   group by t.faction_id, t.unit_name
   order by 4 desc, 6 desc, 3;
end $$;

/**
 * One row per faction per month, for the rising and falling view.
 *
 * `london_day` on the bucket, never a bare cast: a game played at half past
 * midnight on the first of a month in London is the last of the previous month
 * in UTC, and 0123 is the migration that had to go back and fix five functions
 * for exactly that.
 */
create or replace function public.meta_trend(
  p_club bigint default null, p_from date default null, p_to date default null
) returns table (
  bucket date, faction_id text, faction_label text,
  games bigint, wins bigint, win_rate numeric
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.meta_scope_allowed(p_club);
  return query
  select date_trunc('month', r.played_on)::date, r.faction_id,
         max(r.faction_label), count(*),
         count(*) filter (where r.outcome = 'won'),
         round(100.0 * count(*) filter (where r.outcome = 'won')
               / nullif(count(*) filter (where r.outcome <> ''), 0), 1)
    from public.meta_rows(p_club, p_from, p_to) r
   where r.outcome <> ''
   group by 1, r.faction_id
   order by 1, 4 desc;
end $$;

/** How many rows each club has, for the scope picker. */
create or replace function public.meta_scope_counts()
returns table (club_id bigint, club_name text, tracked bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'META_SIGN_IN'; end if;
  return query
  select a.club_id, max(c.name), count(*)
    from public.game_result_armies a
    join public.clubs c on c.id = a.club_id
   where a.confirmed and a.faction_id <> '' and a.club_id is not null
     and (public.is_club_member(a.club_id) or public.can_manage_club(a.club_id)
          or public.is_admin())
   group by a.club_id
   order by 3 desc, 2;
end $$;

/**
 * One event's armies.
 *
 * The client's words: "show overview of what armies are being/were taken to
 * the event and win rate percentage per army faction and disposition taken".
 *
 * Two paths in, because an event's armies arrive two ways: a finishing place
 * (`event_podium`, keyed on the placing) and a table in a round
 * (`event_pairing`, keyed on the match). The draw has no army screen yet, so
 * today this answers what was taken and the win rates stay empty; the screen
 * says so rather than printing zeroes. See DEFERRED.md.
 *
 * Readable by anybody who can see the event, which for a published event is
 * anybody: the results are already on the page.
 */
create or replace function public.meta_event(p_event bigint)
returns table (
  faction_id text, faction_label text, detachment text, disposition text,
  appearances bigint, games bigint, wins bigint, win_rate numeric,
  early_signal boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
  with rows_in as (
    select a.* from public.game_result_armies a
     join public.club_event_results r on r.id = a.source_id
    where a.source_type = 'event_podium' and r.event_id = p_event
    union all
    select a.* from public.game_result_armies a
     join public.club_event_pairing_matches m on m.id = a.source_id
    where a.source_type = 'event_pairing' and m.event_id = p_event
  )
  select r.faction_id, max(r.faction_label), r.detachment, r.disposition,
         count(*),
         count(*) filter (where r.outcome <> ''),
         count(*) filter (where r.outcome = 'won'),
         case when count(*) filter (where r.outcome <> '') = 0 then null
              else round(100.0 * count(*) filter (where r.outcome = 'won')
                         / count(*) filter (where r.outcome <> ''), 1) end,
         count(*) filter (where r.outcome <> '') < 2
    from rows_in r
   where r.faction_id <> ''
   group by r.faction_id, r.detachment, r.disposition
   order by 5 desc, 2;
end $$;

/**
 * What one member plays, and how it goes for them.
 *
 * `security invoker`, deliberately, where every other function here is
 * definer: the rows already know who may read them
 * (`game_result_armies_select` admits the person themselves, their clubmates
 * and the club's team), so RLS is the guard and a second one written by hand
 * would be a second thing to get wrong. 0122 learned the opposite lesson about
 * a write, which is a different question: a definer function cannot lean on
 * RLS to decide what it may insert.
 */
create or replace function public.meta_member(p_profile uuid)
returns table (
  faction_id text, faction_label text,
  games bigint, wins bigint, draws bigint, losses bigint,
  win_rate numeric, appearances bigint, early_signal boolean
)
language sql stable security invoker set search_path = public as $$
  select a.faction_id, max(a.faction_label),
         count(*) filter (where a.outcome <> ''),
         count(*) filter (where a.outcome = 'won'),
         count(*) filter (where a.outcome = 'drew'),
         count(*) filter (where a.outcome = 'lost'),
         case when count(*) filter (where a.outcome <> '') = 0 then null
              else round(100.0 * count(*) filter (where a.outcome = 'won')
                         / count(*) filter (where a.outcome <> ''), 1) end,
         count(*),
         count(*) filter (where a.outcome <> '') < 2
    from public.game_result_armies a
   where a.profile_id = p_profile
     and a.confirmed and a.faction_id <> ''
     and a.played_on <= public.london_today()
   group by a.faction_id
   order by 3 desc, 2;
$$;

revoke all on function public.meta_scope_allowed(bigint) from public, anon;
revoke all on function public.meta_rows(bigint, date, date) from public, anon;
revoke all on function public.meta_factions(bigint, date, date) from public, anon;
revoke all on function public.meta_detachments(bigint, date, date) from public, anon;
revoke all on function public.meta_dispositions(bigint, date, date) from public, anon;
revoke all on function public.meta_matchups(bigint, date, date) from public, anon;
revoke all on function public.meta_battle_context(bigint, date, date) from public, anon;
revoke all on function public.meta_units(bigint, date, date) from public, anon;
revoke all on function public.meta_trend(bigint, date, date) from public, anon;
revoke all on function public.meta_scope_counts() from public, anon;
revoke all on function public.meta_event(bigint) from public, anon;
revoke all on function public.meta_member(uuid) from public, anon;

-- `meta_scope_allowed` and `meta_rows` stay ungranted: they are what the
-- others are built from, not doors of their own.
grant execute on function public.meta_factions(bigint, date, date) to authenticated;
grant execute on function public.meta_detachments(bigint, date, date) to authenticated;
grant execute on function public.meta_dispositions(bigint, date, date) to authenticated;
grant execute on function public.meta_matchups(bigint, date, date) to authenticated;
grant execute on function public.meta_battle_context(bigint, date, date) to authenticated;
grant execute on function public.meta_units(bigint, date, date) to authenticated;
grant execute on function public.meta_trend(bigint, date, date) to authenticated;
grant execute on function public.meta_scope_counts() to authenticated;
grant execute on function public.meta_event(bigint) to authenticated, anon;
grant execute on function public.meta_member(uuid) to authenticated;
