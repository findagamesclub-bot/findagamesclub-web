-- 0161 · The owner's half of billing and featured listings
--
-- The client asked how a club owner chooses a billing option and then asks for
-- a featured listing, and the honest answer was that they cannot do either.
-- Both halves were built from the admin's side only:
--
--   * `club_submissions.plan_interval` decides monthly or yearly, 0112 reads it
--     (`case when lower(plan_interval) = 'yearly' ...`), and the column is not
--     in 0099's grant list. So no screen could set it, every listing silently
--     became monthly, and the yearly price was advertised on the marketing page
--     and unreachable.
--   * `listing_subscriptions` is `revoke insert, update, delete` with a select
--     grant, which is right, and nothing gave the owner a way back in. A club
--     on monthly could not move to yearly ever.
--   * Featured slots are booked by an admin through `feature_club` (0113) and
--     there is no owner-facing anything: no price, no mention, no way to ask.
--
-- So this is three writers and one small table, all of them the owner's side of
-- something that already exists. Nothing here books a slot or takes money: an
-- admin still does both, because payment is offline and the slot is a placement
-- we sell rather than a thing a club can help itself to.

-- -------------------------------------------------------------- the plan

-- The column 0099 forgot. The policy that governs it is already right
-- (`club_submissions_edit`: theirs, and only while it is theirs to edit), so
-- this is the grant catching up with it rather than a new permission.
alter table public.club_submissions
  drop constraint if exists club_submissions_plan_interval_check;
alter table public.club_submissions
  add constraint club_submissions_plan_interval_check
  check (plan_interval in ('', 'monthly', 'yearly'));

grant update (plan_interval) on public.club_submissions to authenticated;

/**
 * Move a club between monthly and yearly.
 *
 * Takes effect at renewal, never mid-period, which is why it only touches
 * `plan_interval` and `price_pence` and leaves `current_period_end` alone:
 * `record_listing_payment` reads the interval when the next payment lands and
 * extends by that. Changing the period here would either hand somebody months
 * they have not paid for or take back days they have.
 *
 * Owner or admin, matching `billing.manage` in the capability matrix. A manager
 * runs the club; the money is the person whose name is on it.
 */
