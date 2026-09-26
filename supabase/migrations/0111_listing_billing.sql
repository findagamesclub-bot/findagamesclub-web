-- 0111 · What a listing costs, and whether it has been paid for
--
-- Legacy charges for a listing (`listing_billing.py`,
-- `club-listing-billing-settings.json`) through a mock Stripe checkout that was
-- never wired up: `StripeListingBillingProvider` raises on every call. So the
-- only billing that has ever worked there is somebody looking at a JSON file.
--
-- This is the offline half, which is what the client actually does today:
-- cheques, bank transfers and cash, recorded by hand. Stripe is a later
-- decision and the columns for it are here so that decision does not need a
-- migration; nothing reads them.
--
-- Three rules copied from legacy exactly:
--
--   · 30 days for monthly, 365 for yearly (`next_renewal_date`, line 104)
--   · a subscription must be `active` or `cancel_at_period_end` before its
--     listing may be approved (club_store.py:12455)
--   · the statuses themselves, including `not_required` for a club that was
--     listed while billing was switched off
--
-- One deliberate departure, and it is the client question the plan flagged:
-- legacy always dates the new period from `paid_at`, so a club that pays a week
-- late loses that week. Here a payment extends from whichever is later, the
-- period end or the pay date, so paying early adds to what you have and paying
-- late does not shorten it.
--
-- **Money is pence, always.** Legacy stores "GBP 15" as a string and parses it
-- at the point of use. A price the browser can name is a price the browser can
-- choose, and a price stored as text is a price somebody eventually adds to
-- another string.
--
-- **Standing is computed on read, never stored.** A club is not "lapsed"
-- because a job ran; it is lapsed because the date passed. Storing it means a
-- club whose grace expires on a Sunday is only lapsed once somebody's cron
-- wakes up. The view is the authority and the cron only sends the letters.
--
-- Checked on a throwaway Postgres: a member reads the settings and writes
-- nothing; an admin changes them; recording a payment moves a subscription from
-- awaiting to active and sets the period a month out; a second payment extends
-- from the period end rather than from today; a late payment extends from the
-- pay date; standing walks active, in grace and lapsed as the dates move; the
-- ledger refuses updates and deletes to everybody including an admin; and a
-- non-admin recording a payment is refused.

-- ------------------------------------------------------------------ settings

create table if not exists public.listing_billing_settings (
  id                    integer primary key default 1 check (id = 1),

  -- Off until somebody turns it on. Every listing already in the directory was
  -- taken on for free, and switching this on must not make them all lapse.
  enabled               boolean not null default false,

  currency              text not null default 'GBP',
  monthly_price_pence   integer not null default 1500 check (monthly_price_pence >= 0),
  yearly_price_pence    integer not null default 15000 check (yearly_price_pence >= 0),

  grace_period_days     integer not null default 7 check (grace_period_days >= 0),
  -- Days before the period ends to write to them. Legacy has no reminders at
  -- all, so a club's first news of a lapse was its listing going.
  reminder_days         integer[] not null default '{14,3}',

  featured_price_pence  integer not null default 2000 check (featured_price_pence >= 0),
  featured_duration_days integer not null default 7 check (featured_duration_days > 0),

  -- The client's call, and the plan's recommendation is the default: an admin
  -- decides, because a listing vanishing on its own is how a club finds out it
  -- lapsed from a member rather than from us.
  auto_hide_lapsed      boolean not null default false,

  provider_mode         text not null default 'offline'
                          check (provider_mode in ('offline', 'stripe')),
  stripe_product_id     text not null default '',
  stripe_monthly_price_id text not null default '',
  stripe_yearly_price_id  text not null default '',

  -- Shown to the owner on their billing page. Markdown, rendered the same way
  -- the legal pages are.
  payment_instructions_md text not null default '',

  updated_at            timestamptz not null default now(),
  updated_by            uuid references public.profiles (id) on delete set null
);

