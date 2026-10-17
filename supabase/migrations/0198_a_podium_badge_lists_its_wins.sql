-- Every finish a podium badge stands for, not just the newest one.
--
-- 0167 decided one badge per rank per club rather than one per finish, and
-- that holds: a member who wins five times should not collect five chips with
-- the same name and the same icon, told apart only by their small print.
-- 0182 then made the note name the newest finish and count the rest, which is
-- where "1st place at Oxford Onslaught 5, and 1 more." comes from.
--
-- The client's objection is the half that was wrong: *"you cannot then see the
-- detail of them all"*. They could not. The other win was on the page, in the
-- League and campaign panel, a long way from the badge and with nothing
-- connecting the two. A badge that says "and 1 more" and cannot say what the
-- one is, is a badge asking a question it refuses to answer.
--
-- So the badge keeps its shape and gains its list.
--
-- It returns the AWARD id rather than the club and the rank, so the app never
-- has to select `club_badges.podium_rank`: that column is 0167's and
-- `src/types/database.ts` has not been regenerated since 0151, which
-- `check:columns` is right to refuse.

create or replace function public.member_podium_finishes(p_profile uuid)
returns table (award_id bigint, note text, on_date date)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  select b.id, f.note, f.on_date
    from public.member_badges b
    join public.club_badges cb on cb.id = b.badge_id
    cross join lateral
      public.podium_finishes(b.club_id, b.profile_id, cb.podium_rank) f
   where b.profile_id = p_profile
     and b.revoked_at is null
     and cb.podium_rank is not null
     -- The audience `member_badges_select` already applies to the badge
     -- itself, said again because this is a definer function and RLS has no
     -- say inside one. A reader who cannot see the badge must not be handed
     -- the list of what earned it.
     and (
       p_profile = (select auth.uid())
       or public.is_admin()
       or public.can_manage_club(b.club_id)
       or exists (
         select 1 from public.club_memberships m
          where m.club_id = b.club_id
            and m.profile_id = (select auth.uid())
            and m.status = 'approved')
     )
   -- Newest first, which is the order `podium_finishes` already sorts in and
   -- the order the note names them.
   order by f.on_date desc nulls last, f.note;
end;
$$;

revoke all on function public.member_podium_finishes(uuid) from public, anon;
grant execute on function public.member_podium_finishes(uuid) to authenticated;
