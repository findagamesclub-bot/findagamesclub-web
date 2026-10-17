-- 0202 · Three from the admin revision document.
--
--  9b · a revenue ledger a treasurer can file
--  3a · a suspended club or event, and the owner's way back
--  2a · an admin editing a listing that is not published yet
--
-- 7b, the `[object Object]` under ELSEWHERE, is an app fix and needs no SQL:
-- `profiles.social_profiles` is an ARRAY of `{label, url}` and the admin page
-- read it with `Object.entries`, which on an array gives the index as the key.
-- `toSocialLinks` has been the one reading of that column since Stage 2.

-- ---------------------------------------------------------------------------
-- 9b · every transaction, one row each
-- ---------------------------------------------------------------------------
--
-- The client's words: *"I need to be able to clearly track and download any
-- revenue and the details of that revenue over time periods for tax purposes.
-- It would be ideal to have a way to download each transaction and payment
-- recorded for either a club listing or a featured listing as a download, with
-- payment date, time period (month or year), renewal date, club, payment note
-- and amount."*
--
-- `admin_growth_months` (0191) answers how much, by month, for a chart. A tax
-- return wants the other shape: the lines themselves, so they can be summed,
-- filtered and handed to an accountant. Same two sources, same filters, same
-- dates, so the file and the chart cannot disagree about a window:
--
--   * a listing fee counts on `paid_at` and only where `kind = 'subscription'`
--   * a featured slot counts on `starts_on`
--
-- `received` is the honest half, and it is the one thing a money export must
-- not flatten. 0191 settled it: a listing fee is a payment somebody recorded,
-- a featured slot is a placement sold and settled offline, and nothing has
-- ever written `listing_payments.kind = 'featured'`. Adding them into one
-- column called Revenue would be the file inventing a receipt. They are two
-- kinds of line with a column saying which.
--
-- Guarded with an `if` that raises rather than a `select` whose result nothing
-- reads: 0117 shipped the second kind, the planner dropped it, and a stranger
-- read a club's takings.

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
         coalesce(c.name, ''),
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

-- `listing_payments.paid_at` is a DATE, and 0191 wrapped it in `london_day`.
--
-- That helper takes a timestamptz, so a date is cast first, in the SESSION's
-- own zone: midnight on the 7th in a +5 session is 20:00 on the 6th in London
-- and the payment counts a day early. Supabase runs sessions in UTC, where the
-- cast lands inside the same London day, so the live figures were right and
-- the mistake was invisible there. The harness runs in Asia/Karachi, which is
-- the third time that has caught something UTC would have hidden.
--
-- A date is already a day. The two readers are 0191's own text with that one
-- expression taken off, so the chart and the ledger below cannot disagree
-- about which window a payment falls in.

create or replace function public.admin_growth_months(
  p_from date, p_to date
) returns table (
  month_start date,
  clubs_listed integer,
  events_added integer,
  accounts_joined integer,
  listing_pence bigint,
  featured_pence bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  return query
  with spans as (
    -- One row per calendar month the window touches, each clipped to the
    -- window's own ends. Without the clipping the first and last columns run
    -- outside it and the chart stops adding up to the figures above it.
    select m::date as month_start,
           greatest(m::date, p_from) as span_from,
           least((m + interval '1 month' - interval '1 day')::date, p_to) as span_to
      from generate_series(date_trunc('month', p_from::timestamp),
                           date_trunc('month', p_to::timestamp),
                           '1 month') as m
  )
  select s.month_start,
         (select count(*) from public.clubs c
           where public.london_day(coalesce(c.legacy_created_at, c.created_at))
                 between s.span_from and s.span_to)::integer,
         (select count(*) from public.club_events e
           where public.london_day(e.created_at)
                 between s.span_from and s.span_to)::integer,
         (select count(*) from public.profiles p
           where public.london_day(p.created_at)
                 between s.span_from and s.span_to)::integer,
         -- Money received: a listing payment carries the day it was paid.
         coalesce((select sum(l.amount_pence) from public.listing_payments l
                    where l.kind = 'subscription'
                      and l.paid_at
                          between s.span_from and s.span_to), 0)::bigint,
         -- Money booked: a featured slot is sold for a run of dates and
         -- settled offline, so it counts on the day the run starts.
         coalesce((select sum(f.price_pence) from public.featured_listings f
                    where f.starts_on between s.span_from and s.span_to), 0)::bigint
    from spans s
   order by s.month_start;
end $$;

create or replace function public.admin_growth_slice(
  p_from date, p_to date
) returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'clubsListed', (select count(*) from public.clubs c
                     where public.london_day(coalesce(c.legacy_created_at, c.created_at))
                           between p_from and p_to),
    'eventsAdded', (select count(*) from public.club_events e
                     where public.london_day(e.created_at) between p_from and p_to),
    'accountsJoined', (select count(*) from public.profiles p
                        where public.london_day(p.created_at) between p_from and p_to),
    'listingPence', coalesce((select sum(l.amount_pence) from public.listing_payments l
                               where l.kind = 'subscription'
                                 and l.paid_at between p_from and p_to), 0),
    'featuredPence', coalesce((select sum(f.price_pence) from public.featured_listings f
                                where f.starts_on between p_from and p_to), 0)
  );