insert into public.listing_billing_settings (id) values (1) on conflict (id) do nothing;

alter table public.listing_billing_settings enable row level security;
revoke insert, update, delete on public.listing_billing_settings from authenticated, anon;
grant select on public.listing_billing_settings to authenticated;

-- Readable by anybody signed in, because the owner's billing page has to say
-- what a listing costs and how to pay. Not by `anon`: the prices are not a
-- public price list until somebody decides they are.
drop policy if exists listing_billing_settings_read on public.listing_billing_settings;
create policy listing_billing_settings_read on public.listing_billing_settings
  for select to authenticated using (true);

drop policy if exists listing_billing_settings_write on public.listing_billing_settings;
create policy listing_billing_settings_write on public.listing_billing_settings
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Named columns rather than the table, so a future column is not writable by
-- accident. `id` is absent: there is one row and it stays row one.
grant update (
  enabled, currency, monthly_price_pence, yearly_price_pence,
  grace_period_days, reminder_days, featured_price_pence, featured_duration_days,
  auto_hide_lapsed, provider_mode, stripe_product_id,
  stripe_monthly_price_id, stripe_yearly_price_id, payment_instructions_md
) on public.listing_billing_settings to authenticated;

create or replace function public.listing_billing_settings_stamp()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end $$;

revoke all on function public.listing_billing_settings_stamp() from public, anon, authenticated;

drop trigger if exists listing_billing_settings_stamped on public.listing_billing_settings;
create trigger listing_billing_settings_stamped
  before update on public.listing_billing_settings
  for each row execute function public.listing_billing_settings_stamp();

-- ------------------------------------------------------------- subscriptions

create table if not exists public.listing_subscriptions (
  id              bigint generated always as identity primary key,

  club_id         bigint references public.clubs (id) on delete cascade,
  -- Set while the listing is still a submission, so a club can pay before it
  -- is approved, which is the order legacy uses.
  submission_id   bigint references public.club_submissions (id) on delete set null,
  owner_id        uuid not null references public.profiles (id) on delete cascade,

  plan_interval   text not null default 'monthly'
                    check (plan_interval in ('monthly', 'yearly')),

  -- Legacy's vocabulary, plus `expired`, which legacy has no word for because
  -- nothing there ever ends a subscription.
  status          text not null default 'payment_pending' check (status in (
    'payment_pending', 'active', 'payment_failed',
    'cancel_at_period_end', 'cancelled', 'expired', 'not_required')),

  price_pence     integer not null default 0 check (price_pence >= 0),
  currency        text not null default 'GBP',

  current_period_start date,
  current_period_end   date,

  -- Stripe's, when that day comes. Nothing reads these.
  provider_customer_id     text not null default '',
  provider_subscription_id text not null default '',

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- One live subscription per club. A second would make "what does this club
-- owe" a question with two answers.
create unique index if not exists listing_subscriptions_one_live
  on public.listing_subscriptions (club_id)
  where club_id is not null
    and status in ('payment_pending', 'active', 'cancel_at_period_end');

create index if not exists listing_subscriptions_due_idx
  on public.listing_subscriptions (current_period_end)
  where status in ('active', 'cancel_at_period_end');

create index if not exists listing_subscriptions_owner_idx
  on public.listing_subscriptions (owner_id);

alter table public.listing_subscriptions enable row level security;
revoke insert, update, delete on public.listing_subscriptions from authenticated, anon;
grant select on public.listing_subscriptions to authenticated;

-- The club can read its own; an admin reads every one. Nobody writes: the
-- functions below are the only way in, because a club that could name its own
-- status could mark itself paid.
drop policy if exists listing_subscriptions_read on public.listing_subscriptions;
create policy listing_subscriptions_read on public.listing_subscriptions
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    or public.is_admin()
    or (club_id is not null
        and coalesce(public.club_role_of(club_id), '') in ('owner', 'manager', 'admin'))
  );

