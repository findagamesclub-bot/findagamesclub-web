-- 0112 · A listing does not go live until it is paid for
--
-- Legacy's rule, copied: `approve_submission` (club_store.py:12455) refuses
-- unless the linked subscription is `active` or `cancel_at_period_end`. A club
-- that cancels at the end of its period has paid for the period it is in, so it
-- goes live; a club that has paid nothing does not.
--
-- 0099 left `payment_pending` out of the status check on purpose, with a note
-- saying it stayed out "until Stage 5 builds billing, so nothing can currently
-- land in a state nothing can move it out of". This is that stage, and the way
-- out is an admin recording a payment.
--
-- The order is legacy's too. Submitting with billing on lands in
-- `payment_pending` rather than in the queue, because reviewing a listing
-- nobody has paid for is work that may be thrown away. Recording the payment
-- moves it into the queue.
--
-- None of this does anything while billing is switched off, which is how it
-- ships. Every listing already in the directory was taken on for free, and a
-- migration that made forty clubs owe money on a Tuesday would be a migration
-- that hid forty clubs on the following Tuesday.
--
-- Checked on a throwaway Postgres: with billing off a submission goes straight
-- to the queue and approving works exactly as it did; with billing on it lands
-- in payment_pending, approving is refused, recording the payment moves it to
-- review_pending, and approving then works; and the club's own subscription
-- follows it from the submission to the club.

alter table public.club_submissions drop constraint if exists club_submissions_status_check;
alter table public.club_submissions add constraint club_submissions_status_check
  check (status in (
    'draft', 'payment_pending', 'review_pending', 'changes_requested',
    'approved', 'declined', 'cancelled'
  ));

-- Editable while it is theirs, which now includes while they owe us money: a
-- club waiting to pay should still be able to fix a typo.
drop policy if exists club_submissions_edit on public.club_submissions;
create policy club_submissions_edit on public.club_submissions
  for update to authenticated
  using (owner_id = (select auth.uid())
         and status in ('draft', 'changes_requested', 'payment_pending'))
  with check (owner_id = (select auth.uid())
              and status in ('draft', 'changes_requested', 'payment_pending'));

/**
 * Send it to us, or to the payment desk first.
 *
 * Replaces 0104's version. Everything there is unchanged except the landing
 * status and the subscription it opens, both of which do nothing at all while
 * billing is off.
 */
