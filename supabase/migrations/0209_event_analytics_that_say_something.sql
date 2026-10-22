/**
 * What an event's analytics are actually for.
 *
 * The client, on the panel 9d switched on: *"the data doesn't look correct or
 * show the detail we need. The purpose of these analytics is to show a
 * grouping of the best to worst performing Factions, Detachments, Dispositions
 * and Match ups from the results data for that specific event with
 * percentages. E.g Adepta Sororitas had a 60% win rate for this event, or
 * Disruption disposition was taken by 20 players, and had a 50% win rate ...
 * it seems too basic."*
 *
 * They are right, and `meta_event` says why: it groups by the whole triple,
 * `(faction, detachment, disposition)`. So an event where fifteen people
 * brought Sororitas under four different detachments is four rows that each
 * look like a minority army, and the one question the panel exists to answer,
 * "how did Sororitas do here", is not on it at all. At Didcot's own RTT that
 * produced three cards, two of them reading "no rate yet".
 *
 * The Meta Tracker has answered exactly these questions site-wide since 0142.
 * This is those questions scoped to one event, in the shape that screen
 * already uses, so a club reading both is reading one vocabulary.
 *
 * **"Taken by 20 players" is a count of people, not of rows.** One person at
 * one event has an army row per table of the draw plus one on the podium, so
 * counting rows would have said a field of eight was forty. Identity is the
 * account where there is one and the typed name where there is not, which is
 * the same pair `uniquePlayers` folds a door list on.
 */

-- ---------------------------------------------------------------------------
-- 1. Best to worst, by faction, by detachment and by disposition
-- ---------------------------------------------------------------------------

