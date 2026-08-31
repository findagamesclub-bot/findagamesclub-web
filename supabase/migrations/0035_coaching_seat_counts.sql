-- 0035 · Coaching slots showed more places than they had
--
-- Places left was worked out from the bookings the reader could see. A member
-- cannot see another member's coaching booking, so every slot looked emptier
-- than it was: a full slot advertised a free place, the Book button was live,
-- and the insert then failed with SLOT_FULL. The club owner was the only
-- person who saw the true count, which is why it looked fine in testing.
--
-- Counted here instead, past RLS, returning nothing but numbers.

create or replace function public.club_coaching_seats(p_club bigint)
returns table (
  slot_id bigint,
  taken integer
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, count(b.id) filter (where b.status = 'booked')::integer
    from public.club_coaching_slots s
    left join public.club_coaching_bookings b on b.slot_id = s.id
   where s.club_id = p_club
     -- Coaching is members-only, so the count is too. A visitor gets nothing
     -- rather than a picture of how busy the club is.
     and (public.is_club_member(p_club) or public.can_manage_club(p_club))
   group by s.id;
$$;

revoke all on function public.club_coaching_seats(bigint) from public, anon;
grant execute on function public.club_coaching_seats(bigint) to authenticated;
