-- Demo data: a year of confirmed games, so the Meta Tracker has a meta
--
-- The tracker counts a table booking only once the club has confirmed it,
-- which is legacy's own rule and the right one. Didcot has nine scored games,
-- four confirmed, and exactly one of those carries an army. So every section
-- of the tracker renders its empty state and neither the client nor anybody
-- building it can tell a working page from a broken one.
--
-- This gives Didcot fifty-two games across the last twelve months: two armies
-- each, real factions with real detachments and the dispositions those
-- detachments actually offer, scores that agree with their outcomes, and a
-- spread of missions, deployments and terrain.
--
-- Three things it is careful about.
--
-- **It reads the catalogue rather than naming armies.** Every faction,
-- detachment and disposition below is selected out of the published version,
-- so the seed cannot invent a combination the pickers would refuse. If the
-- catalogue changes, this follows it.
--
-- **It writes results, not bookings.** `game_result_armies` is what the
-- rollups read, and it carries no foreign key on `source_id` because it is
-- polymorphic. Inventing sixty club_bookings would mean inventing sixty club
-- nights, sixty table indexes and sixty people who were there, and would put
-- games nobody played into six members' own history. The source ids start at
-- 900001, well clear of the real ones, so nothing real can collide with them
-- and the revert is one line.
--
-- **It is demo data and says so.** The dates are real club nights, the people
-- are real members and the armies are real, but the games did not happen.
-- Revert before a client demo of anything other than this feature.
--
--   psql -f supabase/seeds/demo_meta_results.sql
--   (or paste it into the Supabase SQL editor)

-- No explicit transaction: this is one insert, which is atomic on its own, and
-- wrapping it stopped the behaviour test from being able to roll it back.
with club as (
  select id from public.clubs where slug = 'didcot-wargames-didcot'
),
edition as (
  select id from public.army_editions where status = 'active' limit 1
),
-- Eight factions, each with one real detachment and one disposition that
-- detachment actually offers.
picks as (
  select row_number() over (order by f.position, f.label) - 1 as n,
         f.id as faction_id, f.label as faction_label,
         d.label as detachment, d.dispositions[1] as disposition
    from public.army_factions f
    join edition e on e.id = f.edition_id
    cross join lateral (
      select d.label, d.dispositions
        from public.army_detachments d
       where d.edition_id = f.edition_id and d.faction_id = f.id
         and coalesce(array_length(d.dispositions, 1), 0) > 0
       order by d.position, d.label
       limit 1) d
   order by f.position, f.label
   limit 8
),
people as (
  select row_number() over (order by m.joined_at) - 1 as n,
         m.profile_id, coalesce(p.full_name, 'A member') as name
    from public.club_memberships m
    join public.profiles p on p.id = m.profile_id
    join club c on c.id = m.club_id
   where m.status = 'approved'
),
crowd as (select count(*)::int as size from people),
-- Fifty-two Thursdays back from the most recent one.
nights as (
  select public.london_today()
         - ((extract(isodow from public.london_today())::int + 3) % 7)
         - (w * 7) as played_on,
         w
    from generate_series(0, 51) as w
),
games as (
  select n.played_on,
         900001 + n.w as source_id,
         -- Spread the pairings so no two weeks look alike.
         (n.w * 3) % 8 as one_pick,
         (n.w * 5 + 3) % 8 as two_pick,
         -- Always two different people. Picking both with a modulus collapses
         -- on a small club: every other week drew the same member twice and
         -- the row was thrown away, which halved the sample on exactly the
         -- clubs that need the demo data most.
         (n.w % (select size from crowd)) as one_who,
         ((n.w % (select size from crowd))
          + 1 + (n.w / (select size from crowd))
                % ((select size from crowd) - 1)
         ) % (select size from crowd) as two_who,
         45 + (n.w * 7) % 40 as one_primary,
         40 + (n.w * 11) % 40 as two_primary,
         n.w
    from nights n
   -- The two factions can never collide: 6w is never 3 modulo 8. The two
   -- people cannot either, by the arithmetic above. Kept as a guard anyway,
   -- because a seed that quietly pairs somebody with themselves is a seed
   -- that puts an impossible game on a member's own record.
   where (n.w * 3) % 8 <> (n.w * 5 + 3) % 8
),
sides as (
  select g.*, s.side,
         case when s.side = 'one' then g.one_pick else g.two_pick end as pick,
         case when s.side = 'one' then g.one_who else g.two_who end as who,
         case when s.side = 'one' then g.one_primary else g.two_primary end as mine,
         case when s.side = 'one' then g.two_primary else g.one_primary end as theirs
    from games g
    cross join (values ('one'), ('two')) as s(side)
)
insert into public.game_result_armies (
  source_type, source_id, side, club_id, played_on, profile_id, player_name,
  faction_id, faction_label, detachment, disposition,
  mvp_units, underwhelming_units,
  primary_score, secondary_score, painted, first_turn, battle_role,
  outcome, confirmed, mission, deployment, terrain,
  edition_id, catalogue_version)
