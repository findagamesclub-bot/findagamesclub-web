/**
 * A clubmate can see what rung somebody is on.
 *
 * The client asked for it in their own words: "Loyalty tier and status is
 * missing for each club from the users profile member page. Please add this
 * next to membership status for each."
 *
 * `club_loyalty_transactions_read` (0020) is own-rows-or-a-manager, which is
 * right for a ledger: what somebody spent and when is theirs. So a profile page
 * read through RLS shows a clubmate nothing at all, and the only way to answer
 * the question is a definer function that hands back strictly less than the
 * table does.
 *
 * **Lifetime only, never `available`.** Lifetime is a rank and it is already on
 * screen wherever a club's own leaderboard is; available is a balance somebody
 * can spend, which is money-adjacent and nobody else's business. The split
 * exists in the ledger precisely because the two mean different things.
 *
 * The audience is the one `member_badges_select` already uses for the same kind
 * of fact: both people approved at the same club. A loyalty tier is a rank a
 * club awarded, which is what a badge is.
 *
 * The ladder itself is not computed here. `tierFor` in TypeScript is the one
 * implementation of which rung a total reaches, and a second one in SQL would
 * be a second thing to get wrong; this returns the total and the caller reads
 * the club's own tiers as it already does.
 *
 * Checked on a throwaway Postgres built from every migration with
 * supabase/tests/stage12-loyalty-standing.sql: a clubmate sees the total, a
 * stranger sees nothing, a club nobody shares returns no row, and the spendable
 * balance is not reachable through it at all.
 */

create or replace function public.member_loyalty_standing(
  p_profile uuid,
  p_clubs   bigint[]
)
returns table (club_id bigint, lifetime integer)
language sql
stable
security definer
set search_path = public
as $$
  select t.club_id, coalesce(sum(t.lifetime_delta), 0)::integer
    from public.club_loyalty_transactions t
    join public.club_loyalty_settings s on s.club_id = t.club_id
   where t.profile_id = p_profile
     and t.club_id = any (coalesce(p_clubs, '{}'::bigint[]))
     -- A club that has switched the scheme off has no standing to report.
     and s.enabled
     -- The reader has to be in the club, and so does the person being read.
     -- `is_club_member` reads auth.uid() from the request, which is what lets a
     -- definer function ask it about the caller.
     and public.is_club_member(t.club_id)
     and exists (
       select 1 from public.club_memberships m
        where m.club_id = t.club_id
          and m.profile_id = p_profile
          and m.status = 'approved')
   group by t.club_id
$$;

revoke all on function public.member_loyalty_standing(uuid, bigint[]) from public, anon;
grant execute on function public.member_loyalty_standing(uuid, bigint[]) to authenticated;
