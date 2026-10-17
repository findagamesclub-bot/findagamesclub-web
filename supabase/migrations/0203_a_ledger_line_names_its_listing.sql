-- 0203 · a line in the ledger with no club on it
--
-- Driving 9b turned one up: a listing fee of £15 with an empty Club column.
-- It is a payment taken at the desk for a listing that has not become a club
-- yet, so `listing_payments.club_id` and `listing_subscriptions.club_id` are
-- both null and there was nothing left to name it with. Correct, and useless
-- in a tax file: a treasurer reading an amount with no payer beside it has to
-- go and find out which listing it was.
--
-- `listing_subscriptions.submission_id` is what 0112 opens the subscription
-- against, and the submission carries the name the club typed. So the column
-- falls back to it, which is the only other name anybody has for that money.
--
-- Same arguments and the same return type, so `create or replace` is enough.
-- Everything else is 0202's own text with two lines changed.

create or replace function public.admin_revenue_lines(
  p_from date default null, p_to date default null
) returns table (
  kind          text,
  received      boolean,
  on_date       date,
  club_id       bigint,
  club_name     text,
  club_slug     text,
  plan          text,
  period_start  date,
  period_end    date,
  amount_pence  integer,
  currency      text,
  method        text,
  reference     text,
  note          text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_from date := coalesce(p_from, '1900-01-01'::date);
  v_to   date := coalesce(p_to, public.london_today());
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  return query
  select 'listing'::text,
         true,
         l.paid_at,
         c.id,
         -- The club, or the name on the listing that has not become one yet.
         coalesce(nullif(c.name, ''), sub.club_name, ''),
         coalesce(c.slug::text, ''),
         coalesce(s.plan_interval, ''),
         l.period_start::date,
         l.period_end::date,
         l.amount_pence,
         l.currency,
         l.method,
         l.reference,
         l.note
    from public.listing_payments l
    left join public.listing_subscriptions s on s.id = l.subscription_id
    left join public.clubs c on c.id = coalesce(l.club_id, s.club_id)
    left join public.club_submissions sub on sub.id = s.submission_id
   where l.kind = 'subscription'
     and l.paid_at between v_from and v_to

  union all

  select 'featured'::text,
         false,
         f.starts_on,
         c.id,
         coalesce(c.name, ''),
         coalesce(c.slug::text, ''),
         ''::text,
         f.starts_on,
         f.ends_on,
         f.price_pence,
         f.currency,
         ''::text,
         ''::text,
         f.note
    from public.featured_listings f
    left join public.clubs c on c.id = f.club_id
   where f.starts_on between v_from and v_to

   order by 3 desc, 5;
end $$;

revoke all on function public.admin_revenue_lines(date, date) from public, anon;
grant execute on function public.admin_revenue_lines(date, date) to authenticated;