create or replace function public.set_listing_plan(p_club bigint, p_interval text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.listing_billing_settings%rowtype;
  v_price integer;
begin
  if p_interval not in ('monthly', 'yearly') then
    raise exception 'PLAN_UNKNOWN' using errcode = 'check_violation';
  end if;

  if not public.club_can(p_club, 'billing.manage') and not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  select * into v_settings from public.listing_billing_settings where id = 1;
  v_price := case when p_interval = 'yearly'
    then coalesce(v_settings.yearly_price_pence, 0)
    else coalesce(v_settings.monthly_price_pence, 0) end;

  update public.listing_subscriptions
     set plan_interval = p_interval,
         price_pence   = v_price
   where club_id = p_club
     and status in ('payment_pending', 'active', 'payment_failed', 'cancel_at_period_end');

  if not found then
    raise exception 'NO_SUBSCRIPTION' using errcode = 'no_data_found';
  end if;
end;
$$;

revoke all on function public.set_listing_plan(bigint, text) from public, anon;
grant execute on function public.set_listing_plan(bigint, text) to authenticated;

-- ---------------------------------------------------------- asking to feature

-- A club asking for the front page. Not a booking: an admin still books the
-- slot and records the money, because this is a placement we sell.
create table if not exists public.featured_requests (
  id            bigserial primary key,
  club_id       bigint not null references public.clubs(id) on delete cascade,
  requested_by  uuid not null references public.profiles(id) on delete cascade,
  status        text not null default 'pending'
                  check (status in ('pending', 'booked', 'declined', 'withdrawn')),
  -- What they would like, not what they get. The admin picks the real dates.
  preferred_from date,
  note          text not null default '',
  created_at    timestamptz not null default now(),
  answered_at   timestamptz,
  answered_by   uuid references public.profiles(id) on delete set null,
  decline_reason text not null default '',
  -- The slot it became, so the admin's list and the club's request agree.
  slot_id       bigint references public.featured_listings(id) on delete set null
);

-- One open ask per club. A club that presses the button twice is one club
-- wanting one slot, and two rows is two things for an admin to answer.
create unique index if not exists featured_requests_one_open
  on public.featured_requests (club_id) where status = 'pending';

create index if not exists featured_requests_queue_idx
  on public.featured_requests (status, created_at);

alter table public.featured_requests enable row level security;

-- Revoke all, not just the three: Supabase's whole-table grant also carries
-- TRUNCATE, which ignores row security. 0151's lesson, applied on creation.
revoke all on public.featured_requests from authenticated, anon;
grant select on public.featured_requests to authenticated;

-- The club's own team who handle money, and every admin. Nothing is written
-- through a policy; the functions below are the only way in.
drop policy if exists featured_requests_select on public.featured_requests;
create policy featured_requests_select on public.featured_requests
  for select to authenticated
  using (
    public.club_can(club_id, 'billing.manage')
    or public.is_admin()
  );

/**
 * Ask for a featured week.
 *
 * Returns the row id. The dates are a preference and the note is free text,
 * because "the weekend of our open day" is the thing a club actually wants and
 * no date picker expresses it on its own.
 */
create or replace function public.request_featured_slot(
  p_club bigint, p_from date default null, p_note text default ''
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_name text;
  v_admin record;
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then
    raise exception 'NOT_SIGNED_IN' using errcode = 'insufficient_privilege';
  end if;

  if not public.club_can(p_club, 'billing.manage') and not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  select name into v_name from public.clubs where id = p_club;
  if v_name is null then
    raise exception 'CLUB_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  begin
    insert into public.featured_requests (club_id, requested_by, preferred_from, note)
    values (p_club, v_actor, p_from, btrim(coalesce(p_note, '')))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'ALREADY_ASKED' using errcode = 'check_violation';
  end;

  -- Same shape as 0102: one notice per admin, keyed to the request, so a club
  -- that asks again after a decline does not stack a second unread row.
  for v_admin in
    select id from public.profiles
     where role = 'admin' and coalesce(is_active, true) and id <> v_actor
  loop
    perform public.notify_person(
      v_admin.id,
      'featured-requested',
      v_name || ' would like a featured slot',
      case when p_from is not null
        then 'They have asked for the week of ' || to_char(p_from, 'DD Mon YYYY') || '.'
        else 'No dates named, so pick what suits.' end,
      '/admin/featured?tab=asked',
      'featured_request',
      v_id::text);
  end loop;

  return v_id;
end;
$$;

/** Take it back, while nobody has answered it. */
create or replace function public.withdraw_featured_request(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.featured_requests%rowtype;
begin
  select * into v_row from public.featured_requests where id = p_id for update;

  if v_row.id is null then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  if not public.club_can(v_row.club_id, 'billing.manage') and not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'REQUEST_ANSWERED' using errcode = 'check_violation';
  end if;

  update public.featured_requests
     set status = 'withdrawn', answered_at = now(), answered_by = (select auth.uid())
   where id = p_id;

  -- The notices that asked an admin to look stop asking. Read, not deleted:
  -- 0105's rule, because a red dot for work nobody has to do is worse than
  -- no dot at all.
  update public.notifications
     set read_at = coalesce(read_at, now())
   where kind = 'featured-requested'
     and entity_type = 'featured_request'
     and entity_id = p_id::text;
end;
$$;

/**
 * Answer one, as an admin.
 *
 * Booking is deliberately not done here. `feature_club` already books a slot
 * and 0155 already tells the owner it is live, so this marks the request
 * against the slot the admin just made rather than being a second way to make
 * one. Two ways to book would be two sets of rules about overlaps.
 */
create or replace function public.answer_featured_request(
  p_id bigint, p_slot bigint default null, p_reason text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.featured_requests%rowtype;
  v_name text;
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  select * into v_row from public.featured_requests where id = p_id for update;
  if v_row.id is null then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'REQUEST_ANSWERED' using errcode = 'check_violation';
  end if;

  update public.featured_requests
     set status         = case when p_slot is not null then 'booked' else 'declined' end,
         slot_id        = p_slot,
         decline_reason = case when p_slot is null
                            then btrim(coalesce(p_reason, '')) else '' end,
         answered_at    = now(),
         answered_by    = (select auth.uid())
   where id = p_id;

  update public.notifications
     set read_at = coalesce(read_at, now())
   where kind = 'featured-requested'
     and entity_type = 'featured_request'
     and entity_id = p_id::text;

  -- Only the decline is announced here. A booking already reaches the owner
  -- through 0155's `featured-booked`, which fires on the slot itself, and two
  -- notices about one answer is the site talking over itself.
  if p_slot is null then
    select name into v_name from public.clubs where id = v_row.club_id;
    perform public.notify_person(
      v_row.requested_by,
      'featured-declined',
      'We cannot feature ' || coalesce(v_name, 'your club') || ' just now',
      case when btrim(coalesce(p_reason, '')) <> ''
        then btrim(p_reason) else 'Ask again whenever you like.' end,
      '/clubs/' || (select slug from public.clubs where id = v_row.club_id)
        || '/manage/billing',
      'featured_request',
      p_id::text);
  end if;
end;
$$;

revoke all on function public.request_featured_slot(bigint, date, text) from public, anon;
revoke all on function public.withdraw_featured_request(bigint) from public, anon;
revoke all on function public.answer_featured_request(bigint, bigint, text) from public, anon;
grant execute on function public.request_featured_slot(bigint, date, text) to authenticated;
grant execute on function public.withdraw_featured_request(bigint) to authenticated;
grant execute on function public.answer_featured_request(bigint, bigint, text) to authenticated;

-- The guard 0151 made the house rule. INSERT and DELETE are governed by row
-- security and there is no policy for either, so nothing can write a row
-- except the definer functions above.
do $$
begin
  if exists (select 1 from information_schema.role_table_grants
              where table_name = 'featured_requests'
                and grantee in ('authenticated', 'anon')
                and privilege_type in ('UPDATE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'))
  then
    raise exception 'featured_requests still carries a grant it should not';
  end if;
end $$;