-- --------------------------------------------------------------- the ledger

create table if not exists public.listing_payments (
  id              bigint generated always as identity primary key,

  subscription_id bigint not null
                    references public.listing_subscriptions (id) on delete cascade,
  club_id         bigint references public.clubs (id) on delete set null,

  kind            text not null default 'subscription'
                    check (kind in ('subscription', 'featured')),

  amount_pence    integer not null check (amount_pence > 0),
  currency        text not null default 'GBP',

  paid_at         date not null,
  method          text not null default 'other'
                    check (method in ('cheque', 'bank_transfer', 'cash', 'card', 'other')),
  reference       text not null default '',
  note            text not null default '',

  -- What this payment bought, stamped at the time. A price change later must
  -- not rewrite what somebody was charged.
  period_start    date,
  period_end      date,

  recorded_by     uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists listing_payments_club_idx
  on public.listing_payments (club_id, paid_at desc);
create index if not exists listing_payments_subscription_idx
  on public.listing_payments (subscription_id, paid_at desc);

alter table public.listing_payments enable row level security;

-- Insert-only, and not even that from a client. A ledger that can be edited
-- cannot be audited, which is the same rule the loyalty ledger follows.
revoke insert, update, delete on public.listing_payments from authenticated, anon;
grant select on public.listing_payments to authenticated;

drop policy if exists listing_payments_read on public.listing_payments;
create policy listing_payments_read on public.listing_payments
  for select to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.listing_subscriptions s
                where s.id = subscription_id and s.owner_id = (select auth.uid()))
    or (club_id is not null
        and coalesce(public.club_role_of(club_id), '') in ('owner', 'manager', 'admin'))
  );

-- ------------------------------------------------------------- standing view

/**
 * Where every subscription stands today.
 *
 * Computed, never stored. A club is not lapsed because a job ran; it is lapsed
 * because the date passed, and storing the answer means a club whose grace ends
 * on a Sunday is only lapsed once somebody's cron wakes up on Monday.
 *
 * `security_invoker` so the row policies above still decide who sees what. A
 * definer view here would hand every club's money to anybody who asked.
 */
create or replace view public.listing_subscription_standing
with (security_invoker = true) as
select
  s.*,
  g.grace_period_days,
  (s.current_period_end + g.grace_period_days) as grace_ends_on,
  case
    when s.status = 'not_required'    then 'not_required'
    when s.status = 'cancelled'       then 'cancelled'
    when s.status = 'payment_pending' then 'awaiting_payment'
    when s.status = 'payment_failed'  then 'payment_failed'
    when s.current_period_end is null then 'awaiting_payment'
    when s.current_period_end >= public.london_today() then 'active'
    when s.current_period_end + g.grace_period_days >= public.london_today()
      then 'in_grace'
    else 'lapsed'
  end as standing
from public.listing_subscriptions s
cross join (select grace_period_days from public.listing_billing_settings where id = 1) g;

grant select on public.listing_subscription_standing to authenticated;

-- ------------------------------------------------------------- the functions

/**
 * How long a plan runs, copied from legacy's `next_renewal_date` (line 104).
 *
 * Days rather than months, which is what legacy does and what the client's own
 * records already assume. A month is 30 days here even in February.
 */
create or replace function public.listing_plan_days(p_interval text)
returns integer language sql immutable as $$
  select case when lower(coalesce(p_interval, '')) = 'yearly' then 365 else 30 end
$$;

grant execute on function public.listing_plan_days(text) to authenticated;

/**
 * Open a subscription for a club or a submission.
 *
 * Admin only, and idempotent: a club that already has a live one gets that one
 * back rather than a second. `not_required` when billing is switched off, so
 * every listing carries a row saying so rather than a null somebody has to
 * interpret.
 */
