-- 0201 · "Due to renew" follows the tier the member is on now.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

-- Karachi, deliberately, and for two reasons. It is the harness's own zone, so
-- this is what actually runs here; and it is five hours off London, which is
-- what makes a bare `::date` on a timestamptz visibly wrong rather than wrong
-- for one hour a day. `london-days.sql` pins the same thing the same way.
set local timezone = 'Asia/Karachi';

-- A third approved member, so the three cases are three people.
insert into public.club_memberships (club_id, profile_id, status, tier_key, joined_at, created_at)
  select id, 'e0000000-0000-0000-0000-000000000002', 'approved', 'basic', now(), now() from c;

-- ---------------------------------------------------------------- the member
-- Moved off `basic` and back onto it this morning, which is the case
-- `tier_assigned_at` exists for. The stale payment is the LATER of the two, so
-- pooling them does not blur the answer, it hides the renewal completely.
update public.club_memberships set tier_assigned_at = now()
 where profile_id = 'e0000000-0000-0000-0000-000000000003';

insert into public.club_membership_payments
  (club_id, membership_id, profile_id, tier_key, price, period_end_at, created_at)
  select c.id, m.id, m.profile_id, 'basic', 'GBP 10.00',
         now() + interval '300 days', now() - interval '60 days'
    from c, public.club_memberships m
   where m.club_id = c.id and m.profile_id = 'e0000000-0000-0000-0000-000000000003';

insert into public.club_membership_payments
  (club_id, membership_id, profile_id, tier_key, price, period_end_at, created_at)
  select c.id, m.id, m.profile_id, 'basic', 'GBP 10.00',
         now() + interval '20 days', now()
    from c, public.club_memberships m
   where m.club_id = c.id and m.profile_id = 'e0000000-0000-0000-0000-000000000003';

-- ----------------------------------------------------------------- the owner
-- Lapsed five days ago, with a stale payment from an earlier spell that runs
-- to next year. Without the guard this reads as paid up rather than as lapsed.
update public.club_memberships set tier_assigned_at = now() - interval '90 days'
 where profile_id = 'e0000000-0000-0000-0000-000000000001';

insert into public.club_membership_payments
  (club_id, membership_id, profile_id, tier_key, price, period_end_at, created_at)
  select c.id, m.id, m.profile_id, 'basic', 'GBP 10.00',
         now() + interval '200 days', now() - interval '120 days'
    from c, public.club_memberships m
   where m.club_id = c.id and m.profile_id = 'e0000000-0000-0000-0000-000000000001';

insert into public.club_membership_payments
  (club_id, membership_id, profile_id, tier_key, price, period_end_at, created_at)
  select c.id, m.id, m.profile_id, 'basic', 'GBP 10.00',
         now() - interval '5 days', now() - interval '60 days'
    from c, public.club_memberships m
   where m.club_id = c.id and m.profile_id = 'e0000000-0000-0000-0000-000000000001';

-- -------------------------------------------------------------- the boundary
-- Paid to 23:00 London on the thirtieth day out, which is the last day that
-- counts. Read as a London day it is in; read through a +5 session with a bare
-- `::date` it becomes the thirty-first and falls out.
update public.club_memberships set tier_assigned_at = now() - interval '1 day'
 where profile_id = 'e0000000-0000-0000-0000-000000000002';

insert into public.club_membership_payments
  (club_id, membership_id, profile_id, tier_key, price, period_end_at, created_at)
  select c.id, m.id, m.profile_id, 'basic', 'GBP 10.00',
         ((public.london_today() + 30)::timestamp + interval '23 hours')
           at time zone 'Europe/London',
         now()
    from c, public.club_memberships m
   where m.club_id = c.id and m.profile_id = 'e0000000-0000-0000-0000-000000000002';

-- `analytics_allowed` asks who is looking, so this reads as the owner.
select set_config('request.jwt.claims',
  json_build_object('sub', 'e0000000-0000-0000-0000-000000000001',
                    'role', 'authenticated')::text, true);

do $$
declare
  v_club bigint;
  v_health jsonb;
begin
  select id into v_club from c;
  v_health := public.club_analytics_memberships(v_club);

  -- =====================================================================
  -- 1 · The client's own count. A member paid to twenty days out is due,
  --     whatever an earlier spell on the same tier was paid to.
  -- =====================================================================
  if (v_health ->> 'dueSoon')::int <> 2 then
    raise exception 'FAIL 1: dueSoon read % rather than 2', v_health ->> 'dueSoon';
  end if;

  -- =====================================================================
  -- 2 · And the same guard decides who has lapsed. A stale payment running
  --     to next year made a lapsed membership read as paid up.
  -- =====================================================================
  if (v_health ->> 'lapsed')::int <> 1 then
    raise exception 'FAIL 2: lapsed read % rather than 1', v_health ->> 'lapsed';
  end if;

  -- =====================================================================
  -- 3 · Everybody here has paid something on the tier they are on, so the
  --     three above account for the whole roster. Without this a version
  --     that answered null for all three would pass 1 and 2 by arithmetic.
  -- =====================================================================
  if (v_health ->> 'neverPaid')::int <> 0 then
    raise exception 'FAIL 3: neverPaid read % rather than 0', v_health ->> 'neverPaid';
  end if;
  if (v_health ->> 'total')::int <> 3 then
    raise exception 'FAIL 3: total read % rather than 3', v_health ->> 'total';
  end if;

  -- =====================================================================
  -- 4 · The analytics and the chasing reads answer the same question about
  --     the same member, which is the comparison the client made.
  --     `memberships_expiring` (0149) has carried the guard all along, so
  --     this asserts the two now agree rather than trusting that they do.
  --
  --     Not a count: that read measures an exact thirty times twenty-four
  --     hours from `now()` and this one measures thirty London days, so
  --     they are allowed to disagree about somebody sitting on the last
  --     day. The boundary member above is deliberately that person.
  -- =====================================================================
  if not exists (
    select 1 from public.memberships_expiring(interval '30 days') r
     where r.profile_id = 'e0000000-0000-0000-0000-000000000003') then
    raise exception 'FAIL 4: the member the analytics calls due is not due on the chasing read';
  end if;
end $$;

rollback;
\echo 'stage13-due-to-renew: all pass'