$$;

revoke all on function public.admin_growth_months(date, date) from public, anon;
revoke all on function public.admin_growth_slice(date, date)
  from public, anon, authenticated;
grant execute on function public.admin_growth_months(date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 3a · the owner's way back from a suspension
-- ---------------------------------------------------------------------------
--
-- The client's words: *"admin can now take down a listing or event. However,
-- it is not clear for a club owner how they resolve the issue. Should we add a
-- message admin button? For club listings, we could allow the owner to send it
-- back for admin review under club requests, however we do not have this for
-- events."*
--
-- Their second suggestion is the one that does not generalise, and they said
-- so themselves: club requests are a queue of `club_submissions`, and a
-- suspended club is a club that is already approved. Hanging a new submission
-- off it would make a second row for a listing that exists, and an event has
-- no equivalent at all.
--
-- The first suggestion generalises and does not exist either: `getContacts`
-- only ever returns clubmates, so a member cannot start a thread with the
-- site. An admin can start one (0190) and the owner can reply, which is a
-- route back that depends on the admin going first.
--
-- So: one action on the thing that was taken down, for both kinds. It carries
-- the owner's own note, it stamps the row so the screen can say it was sent
-- and when, and it rings every admin. The same shape 0109 already uses to tell
-- the admins about a pause, which is the other half of this conversation.

alter table public.clubs
  add column if not exists review_asked_at timestamptz,
  add column if not exists review_asked_note text not null default '';

alter table public.club_events
  add column if not exists review_asked_at timestamptz,
  add column if not exists review_asked_note text not null default '';

-- Not grantable. The stamp is the record of an ask, so it is set by the
-- function that makes one and by nothing else; a column grant would let a
-- hand-rolled call claim an ask that never happened, and clear one that did.
revoke update (review_asked_at, review_asked_note)
  on public.clubs from authenticated, anon;
revoke update (review_asked_at, review_asked_note)
  on public.club_events from authenticated, anon;

/**
 * "I have put it right, please look again."
 *
 * One function for both kinds, because the two screens ask the same question
 * and two functions would drift about who may ask and what the admins are
 * told. `p_kind` is checked against a closed pair rather than interpolated.
 *
 * Only while it is actually down: asking for another look at something nobody
 * has taken down is a notice about nothing, and the screen does not offer it.
 */
create or replace function public.ask_suspension_review(
  p_kind text, p_id bigint, p_note text default ''
) returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_club   bigint;
  v_name   text;
  v_title  text;
  v_body   text;
  v_href   text;
  v_entity text;
  v_note   text := left(btrim(coalesce(p_note, '')), 1000);
  v_admin  record;
begin
  if (select auth.uid()) is null then
    raise exception 'REVIEW_SIGN_IN' using errcode = 'insufficient_privilege';
  end if;
  if p_kind not in ('club', 'event') then
    raise exception 'REVIEW_BAD_KIND';
  end if;

  if p_kind = 'club' then
    select c.id, c.name into v_club, v_name
      from public.clubs c
     where c.id = p_id and c.status = 'suspended';
    if v_club is null then raise exception 'REVIEW_NOT_DOWN'; end if;
    -- The owner or an admin, matching `club_suspension`, which is who can
    -- read the reason in the first place.
    if not (public.is_admin()
            or exists (select 1 from public.clubs c
                        where c.id = p_id and c.owner_id = (select auth.uid()))) then
      raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
    end if;

    update public.clubs
       set review_asked_at = now(), review_asked_note = v_note
     where id = p_id;

    v_title  := v_name || ' says their listing is settled';
    v_href   := '/admin/clubs';
    v_entity := 'club';
  else
    select e.club_id, e.title into v_club, v_name
      from public.club_events e
     where e.id = p_id and e.status = 'suspended';
    if v_club is null then raise exception 'REVIEW_NOT_DOWN'; end if;
    if not (public.is_admin() or public.club_can(v_club, 'events.manage')) then
      raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
    end if;

    update public.club_events
       set review_asked_at = now(), review_asked_note = v_note
     where id = p_id;

    v_title  := v_name || ' is asking to go back up';
    v_href   := '/admin/events';
    v_entity := 'event';
  end if;

  v_body := case when v_note = ''
                 then 'The club has asked for another look at it.'
                 else v_note end;

  -- Every admin but the one who pressed it, the same rule 0109 draws: nobody
  -- is told about their own doing.
  for v_admin in
    select id from public.profiles
     where role = 'admin' and coalesce(is_active, true)
       and id is distinct from (select auth.uid())
  loop
    perform public.notify_person(
      v_admin.id,
      case when p_kind = 'club' then 'listing-review-asked'
           else 'event-review-asked' end,
      v_title, v_body, v_href, v_entity, p_id::text);
  end loop;
end $$;

revoke all on function public.ask_suspension_review(text, bigint, text)
  from public, anon;
grant execute on function public.ask_suspension_review(text, bigint, text)
  to authenticated;

-- The two readers carry the ask, so the banner can say it was sent and when,
-- and putting a listing back clears it, so one taken down a second time does
-- not open carrying last time's sentence.
--
-- All four are 0188's own text with one line changed in each, transformed
-- rather than retyped. The first draft of this file rewrote them from memory
-- and silently lost `admin_restore_event`'s call to `event_suspension_told`,
-- the `for update` lock, the not-found / not-down split and 0111's fallback
-- for a club the lapse job suspended without a `suspended_from`. That is the
-- rule this repo already carries, paid for again: build a replacement from
-- the LATEST definition, and prefer editing its text to typing it out.
--
-- A `returns table` cannot change under `create or replace`, so the two
-- readers drop first.

create or replace function public.admin_restore_club(p_club bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_back   text;
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  select status, suspended_from into v_status, v_back
    from public.clubs where id = p_club for update;

  if v_status is null then
    raise exception 'CLUB_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  if v_status <> 'suspended' then
    raise exception 'CLUB_NOT_DOWN' using errcode = 'check_violation';
  end if;

  -- 0111's lapse job suspends without going through this file, so a club can
  -- be suspended with nothing recorded about where it came from. Active is the
  -- honest default for one of those: it was in the directory when we hid it.
  if coalesce(v_back, '') not in ('active', 'paused') then
    v_back := 'active';
  end if;

  update public.clubs
     set status = v_back,
         suspended_reason = '', suspended_at = null,
         suspended_by = null, suspended_from = null,
         review_asked_at = null, review_asked_note = '',
         updated_at = now()
   where id = p_club;

  return v_back;
end;
$$;

drop function if exists public.club_suspension(bigint);
create function public.club_suspension(p_club bigint)
returns table (reason text, suspended_at timestamptz, by_name text,
               asked_at timestamptz, asked_note text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_owner uuid;
begin
  select owner_id into v_owner from public.clubs where id = p_club;
  if v_owner is null and not public.is_admin() then
    return;
  end if;
  if not public.is_admin() and v_owner is distinct from (select auth.uid()) then
    return;
  end if;

  return query
  select c.suspended_reason, c.suspended_at, coalesce(p.full_name, ''),
         c.review_asked_at, c.review_asked_note
    from public.clubs c
    left join public.profiles p on p.id = c.suspended_by
   where c.id = p_club and c.status = 'suspended';
end;
$$;

create or replace function public.admin_restore_event(p_event bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_back   text;
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  select status, suspended_from into v_status, v_back
    from public.club_events where id = p_event for update;

  if v_status is null then
    raise exception 'EVENT_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  if v_status <> 'suspended' then
    raise exception 'EVENT_NOT_DOWN' using errcode = 'check_violation';
  end if;

  if coalesce(v_back, '') not in ('draft', 'published', 'cancelled') then
    v_back := 'draft';
  end if;

  update public.club_events
     set status = v_back,
         suspended_reason = '', suspended_at = null,
         suspended_by = null, suspended_from = null,
         review_asked_at = null, review_asked_note = ''
   where id = p_event;

  perform public.event_suspension_told(p_event, false, '');
  return v_back;
end;
$$;

drop function if exists public.event_suspension(bigint);
create function public.event_suspension(p_event bigint)
returns table (reason text, suspended_at timestamptz, by_name text,
               asked_at timestamptz, asked_note text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  select e.suspended_reason, e.suspended_at, coalesce(p.full_name, ''),
         e.review_asked_at, e.review_asked_note
    from public.club_events e
    join public.clubs c on c.id = e.club_id
    left join public.profiles p on p.id = e.suspended_by
   where e.id = p_event
     and e.status = 'suspended'
     and (public.is_admin() or c.owner_id = (select auth.uid())
          or public.club_can(e.club_id, 'events.manage'));
end;
$$;

revoke all on function public.admin_restore_club(bigint) from public, anon;
revoke all on function public.club_suspension(bigint) from public, anon;
revoke all on function public.admin_restore_event(bigint) from public, anon;
revoke all on function public.event_suspension(bigint) from public, anon;
grant execute on function public.admin_restore_club(bigint) to authenticated;
grant execute on function public.club_suspension(bigint) to authenticated;
grant execute on function public.admin_restore_event(bigint) to authenticated;
grant execute on function public.event_suspension(bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- 2a · an admin editing a listing before it is published
-- ---------------------------------------------------------------------------
--
-- The client's words: *"there is still no way for admin to make changes to a
-- listing that is not already published. Can we allow admin to go through the
-- usual edit listing steps for unpublished listings?"*
--
-- The builder is already one set of five step components writing to one place
-- (0099 onwards); what stopped an admin was the row policy, which has only
-- ever admitted the owner. So this is the policy catching up with the screen
-- rather than a second editor.
--
-- The column grant is what makes it safe to widen: 0099 grants update on
-- `club_name`, `city`, `payload` and `last_step` and nothing else, so an admin
-- going through the builder can change what the listing SAYS and cannot touch
-- its status. Approving, sending back and declining stay where they are, in
-- the three review functions that log what they did.
--
-- Draft is deliberately not in the admin's list. A draft is somebody typing,
-- it is not in the queue, and an admin editing under a club's fingers is the
-- one case nobody asked for.

drop policy if exists club_submissions_edit on public.club_submissions;

create policy club_submissions_edit on public.club_submissions
  for update to authenticated
  using ((owner_id = (select auth.uid())
          and status in ('draft', 'changes_requested', 'payment_pending'))
         or (public.is_admin()
             and status in ('review_pending', 'changes_requested', 'payment_pending')))
  with check ((owner_id = (select auth.uid())
               and status in ('draft', 'changes_requested', 'payment_pending'))
              or (public.is_admin()
                  and status in ('review_pending', 'changes_requested', 'payment_pending')));