select 'booking', s.source_id, s.side,
       (select id from club), s.played_on, pe.profile_id, pe.name,
       pk.faction_id, pk.faction_label, pk.detachment, pk.disposition,
       -- A unit tagged, and which one varies by week, so the units view has
       -- something to compare. The first cut took the same unit every time and
       -- always tagged it as the one that earned it, so every unit in the
       -- tracker read 100% from a full sample: a column of identical cards
       -- that could not be wrong and could not be useful either.
       --
       -- Roughly two thirds earn it, one third does not, and one game in five
       -- tags nothing at all, which is what a club that fills these in
       -- sometimes actually looks like.
       case when s.w % 5 = 4 then '{}'
            when (s.w + case when s.side = 'one' then 0 else 1 end) % 3 = 2 then '{}'
            else coalesce((select array_agg(x.name) from (
              select u.name from public.army_units u
               where u.edition_id = (select id from edition)
                 and u.faction_id = pk.faction_id
               order by u.position, u.name
               offset (s.w / 2) % greatest(1, (
                 select count(*) from public.army_units u2
                  where u2.edition_id = (select id from edition)
                    and u2.faction_id = pk.faction_id))
               limit 1) x), '{}')
       end,
       case when s.w % 5 = 4 then '{}'
            when (s.w + case when s.side = 'one' then 0 else 1 end) % 3 = 2
            then coalesce((select array_agg(x.name) from (
              select u.name from public.army_units u
               where u.edition_id = (select id from edition)
                 and u.faction_id = pk.faction_id
               order by u.position desc, u.name desc
               offset (s.w / 3) % greatest(1, (
                 select count(*) from public.army_units u2
                  where u2.edition_id = (select id from edition)
                    and u2.faction_id = pk.faction_id))
               limit 1) x), '{}')
            else '{}'
       end,
       least(s.mine, 50),
       least(30 + (s.w * 3) % 11, 40),
       (s.w + case when s.side = 'one' then 0 else 1 end) % 3 = 0,
       case when s.side = 'one' then 'first' else 'second' end,
       case when s.side = 'one' then 'attacker' else 'defender' end,
       case when s.mine > s.theirs then 'won'
            when s.mine < s.theirs then 'lost'
            else 'drew' end,
       true,
       (array['Purge the Foe', 'Take and Hold', 'Scorched Earth',
              'Linchpin', 'The Ritual'])[1 + (s.w % 5)],
       (array['dawn-of-war', 'hammer-and-anvil', 'search-and-destroy',
              'sweeping-engagement', 'tipping-point',
              'crucible-of-battle'])[1 + (s.w % 6)],
       (array['Ruins', 'Dense city', 'Open ground'])[1 + (s.w % 3)],
       (select id from edition),
       (select catalogue_version from public.army_editions
         where id = (select id from edition))
  from sides s
  join picks pk on pk.n = s.pick
  join people pe on pe.n = s.who
-- Overwrite rather than skip. `do nothing` made a second run a no-op that
-- printed the same reassuring counts as the first, so a change to the seed
-- looked applied and was not: the rows in the database were still the old
-- ones. A seed you re-run has to be a seed that re-seeds.
on conflict (source_type, source_id, side) do update
  set played_on = excluded.played_on,
      profile_id = excluded.profile_id,
      player_name = excluded.player_name,
      faction_id = excluded.faction_id,
      faction_label = excluded.faction_label,
      detachment = excluded.detachment,
      disposition = excluded.disposition,
      mvp_units = excluded.mvp_units,
      underwhelming_units = excluded.underwhelming_units,
      primary_score = excluded.primary_score,
      secondary_score = excluded.secondary_score,
      painted = excluded.painted,
      first_turn = excluded.first_turn,
      battle_role = excluded.battle_role,
      outcome = excluded.outcome,
      confirmed = excluded.confirmed,
      mission = excluded.mission,
      deployment = excluded.deployment,
      terrain = excluded.terrain,
      edition_id = excluded.edition_id,
      catalogue_version = excluded.catalogue_version;


-- What it wrote, to check before showing anybody. Run it twice and the
-- figures should not move, because the second run replaces what the first
-- wrote rather than adding to it.
select count(*) as army_rows,
       count(distinct source_id) as games,
       min(played_on) as earliest,
       max(played_on) as latest
  from public.game_result_armies where source_id >= 900001;

-- ---------------------------------------------------------------- the revert
--
-- delete from public.game_result_armies where source_id >= 900001;