create or replace function public.submit_club_submission(p_id bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row     public.club_submissions%rowtype;
  v_admin   record;
  v_answer  boolean;
  v_billing boolean;
  v_next    text;
begin
  select * into v_row from public.club_submissions
   where id = p_id and owner_id = (select auth.uid())
   for update;

  if v_row.id is null then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  if v_row.status not in ('draft', 'changes_requested', 'payment_pending') then
    raise exception 'SUBMISSION_NOT_EDITABLE' using errcode = 'check_violation';
  end if;

  if btrim(coalesce(v_row.club_name, '')) = '' then
    raise exception 'SUBMISSION_NEEDS_NAME' using errcode = 'check_violation';
  end if;

  if btrim(coalesce(v_row.city, '')) = '' then
    raise exception 'SUBMISSION_NEEDS_CITY' using errcode = 'check_violation';
  end if;

  v_answer := v_row.status = 'changes_requested';

  select enabled into v_billing from public.listing_billing_settings where id = 1;
  v_billing := coalesce(v_billing, false);

  -- Reviewing a listing nobody has paid for is work that may be thrown away,
  -- which is why legacy stops here too.
  v_next := case when v_billing then 'payment_pending' else 'review_pending' end;

  update public.club_submissions
     set status           = v_next,
         submitted_at     = now(),
         billing_required = v_billing
   where id = p_id;

  -- A subscription to pay against. Definer, so the club does not need the
  -- admin-only function's grant; idempotent, so sending twice opens one.
  if v_billing then
    insert into public.listing_subscriptions
      (submission_id, owner_id, plan_interval, status, price_pence)
    select p_id, v_row.owner_id,
           case when lower(coalesce(v_row.plan_interval, '')) = 'yearly'
                then 'yearly' else 'monthly' end,
           'payment_pending',
           case when lower(coalesce(v_row.plan_interval, '')) = 'yearly'
                then b.yearly_price_pence else b.monthly_price_pence end
      from public.listing_billing_settings b
     where b.id = 1
       and not exists (select 1 from public.listing_subscriptions
                        where submission_id = p_id
                          and status in ('payment_pending', 'active',
                                         'cancel_at_period_end'));
  end if;

  -- Nobody is asked to look at it until it is paid for.
  if v_next = 'review_pending' then
    for v_admin in
      select id from public.profiles
       where role = 'admin' and coalesce(is_active, true)
         and id <> v_row.owner_id
    loop
      if v_answer then
        perform public.notify_person(
          v_admin.id,
          'club-request-updated',
          v_row.club_name || ' has made the changes you asked for',
          'It is back in the queue and ready to look at again.',
          '/admin/submissions/' || p_id::text,
          'club_submission', p_id::text);
      else
        perform public.notify_person(
          v_admin.id,
          'club-request',
          v_row.club_name || ' is waiting to be listed',
          case when btrim(coalesce(v_row.city, '')) <> ''
            then 'In ' || v_row.city || '. Read it and approve, send it back, or decline it.'
            else 'Read it and approve, send it back, or decline it.'
          end,
          '/admin/submissions/' || p_id::text,
          'club_submission', p_id::text);
      end if;
    end loop;
  else
    -- The admins still want to know somebody is waiting to pay, or a club that
    -- never gets round to it is invisible until somebody audits the table.
    for v_admin in
      select id from public.profiles
       where role = 'admin' and coalesce(is_active, true)
         and id <> v_row.owner_id
    loop
      perform public.notify_person(
        v_admin.id,
        'club-request-unpaid',
        v_row.club_name || ' is waiting to pay',
        'It goes into the queue as soon as you record their payment.',
        '/admin/billing',
        'club_submission', p_id::text);
    end loop;
  end if;

  return v_next;
end;
$$;

revoke all on function public.submit_club_submission(bigint) from public, anon;
grant execute on function public.submit_club_submission(bigint) to authenticated;

/**
 * A payment on a submission puts it in the queue.
 *
 * A trigger rather than a line in `record_listing_payment`, because Stage 5's
 * cron and any later Stripe webhook both write the same row and neither should
 * have to remember this.
 */
create or replace function public.listing_paid_opens_queue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub public.listing_subscriptions%rowtype;
begin
  select * into v_sub from public.listing_subscriptions where id = new.subscription_id;
  if v_sub.submission_id is null then return new; end if;

  update public.club_submissions
     set status = 'review_pending', submitted_at = coalesce(submitted_at, now())
   where id = v_sub.submission_id and status = 'payment_pending';

  return new;
end;
$$;

revoke all on function public.listing_paid_opens_queue() from public, anon, authenticated;

drop trigger if exists listing_payments_open_queue on public.listing_payments;
create trigger listing_payments_open_queue
  after insert on public.listing_payments
  for each row execute function public.listing_paid_opens_queue();

/**
 * And the queue opening tells the admins, the same as an unpaid one reaching
 * them would have.
 *
 * On `club_submissions` rather than in the trigger above, so it fires whichever
 * path moved the status into the queue.
 */
create or replace function public.club_submissions_queued()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_admin record;
begin
  if new.status <> 'review_pending' or old.status <> 'payment_pending' then
    return new;
  end if;

  -- The "waiting to pay" notice is about something that has now happened.
  update public.notifications
     set read_at = now()
   where kind = 'club-request-unpaid'
     and entity_type = 'club_submission' and entity_id = new.id::text
     and read_at is null;

  for v_admin in
    select id from public.profiles
     where role = 'admin' and coalesce(is_active, true) and id <> new.owner_id
  loop
    perform public.notify_person(
      v_admin.id, 'club-request',
      new.club_name || ' is waiting to be listed',
      'They have paid. Read it and approve, send it back, or decline it.',
      '/admin/submissions/' || new.id::text,
      'club_submission', new.id::text);
  end loop;

  return new;
end;
$$;

revoke all on function public.club_submissions_queued() from public, anon, authenticated;

drop trigger if exists club_submissions_queued on public.club_submissions;
create trigger club_submissions_queued
  after update of status on public.club_submissions
  for each row execute function public.club_submissions_queued();

/**
 * Approving checks the money first.
 *
 * Legacy's rule and legacy's two acceptable statuses. This wraps the existing
 * function rather than re-stating it: 0100's `approve_club_submission` is two
 * hundred lines of club building and none of it changes.
 */
create or replace function public.listing_paid_before_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_ok boolean;
begin
  if new.status <> 'approved' or old.status = 'approved' then
    return new;
  end if;

  if not coalesce(new.billing_required, false) then
    return new;
  end if;

  select exists (
    select 1 from public.listing_subscriptions
     where submission_id = new.id
       and status in ('active', 'cancel_at_period_end')
  ) into v_ok;

  if not v_ok then
    raise exception 'LISTING_NOT_PAID' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function public.listing_paid_before_approval() from public, anon, authenticated;

drop trigger if exists club_submissions_paid_before_approval on public.club_submissions;
create trigger club_submissions_paid_before_approval
  before update of status on public.club_submissions
  for each row execute function public.listing_paid_before_approval();

/**
 * The subscription follows the listing onto the club.
 *
 * Without this a club approved out of a paid submission has a subscription
 * pointing at a row nobody opens again, and its billing page reads as though it
 * had never paid.
 */
create or replace function public.listing_subscription_follows_club()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.club_id is null or new.club_id is not distinct from old.club_id then
    return new;
  end if;

  update public.listing_subscriptions
     set club_id = new.club_id, updated_at = now()
   where submission_id = new.id and club_id is null;

  return new;
end;
$$;

revoke all on function public.listing_subscription_follows_club()
  from public, anon, authenticated;

drop trigger if exists club_submissions_carry_subscription on public.club_submissions;
create trigger club_submissions_carry_subscription
  after update of club_id on public.club_submissions
  for each row execute function public.listing_subscription_follows_club();
