-- 0056 · One member's playing record at one club
--
-- Legacy's member profile carries a "Grudge tracker": how that member has done
-- at each club, who their biggest rivals are, and their recent form
-- (club_store.py:21600, `_build_member_grudge_tracker_for_club`). Ours had
-- none of it on another member's page. The same figures exist on your own
-- dashboard, which is not what the client was looking at.
--
-- It cannot be read through RLS. club_bookings_select (0014) shows a club
-- member only FUTURE bookings of other people, so a reader can see that two
-- members are playing on Thursday and nothing about last season. That is the
-- right default for the table, and wrong for a profile page that is meant to
-- show a record.
--
-- So this is a security definer function with the same guard the rivalry
-- functions use: approved members of the club, and whoever manages it. It runs
-- as its owner, so without that check any signed-in person could read any
-- club's results by passing its id.

create or replace function public.club_member_games(p_club bigint, p_member uuid)
returns table (
  ref_id bigint,
  source text,
  played_on date,
  game_title text,
  competition text,
  opponent_id uuid,
  opponent_name text,
  my_score integer,
  their_score integer
)
language sql
stable
security definer
set search_path = public
as $$
  -- Competition matches name their players in free text. A name held by two
  -- approved members is dropped rather than guessed at, the same rule 0055
  -- uses: attributing somebody else's loss to you is worse than leaving the
  -- game out.
  with roster as (
    select min(pr.id::text)::uuid as id, lower(btrim(pr.full_name)) as folded
    from public.club_memberships cm
    join public.profiles pr on pr.id = cm.profile_id
    where cm.club_id = p_club
      and cm.status = 'approved'
      and btrim(pr.full_name) <> ''
    group by lower(btrim(pr.full_name))
    having count(*) = 1
  ),
  me as (
    select lower(btrim(full_name)) as folded
    from public.profiles
    where id = p_member and btrim(full_name) <> ''
  ),
  bookings as (
    select
      b.id                                       as ref_id,
      'booking'::text                            as source,
      b.session_date                             as played_on,
      coalesce(nullif(btrim(b.game_title), ''), 'Club game') as game_title,
      'Club game booking'::text                  as competition,
      (case when b.booked_by = p_member then b.opponent_profile_id else b.booked_by end) as opponent_id,
      coalesce(
        nullif(btrim(case when b.booked_by = p_member then o.full_name else k.full_name end), ''),
        nullif(btrim(b.opponent_name), ''),
        'Club member')                           as opponent_name,
      (case when b.booked_by = p_member then b.booked_by_score else b.opponent_score end)::integer as my_score,
      (case when b.booked_by = p_member then b.opponent_score else b.booked_by_score end)::integer as their_score
    from public.club_bookings b
    left join public.profiles o on o.id = b.opponent_profile_id
    left join public.profiles k on k.id = b.booked_by
    where b.club_id = p_club
      and b.status = 'booked'
      and b.booked_by_score is not null
      and b.opponent_score is not null
      and (b.booked_by = p_member or b.opponent_profile_id = p_member)
  ),
  competitions as (
    select
      m.id                                       as ref_id,
      'competition'::text                        as source,
      u.posted_on                                as played_on,
      coalesce(nullif(btrim(c.game), ''), 'Club game')    as game_title,
      coalesce(nullif(btrim(c.title), ''), 'Competition') as competition,
      -- The opponent need not be a registered member; legacy keeps the name
      -- either way, and a record with the losses left out is not a record.
      (case when lower(btrim(m.player_one)) = me.folded then r2.id else r1.id end) as opponent_id,
      (case when lower(btrim(m.player_one)) = me.folded
            then btrim(m.player_two) else btrim(m.player_one) end)                 as opponent_name,
      (case when lower(btrim(m.player_one)) = me.folded
            then btrim(m.player_one_score)::integer
            else btrim(m.player_two_score)::integer end)                           as my_score,
      (case when lower(btrim(m.player_one)) = me.folded
            then btrim(m.player_two_score)::integer
            else btrim(m.player_one_score)::integer end)                           as their_score
    from public.club_competition_matches m
    join public.club_competition_updates u on u.id = m.update_id
    join public.club_competitions c on c.id = u.competition_id
    cross join me
    left join roster r1 on r1.folded = lower(btrim(m.player_one))
    left join roster r2 on r2.folded = lower(btrim(m.player_two))
    where c.club_id = p_club
      and (lower(btrim(m.player_one)) = me.folded or lower(btrim(m.player_two)) = me.folded)
      and lower(btrim(m.player_one)) <> lower(btrim(m.player_two))
      -- Clubs type these in by hand, so "3 - 1" and "n/a" both turn up. Only a
      -- plain number is a score; anything else is a note.
      and btrim(m.player_one_score) ~ '^-?[0-9]+$'
      and btrim(m.player_two_score) ~ '^-?[0-9]+$'
  )
  select * from (
    select * from bookings
    union all
    select * from competitions
  ) g
  where public.is_club_member(p_club) or public.can_manage_club(p_club)
  order by g.played_on desc nulls last, g.ref_id desc;
$$;

revoke all on function public.club_member_games(bigint, uuid) from public, anon;
grant execute on function public.club_member_games(bigint, uuid) to authenticated;
