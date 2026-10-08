-- 0170 · The people who run a club can read a member's record
--
-- 0166 guarded `member_overall_record` on a shared approved membership, which
-- is the audience `member_badges_select` and `member_loyalty_standing` use and
-- is right for a clubmate. It leaves two people out, and the first of them is
-- the one most likely to be looking:
--
--   a site admin holds no `club_memberships` row anywhere, so the panel was
--   empty on every profile they opened. This is the same gap 0128's club
--   moderation had and CLAUDE.md already writes down: `club_can` is false for
--   an admin with no team row, and anything guarded by membership needs
--   `is_admin()` saying so out loud.
--
--   a club's owner or manager need not be an approved member of their own
--   club. `can_manage_club` is the predicate for "somebody who runs this
--   club" and it is what every other club-side read asks.
--
-- Found by opening a real profile as the admin and getting nothing, with the
-- grudge tracker underneath it reading nine games. Measured rather than
-- reasoned about: as the member the same call answered 1 and as the admin 0.
--
-- A helper is deliberately still out. Helpers are opted in one capability at a
-- time (0069) and somebody's whole playing record across every club they
-- belong to is not one of the three they were given.

create or replace function public.member_overall_record(p_profile uuid)
returns table (
  source text, played integer, wins integer, draws integer, losses integer
)
language sql stable security definer set search_path = public as $$
  with allowed as (
    select
      -- Themselves.
      p_profile = auth.uid()
      -- A site admin, who holds no membership row to share.
      or public.is_admin()
      -- Somebody approved at a club they are both approved at.
      or exists (
        select 1
          from public.club_memberships mine
          join public.club_memberships theirs
            on theirs.club_id = mine.club_id
         where mine.profile_id = auth.uid()   and mine.status = 'approved'
           and theirs.profile_id = p_profile  and theirs.status = 'approved')
      -- Or somebody who runs a club this person is a member of, whether or
      -- not they are a member of it themselves.
      or exists (
        select 1
          from public.club_memberships theirs
         where theirs.profile_id = p_profile
           and theirs.status = 'approved'
           and public.can_manage_club(theirs.club_id))
      as ok
  ),
  nights as (
    select
      case when b.booked_by = p_profile then b.booked_by_score else b.opponent_score end as mine,
      case when b.booked_by = p_profile then b.opponent_score else b.booked_by_score end as theirs
      from public.club_bookings b, allowed
     where allowed.ok
       and b.status = 'booked'
       -- Both scores, which is what makes it a game somebody played. The
       -- confirmation is the club's housekeeping and is not asked about here
       -- (0169).
       and b.booked_by_score is not null
       and b.opponent_score is not null
       and p_profile in (b.booked_by, b.opponent_profile_id, b.accepted_by)
  ),
  tables as (
    select a.outcome
      from public.game_result_armies a, allowed
     where allowed.ok
       and a.source_type = 'event_pairing'
       and a.profile_id = p_profile
       -- A table whose score nobody has typed yet carries '' and is not a
       -- game anybody has played. A podium is already out by source_type.
       and a.outcome <> ''
  ),
  leagues as (
    select s.wins, s.draws, s.losses
      from public.club_competition_standings s, allowed
     where allowed.ok and s.profile_id = p_profile
  )
  select 'club', count(*)::integer,
         count(*) filter (where mine > theirs)::integer,
         count(*) filter (where mine = theirs)::integer,
         count(*) filter (where mine < theirs)::integer
    from nights
  union all
  select 'event', count(*)::integer,
         count(*) filter (where outcome = 'won')::integer,
         count(*) filter (where outcome = 'drew')::integer,
         count(*) filter (where outcome = 'lost')::integer
    from tables
  union all
  select 'league',
         coalesce(sum(wins + draws + losses), 0)::integer,
         coalesce(sum(wins), 0)::integer,
         coalesce(sum(draws), 0)::integer,
         coalesce(sum(losses), 0)::integer
    from leagues
$$;

revoke all on function public.member_overall_record(uuid) from public, anon;
grant execute on function public.member_overall_record(uuid) to authenticated;