create or replace function public.meta_event_breakdown(p_event bigint)
returns table (
  kind        text,
  label       text,
  -- The faction a detachment belongs to, so "Hallowed Martyrs" is not a row
  -- floating free of the army that fields it. Empty for a faction row.
  parent      text,
  players     bigint,
  appearances bigint,
  games       bigint,
  wins        bigint,
  win_rate    numeric,
  early_signal boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  with rows_in as (
    -- 0142's own union, unchanged: a podium army and a table of the draw are
    -- both armies taken to this event.
    select a.* from public.game_result_armies a
     join public.club_event_results r on r.id = a.source_id
    where a.source_type = 'event_podium' and r.event_id = p_event
    union all
    select a.* from public.game_result_armies a
     join public.club_event_pairing_matches m on m.id = a.source_id
    where a.source_type = 'event_pairing' and m.event_id = p_event
  ),
  -- Who each row belongs to. An account where there is one, the typed name
  -- where there is not, and the row itself when it carries neither, so a
  -- nameless army counts once rather than folding into every other.
  tagged as (
    select r.*,
           coalesce(nullif(r.profile_id::text, ''),
                    nullif(lower(btrim(r.player_name)), ''),
                    'row:' || r.id::text) as who
      from rows_in r
     where r.faction_id <> ''
  ),
  parts as (
    select 'faction'::text as kind, t.faction_label as label, ''::text as parent, t.*
      from tagged t
    union all
    select 'detachment', t.detachment, t.faction_label, t.*
      from tagged t where nullif(btrim(t.detachment), '') is not null
    union all
    select 'disposition', t.disposition, t.faction_label, t.*
      from tagged t where nullif(btrim(t.disposition), '') is not null
  )
  select p.kind, p.label, p.parent,
         count(distinct p.who),
         count(*),
         count(*) filter (where p.outcome <> ''),
         count(*) filter (where p.outcome = 'won'),
         case when count(*) filter (where p.outcome <> '') = 0 then null
              else round(100.0 * count(*) filter (where p.outcome = 'won')
                         / count(*) filter (where p.outcome <> ''), 1) end,
         -- One scored game is not a rate. 0142's own threshold, said here so
         -- the event panel and the tracker agree about what is too early.
         count(*) filter (where p.outcome <> '') < 2
    from parts p
   where nullif(btrim(p.label), '') is not null
   group by p.kind, p.label, p.parent
   -- Best to worst, which is what was asked for, with the ones that have no
   -- rate yet after the ones that have. Then by how many took it, so a tie on
   -- rate leads with the popular one.
   order by p.kind,
            (case when count(*) filter (where p.outcome <> '') = 0 then 1 else 0 end),
            8 desc nulls last, 4 desc, 2;
end;
$$;

revoke all on function public.meta_event_breakdown(bigint) from public, anon;
grant execute on function public.meta_event_breakdown(bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Match ups, at this event
-- ---------------------------------------------------------------------------

/**
 * 0142's `meta_matchups` scoped to one event.
 *
 * Only a table of the draw can be a match up: a podium placing has no other
 * side to sit opposite, which is why this reads `event_pairing` alone where
 * the breakdown above reads both.
 */
create or replace function public.meta_event_matchups(p_event bigint)
returns table (
  faction_id text, faction_label text,
  opponent_id text, opponent_label text,
  games bigint, wins bigint, win_rate numeric, early_signal boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  select mine.faction_id, max(mine.faction_label),
         theirs.faction_id, max(theirs.faction_label),
         count(*),
         count(*) filter (where mine.outcome = 'won'),
         round(100.0 * count(*) filter (where mine.outcome = 'won') / count(*), 1),
         count(*) < 2
    from public.game_result_armies mine
    join public.club_event_pairing_matches m on m.id = mine.source_id
    join public.game_result_armies theirs
      on theirs.source_type = mine.source_type
     and theirs.source_id = mine.source_id
     and theirs.side <> mine.side
   where mine.source_type = 'event_pairing'
     and m.event_id = p_event
     and mine.outcome <> ''
     and mine.faction_id <> ''
     and theirs.faction_id <> ''
   group by mine.faction_id, theirs.faction_id
   order by 7 desc, 5 desc, 2;
end;
$$;

revoke all on function public.meta_event_matchups(bigint) from public, anon;
grant execute on function public.meta_event_matchups(bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. How each player did, which is where "undefeated" comes from
-- ---------------------------------------------------------------------------

/**
 * One row per person who played a scored table at this event.
 *
 * The client asked for "number of undefeated players", and that is a reading
 * of this rather than a figure of its own: a club reading the list can also
 * see who, which is the next question and the reason the row carries a name.
 *
 * Scored tables of the draw only. A podium placing is a finishing position
 * rather than a game (0141 stamps no outcome on one), so counting it would
 * make somebody who turned up and placed look unbeaten.
 */
create or replace function public.meta_event_players(p_event bigint)
returns table (
  profile_id uuid,
  player     text,
  faction_label text,
  games      bigint,
  wins       bigint,
  draws      bigint,
  losses     bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  -- `max()` has no uuid form, so the account comes back through an array.
  -- Every row in a group shares it by construction: the group key IS the
  -- account where there is one.
  select (array_agg(a.profile_id) filter (where a.profile_id is not null))[1],
         coalesce(max(nullif(btrim(a.player_name), '')), 'A player'),
         max(a.faction_label),
         count(*),
         count(*) filter (where a.outcome = 'won'),
         count(*) filter (where a.outcome = 'drew'),
         count(*) filter (where a.outcome = 'lost')
    from public.game_result_armies a
    join public.club_event_pairing_matches m on m.id = a.source_id
   where a.source_type = 'event_pairing'
     and m.event_id = p_event
     and a.outcome <> ''
   group by coalesce(nullif(a.profile_id::text, ''),
                     nullif(lower(btrim(a.player_name)), ''),
                     'row:' || a.id::text)
   order by 5 desc, 4 desc, 2;
end;
$$;

revoke all on function public.meta_event_players(bigint) from public, anon;
grant execute on function public.meta_event_players(bigint) to authenticated;
