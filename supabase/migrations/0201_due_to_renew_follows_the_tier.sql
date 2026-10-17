-- 0201 · "Due to renew 0" over a renewals tab reading "Due soon 1"
--
-- The client counted them. Didcot's analytics said nobody was due inside
-- thirty days while the renewals tab, two clicks away, named the member and
-- the date: Gulnabi Afridi, paid to 16 Nov 2026, which is thirty days out.
--
-- Both screens are asking "what is this membership paid up to", and only one
-- of them was asking it properly.
--
-- CLAUDE.md has carried the rule since Stage 2, in capitals: membership
-- payment standing is scoped to the CURRENT tier, and `tier_key` alone cannot
-- express that. Basic to Premium and back to Basic resurrects the first
-- Basic payments, which is why `club_memberships.tier_assigned_at` exists and
-- why `standing()` in `utils/membership-billing.ts` counts only payments that
-- match the key AND land on or after the day the tier was assigned.
--
-- `club_analytics_memberships` matched the key and nothing else. Measured on
-- the live data rather than reasoned about: Gulnabi's membership carries three
-- payments on the current tier key, and two of them were recorded in September
-- under an earlier spell on that tier, ending 10 Sep 2027 and 30 Sep 2027. So
-- `max(period_end_at)` came back as 2027, which is not inside thirty days and
-- is not in the past either. The member fell out of `dueSoon` and out of
-- `lapsed` both, and the tile read 0 with nothing anywhere saying why.
--
-- The clause added here is not invented. `memberships_expiring` (0149),
-- `memberships_lapsed` (0149) and the expiry job (0028) all already carry it,
-- word for word. Four readers of one question and one of them was missing the
-- guard, which is this codebase's most frequent shape: a guard applied to some
-- of a set of siblings and not the rest.
--
-- Two smaller things fixed in the same pass, both rules this file already
-- states:
--
--   * `period_end_at::date` is a bare cast on a timestamptz, which reads the
--     SESSION timezone (0123). Every club date here is a London day.
--   * `lapsed` and `dueSoon` both re-read `london_today()`, so a request
--     crossing midnight could count somebody in neither. One value, read once.

create or replace function public.club_analytics_memberships(
  p_club bigint, p_from date default null, p_to date default null
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_from  date := coalesce(p_from, public.london_today() - 36500);
  v_to    date := coalesce(p_to, public.london_today());
  v_today date := public.london_today();
begin
  perform public.analytics_allowed(p_club);
  return (
  with
  live as (
    select m.id, m.profile_id, m.tier_key,
           coalesce(nullif(m.tier_key, ''), 'none') as tier,
           public.london_day(coalesce(m.joined_at, m.created_at)) as joined_on,
           (select public.london_day(max(p.period_end_at))
              from public.club_membership_payments p
             where p.membership_id = m.id
               and p.tier_key is not distinct from m.tier_key
               -- The half that was missing. A payment taken during an earlier
               -- spell on this same tier is not what the member is paid up to
               -- now, and it is always the LATER date, so pooling them does
               -- not merely blur the answer: it hides the renewal entirely.
               and (m.tier_assigned_at is null
                    or p.created_at >= m.tier_assigned_at)) as paid_to
      from public.club_memberships m
     where m.club_id = p_club and m.status = 'approved'
  ),
  labels as (
    -- The club's own name for the tier, not its key. A roster reading
    -- "premium-membership" is the database talking to itself.
    select t.tier_key, coalesce(nullif(btrim(t.label), ''), t.tier_key) as label
      from public.club_membership_tiers t where t.club_id = p_club
  ),
  loyalty as (
    select l.profile_id, sum(l.lifetime_delta) as lifetime
      from public.club_loyalty_transactions l
     where l.club_id = p_club
       and l.profile_id in (select profile_id from live)
     group by l.profile_id
  )
  select jsonb_build_object(
    'byTier', coalesce((
      select jsonb_agg(row_to_json(t) order by t.members desc, t.tier)
        from (
          select v.tier,
                 coalesce(lb.label, initcap(replace(v.tier, '-', ' '))) as label,
                 count(*) as members,
                 count(*) filter (where v.joined_on between v_from and v_to) as joined
            from live v
            left join labels lb on lb.tier_key = v.tier
           group by v.tier, lb.label) t), '[]'::jsonb),

    -- One number per member on the roster, zero included: somebody who has
    -- never earned a point is on the bottom rung rather than absent from the
    -- ladder, and a club reading "nobody is on Bronze" would be reading a
    -- missing row rather than a fact.
    'lifetime', coalesce((
      select jsonb_agg(coalesce(ly.lifetime, 0) order by coalesce(ly.lifetime, 0) desc)
        from live v left join loyalty ly on ly.profile_id = v.profile_id), '[]'::jsonb),

    'dueSoon',  (select count(*) from live
                  where paid_to is not null
                    and paid_to between v_today and v_today + 30),
    'lapsed',   (select count(*) from live
                  where paid_to is not null and paid_to < v_today),
    'neverPaid',(select count(*) from live where paid_to is null),
    'total',    (select count(*) from live),
    'joined',   (select count(*) from live where joined_on between v_from and v_to)
  ));
end $$;

revoke all on function public.club_analytics_memberships(bigint, date, date)
  from public, anon;
grant execute on function public.club_analytics_memberships(bigint, date, date)
  to authenticated;