create or replace function public.start_listing_subscription(
  p_club bigint, p_submission bigint, p_owner uuid, p_interval text default 'monthly'
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_id      bigint;
  v_on      boolean;
  v_price   integer;
  v_clean   text := case when lower(coalesce(p_interval, '')) = 'yearly'
                         then 'yearly' else 'monthly' end;
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  if p_owner is null then
    raise exception 'SUBSCRIPTION_NEEDS_OWNER' using errcode = 'check_violation';
  end if;

  if p_club is not null then
    select id into v_id from public.listing_subscriptions
     where club_id = p_club
       and status in ('payment_pending', 'active', 'cancel_at_period_end')
     limit 1;
    if v_id is not null then return v_id; end if;
  end if;

  select enabled,
         case when v_clean = 'yearly' then yearly_price_pence else monthly_price_pence end
    into v_on, v_price
    from public.listing_billing_settings where id = 1;

  insert into public.listing_subscriptions
    (club_id, submission_id, owner_id, plan_interval, status, price_pence)
  values (p_club, p_submission, p_owner, v_clean,
          case when coalesce(v_on, false) then 'payment_pending' else 'not_required' end,
          case when coalesce(v_on, false) then coalesce(v_price, 0) else 0 end)
  returning id into v_id;

  return v_id;
end $$;

revoke all on function public.start_listing_subscription(bigint, bigint, uuid, text)
  from public, anon;
grant execute on function public.start_listing_subscription(bigint, bigint, uuid, text)
  to authenticated;

/**
 * Write a payment down, and move the subscription on.
 *
 * The whole of offline billing is this one function. It is admin-only because
 * a club that could record its own payment has not paid anybody.
 *
 * The period extends from **whichever is later**, the current end or the pay
 * date. Legacy always dates from the pay date, so a club that pays a week late
 * silently buys three weeks; and a club paying early would lose whatever it had
 * left. Later-of is the only version where both are fair.
 */
create or replace function public.record_listing_payment(
  p_subscription bigint,
  p_amount_pence integer,
  p_method       text,
  p_paid_at      date default null,
  p_reference    text default '',
  p_note         text default ''
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_sub   public.listing_subscriptions%rowtype;
  v_paid  date := coalesce(p_paid_at, public.london_today());
  v_from  date;
  v_to    date;
  v_id    bigint;
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  if coalesce(p_amount_pence, 0) <= 0 then
    raise exception 'PAYMENT_NEEDS_AMOUNT' using errcode = 'check_violation';
  end if;

  select * into v_sub from public.listing_subscriptions
   where id = p_subscription for update;

  if v_sub.id is null then
    raise exception 'SUBSCRIPTION_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  if v_sub.status = 'cancelled' then
    raise exception 'SUBSCRIPTION_CANCELLED' using errcode = 'check_violation';
  end if;

  -- Later of the two, which is the whole rule.
  v_from := greatest(coalesce(v_sub.current_period_end, v_paid), v_paid);
  v_to   := v_from + public.listing_plan_days(v_sub.plan_interval);

  insert into public.listing_payments
    (subscription_id, club_id, kind, amount_pence, currency, paid_at, method,
     reference, note, period_start, period_end, recorded_by)
  values (v_sub.id, v_sub.club_id, 'subscription', p_amount_pence, v_sub.currency,
          v_paid, coalesce(nullif(btrim(p_method), ''), 'other'),
          coalesce(p_reference, ''), coalesce(p_note, ''),
          v_from, v_to, (select auth.uid()))
  returning id into v_id;

  update public.listing_subscriptions
     set status = case when status = 'cancel_at_period_end'
                       then 'cancel_at_period_end' else 'active' end,
         current_period_start = coalesce(current_period_start, v_from),
         current_period_end   = v_to,
         updated_at = now()
   where id = v_sub.id;

  -- A club hidden for lapsing comes back the moment it pays. Only that reason,
  -- so recording a payment cannot lift a suspension an admin meant.
  if v_sub.club_id is not null then
    update public.clubs set status = 'active', updated_at = now()
     where id = v_sub.club_id and status = 'suspended'
       and exists (select 1 from public.listing_billing_settings
                    where id = 1 and auto_hide_lapsed);
  end if;

  return v_id;
end $$;

revoke all on function public.record_listing_payment(bigint, integer, text, date, text, text)
  from public, anon;
grant execute on function public.record_listing_payment(bigint, integer, text, date, text, text)
  to authenticated;

/**
 * Who is due a letter, for the cron route.
 *
 * `reminder` is anybody whose period ends on one of the configured days from
 * now; `ending` is the day itself; `grace_over` is the day grace runs out.
 * Exact dates rather than ranges, so a job that runs twice in a day does not
 * write twice, and the route's own dedupe only has to cover a missed day.
 */
create or replace function public.listing_subscriptions_due(p_stage text)
returns table (
  subscription_id bigint, club_id bigint, owner_id uuid,
  club_name text, club_slug text, period_end date, days_left integer,
  price_pence integer, plan_interval text
)
language sql stable security definer set search_path = public as $$
  select s.id, s.club_id, s.owner_id,
         coalesce(c.name, ''), coalesce(c.slug, ''),
         s.current_period_end,
         (s.current_period_end - public.london_today())::integer,
         s.price_pence, s.plan_interval
    from public.listing_subscriptions s
    left join public.clubs c on c.id = s.club_id
    cross join (select grace_period_days, reminder_days
                  from public.listing_billing_settings where id = 1) g
   where s.status in ('active', 'cancel_at_period_end')
     and s.current_period_end is not null
     and case p_stage
           when 'reminder'   then (s.current_period_end - public.london_today())
                                    = any (g.reminder_days)
           when 'ending'     then s.current_period_end = public.london_today()
           when 'grace_over' then s.current_period_end + g.grace_period_days
                                    = public.london_today() - 1
           else false
         end
$$;

revoke all on function public.listing_subscriptions_due(text) from public, anon, authenticated;

/**
 * Close a subscription whose grace has run out.
 *
 * Separate from the letter, so the cron can send and then expire without one
 * failing the other. Hiding the club is the switch's business, not this one's.
 */
create or replace function public.expire_listing_subscription(p_subscription bigint)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_sub  public.listing_subscriptions%rowtype;
  v_hide boolean;
begin
  select * into v_sub from public.listing_subscriptions
   where id = p_subscription for update;
  if v_sub.id is null then return 'missing'; end if;

  update public.listing_subscriptions
     set status = 'expired', updated_at = now()
   where id = v_sub.id and status in ('active', 'cancel_at_period_end');

  select auto_hide_lapsed into v_hide
    from public.listing_billing_settings where id = 1;

  if coalesce(v_hide, false) and v_sub.club_id is not null then
    update public.clubs set status = 'suspended', updated_at = now()
     where id = v_sub.club_id and status = 'active';
  end if;

  return 'expired';
end $$;

revoke all on function public.expire_listing_subscription(bigint) from public, anon, authenticated;

-- ------------------------------------------------------------------- guards

do $$
declare v_table text;
begin
  foreach v_table in array array['listing_billing_settings', 'listing_subscriptions',
                                 'listing_payments']
  loop
    if exists (select 1 from information_schema.role_table_grants
                where table_name = v_table and grantee in ('authenticated', 'anon')
                  and privilege_type in ('INSERT', 'DELETE')) then
      raise exception '% accepts inserts or deletes from a client', v_table;
    end if;
  end loop;

  -- The settings are the one table a client may update, and only by column.
  if exists (select 1 from information_schema.role_table_grants
              where table_name = 'listing_billing_settings' and grantee = 'authenticated'
                and privilege_type = 'UPDATE') then
    raise exception 'listing_billing_settings has a whole-table update grant';
  end if;
end $$;
