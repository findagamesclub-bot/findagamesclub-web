-- 0116 · What a listing costs is a public fact
--
-- `listing_billing_settings` is readable only by `authenticated` (0111), which
-- was right for a table holding bank details, a grace period and a reminder
-- schedule. It was wrong for the one thing on it that the public has to know:
-- the price.
--
-- `/list-your-club` sells listing a club to somebody who has not signed up yet,
-- and the homepage says the same thing to every visitor. Both read the settings,
-- both got nothing, and both fell back to the defaults, which say billing is
-- off. So the site told every prospective club "Free to list" while charging
-- £15 a month, and the only people who could see the real price were the ones
-- who already had an account.
--
-- A function rather than opening the table, because most of that row is not
-- public: the payment instructions carry bank details, and the grace and
-- reminder days are how we chase people. This returns three columns and no
-- more.
--
-- Checked on a throwaway Postgres: anon and authenticated both get the price,
-- the shape matches what the pages read, and nothing else on the row is
-- reachable through it.

create or replace function public.listing_public_prices()
returns table (
  enabled boolean,
  currency text,
  monthly_price_pence integer,
  yearly_price_pence integer
)
language sql
stable
security definer
set search_path = public
as $$
  select enabled, currency, monthly_price_pence, yearly_price_pence
    from public.listing_billing_settings
   where id = 1
$$;

revoke all on function public.listing_public_prices() from public;
grant execute on function public.listing_public_prices() to anon, authenticated;

comment on function public.listing_public_prices() is
  'What listing a club costs, for pages a signed-out visitor reads. Three '
  'columns on purpose: the rest of the settings row is not public.';
