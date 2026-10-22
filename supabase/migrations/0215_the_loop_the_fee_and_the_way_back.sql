/**
 * Three things the admin screens could not do, and one that was stuck.
 *
 *   4   The club request loop could go round exactly ONCE. Measured in the
 *       harness rather than reasoned about: submit, pay, send back, resubmit,
 *       and the listing lands on `payment_pending` again, because 0112 reads
 *       the billing switch on every submission and not only the first. There
 *       is no second payment to record, so `listing_paid_opens_queue` never
 *       fires, so the listing never returns to the queue and the admin is
 *       refused with SUBMISSION_NOT_IN_REVIEW. A club that was sent back once
 *       is a club nobody can answer again.
 *
 *   3a  The owner can now say "I have put it right" (0202) and nothing on any
 *       admin screen shows it. The note, the date and the back and forth are
 *       all in the database and all invisible, so the admin cannot review it
 *       and decide. And the owner has no way to ask a question: `getContacts`
 *       only ever returns clubmates, so a site thread can only be opened by an
 *       admin going first.
 *
 *   5   The club requests page says "Approved and live" about a club a site
 *       admin has taken down, and its history does not carry the suspension.
 *       Both are the row reading the submission and the club asking different
 *       questions, which 0108 already settled once for `paused`.
 */

-- ---------------------------------------------------------------------------
-- 4a · the money comes after the review, not before it
-- ---------------------------------------------------------------------------
--
-- The client's words: *"Ideally the approval flow should repeat as many times
-- as needed with admin giving feedback, before then approving the listing.
-- Once approved, the club owner should be notified and asked to pay the fee.
-- Admin would then record the payment as normal within the billing page."*
--
-- That is a deliberate reversal of 0112, which gated the QUEUE on payment on
-- the reasoning that "reviewing a listing nobody has paid for is work that may
-- be thrown away, which is why legacy stops here too". The client has weighed
-- that and wants the other order, and their order has one clear advantage: the
-- review loop carries no money in it at all, so it can go round as many times
-- as the listing needs without anybody being asked to pay twice.
--
-- **The consequence is worth saying out loud: a club is live before it has
-- paid.** That is not a hole, it is 0111's existing machinery doing its job
-- from one step earlier: the subscription opens unpaid, the reminder schedule
-- chases it, the grace period runs out, and `auto_hide_lapsed` takes the
-- listing down if it is never paid for.

create or replace function public.submit_club_submission(p_id bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row    public.club_submissions%rowtype;
  v_admin  record;
  v_answer boolean;
begin
  select * into v_row from public.club_submissions
   where id = p_id and owner_id = (select auth.uid())
   for update;

  if v_row.id is null then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  -- `payment_pending` stays in the list for a row left on it by 0112, which
  -- the backfill below clears. Nothing produces that status any more.
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

  -- Always the queue. The one line that made the loop a dead end was reading
  -- the billing switch here: a listing that had already been paid for was sent
  -- back to the payment desk every time its owner answered an admin.
  update public.club_submissions
     set status = 'review_pending', submitted_at = now()
   where id = p_id;

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

  return 'review_pending';
end;
$$;

revoke all on function public.submit_club_submission(bigint) from public, anon;
grant execute on function public.submit_club_submission(bigint) to authenticated;

-- It would refuse every approval now, because nothing is paid for before one.
drop trigger if exists club_submissions_paid_before_approval on public.club_submissions;

/**
 * Approving opens the bill.
 *
 * A trigger rather than a line inside `approve_club_submission`, which is the
 * rule this codebase keeps relearning: that function is two hundred lines of
 * club building, the status will move from more than one place in time, and a
 * fee that is charged on one path is worse than one that is charged on none.
 *
 * Idempotent on the subscription, so an approval that somehow runs twice bills
 * once. Nothing is charged when the switch is off, which is how the site
 * ships and how every club in the directory was taken on.
 */
create or replace function public.club_submissions_bill_on_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_on    boolean;
  v_price integer;
  v_plan  text;
begin
  if new.status <> 'approved' or old.status = 'approved' then
    return new;
  end if;

  select enabled into v_on from public.listing_billing_settings where id = 1;
  if not coalesce(v_on, false) then
    return new;
  end if;

  v_plan := case when lower(coalesce(new.plan_interval, '')) = 'yearly'
                 then 'yearly' else 'monthly' end;
  select case when v_plan = 'yearly' then b.yearly_price_pence
              else b.monthly_price_pence end
    into v_price
    from public.listing_billing_settings b where b.id = 1;

  -- Written here rather than at submission: whether a listing is billable is
  -- decided when it is approved now, so the column has to say so then.
  update public.club_submissions set billing_required = true where id = new.id;

  insert into public.listing_subscriptions
    (submission_id, club_id, owner_id, plan_interval, status, price_pence)
  select new.id, new.club_id, new.owner_id, v_plan, 'payment_pending', v_price
   where not exists (select 1 from public.listing_subscriptions
                      where submission_id = new.id
                        and status in ('payment_pending', 'active',
                                       'cancel_at_period_end'));

  perform public.notify_person(
    new.owner_id,
    'listing-approved-pay',
    new.club_name || ' is approved. The first payment is due',
    'Your club is in the directory. We have emailed you how to pay, and an '
      || 'admin records it here once it lands.',
    '/clubs/' || coalesce((select slug::text from public.clubs where id = new.club_id),
                          '') || '/manage/billing',
    'club_submission', new.id::text);

  return new;
end;
$$;

revoke all on function public.club_submissions_bill_on_approval()
  from public, anon, authenticated;

drop trigger if exists club_submissions_bill_on_approval on public.club_submissions;
create trigger club_submissions_bill_on_approval
  after update of status on public.club_submissions
  for each row execute function public.club_submissions_bill_on_approval();

-- Every listing 0112 left on the payment desk goes back into the queue. They
-- are the stuck ones: a club that paid, was sent back, answered, and has been
-- waiting on a payment it does not owe ever since.
update public.club_submissions
   set status = 'review_pending', submitted_at = coalesce(submitted_at, now())
 where status = 'payment_pending';

-- ---------------------------------------------------------------------------
-- 5 · the history carries what happened AFTER the listing went live
-- ---------------------------------------------------------------------------
--
-- The client's words: *"the what has happened history on this page also does
-- not show the suspension and full history."*
--
-- `club_submission_events` is the one timeline both sides read, and it stopped
-- at the approval. Everything an admin has done to the club since lived on
-- `clubs` with no way to see it beside the decision it followed. Four more
-- kinds rather than a second list: one story in one order is the whole reason
-- 0107 exists, and merging two in the browser is two orders to get wrong.

alter table public.club_submission_events
  drop constraint if exists club_submission_events_kind_check;

alter table public.club_submission_events
  add constraint club_submission_events_kind_check check (kind in (
    'submitted', 'payment_pending', 'changes_requested', 'approved',
    'declined', 'cancelled', 'restarted',
    'suspended', 'restored', 'review_asked', 'review_kept'
  ));

/**
 * A club taken down, and put back, lands on its listing's own history.
 *
 * Against the approved submission the club came out of, which is the row the
 * requests page is showing. A club typed in by an admin has no submission and
 * writes no row: there is no history screen for it, and a log row nothing can
 * reach is worse than none.
 *
 * `paused` is deliberately not logged. That is the club doing something to
 * itself and the queue already says so on the row; this list is the record of
 * what WE have done to them, which is what the client is asking to see.
 */
create or replace function public.club_status_logs_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id   bigint;
  v_kind text;
begin
  if new.status is not distinct from old.status then return new; end if;

  if new.status = 'suspended' then
    v_kind := 'suspended';
  elsif old.status = 'suspended' then
    v_kind := 'restored';
  else
    return new;
  end if;

  select s.id into v_id from public.club_submissions s
   where s.club_id = new.id and s.status = 'approved'
   order by s.id desc limit 1;
  if v_id is null then return new; end if;

  insert into public.club_submission_events (submission_id, kind, body, actor_id)
  values (v_id, v_kind,
          case when v_kind = 'suspended'
               then coalesce(new.suspended_reason, '') else '' end,
          (select auth.uid()));

  return new;
end;
$$;

revoke all on function public.club_status_logs_submission()
  from public, anon, authenticated;

drop trigger if exists clubs_status_logs_submission on public.clubs;
create trigger clubs_status_logs_submission
  after update of status on public.clubs
  for each row execute function public.club_status_logs_submission();

-- ---------------------------------------------------------------------------
-- 3a · the admin sees the ask, and answers it either way
-- ---------------------------------------------------------------------------

/**
 * 0202's own function with one thing added: the ask goes on the record.
 *
 * Built from 0202's text rather than retyped. Without the log row the admin
 * reads a club that is down and has no way to tell a club that has answered
 * from one that has not, which is the half of this item the client found.
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
  v_sub    bigint;
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
    if not (public.is_admin()
            or exists (select 1 from public.clubs c
                        where c.id = p_id and c.owner_id = (select auth.uid()))) then
      raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
    end if;

    update public.clubs
       set review_asked_at = now(), review_asked_note = v_note
     where id = p_id;

    -- On the one timeline both sides read. Only a club has one; an event's
    -- ask is on the admin's events list instead.
    select s.id into v_sub from public.club_submissions s
     where s.club_id = p_id and s.status = 'approved'
     order by s.id desc limit 1;
    if v_sub is not null then
      insert into public.club_submission_events (submission_id, kind, body, actor_id)
      values (v_sub, 'review_asked', v_note, (select auth.uid()));
    end if;

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

/**
 * "I have looked, and it stays down."
 *
 * The other half of the decision the client asked for. Putting a listing back
 * already exists; keeping it down had no answer at all, so an ask sat on the
 * admin's screen for ever and the owner was never told their answer had been
 * read. This clears the ask, says why on the record, and tells them.
 *
 * It does not change the status. The listing was already down and stays down;
 * what moves is whose turn it is.
 */
create or replace function public.keep_suspension(
  p_kind text, p_id bigint, p_note text default ''
) returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_note  text := left(btrim(coalesce(p_note, '')), 1000);
  v_owner uuid;
  v_name  text;
  v_slug  text;
  v_sub   bigint;
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;
  if p_kind not in ('club', 'event') then
    raise exception 'REVIEW_BAD_KIND';
  end if;
  if v_note = '' then
    raise exception 'REVIEW_NEEDS_REASON' using errcode = 'check_violation';
  end if;

  if p_kind = 'club' then
    select c.owner_id, c.name, c.slug::text into v_owner, v_name, v_slug
      from public.clubs c where c.id = p_id and c.status = 'suspended';
    if v_name is null then raise exception 'REVIEW_NOT_DOWN'; end if;

    update public.clubs
       set review_asked_at = null, review_asked_note = '', suspended_reason = v_note
     where id = p_id;

    select s.id into v_sub from public.club_submissions s
     where s.club_id = p_id and s.status = 'approved'
     order by s.id desc limit 1;
    if v_sub is not null then
      insert into public.club_submission_events (submission_id, kind, body, actor_id)
      values (v_sub, 'review_kept', v_note, (select auth.uid()));
    end if;

    if v_owner is not null then
      perform public.notify_person(
        v_owner, 'listing-review-kept',
        v_name || ' is staying out of the directory for now',
        v_note, '/clubs/' || v_slug || '/manage/listing/review',
        'club', p_id::text);
    end if;
  else
    select c.owner_id, e.title, c.slug::text into v_owner, v_name, v_slug
      from public.club_events e
      join public.clubs c on c.id = e.club_id
     where e.id = p_id and e.status = 'suspended';
    if v_name is null then raise exception 'REVIEW_NOT_DOWN'; end if;

    update public.club_events
       set review_asked_at = null, review_asked_note = '', suspended_reason = v_note
     where id = p_id;

    if v_owner is not null then
      perform public.notify_person(
        v_owner, 'event-review-kept',
        v_name || ' is staying down for now',
        v_note, '/clubs/' || v_slug || '/manage/events',
        'event', p_id::text);
    end if;
  end if;
end $$;

revoke all on function public.keep_suspension(text, bigint, text) from public, anon;
grant execute on function public.keep_suspension(text, bigint, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3a · and the admin lists actually show it
-- ---------------------------------------------------------------------------
--
-- The client's words: *"there is no where I can see that admin would see this
-- reply and note from the club owner, and the full history of the back and
-- forth."* They are right, and it is the shape this project keeps turning up:
-- 0202 built the ask, the stamp, the note and the notice, and stopped one
-- layer short of a screen reading any of it.
--
-- Both rebuilt from their own latest text, 0188 and 0189, with three columns
-- added. A return type cannot change under `create or replace`, so both drop
-- first.

drop function if exists public.admin_clubs(text, text, text, integer, integer);
drop function if exists public.admin_events(text, text, text, text, integer, integer);

create or replace function public.admin_clubs(
  p_query text default '', p_status text default '', p_sort text default 'name',
  p_limit integer default 25, p_offset integer default 0
) returns table (
  id bigint, slug text, name text, city text, status text,
  claimable boolean, spotlight boolean, owner_name text,
  members bigint, started timestamptz,
  -- Why it is down, and whether the club has answered. All three were in the
  -- database the whole time and no admin screen read any of them.
  suspended_reason text, review_asked_at timestamptz, review_asked_note text,
  total_count bigint
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_like text := '%' || btrim(coalesce(p_query, '')) || '%';
  v_sort text := case when coalesce(p_sort, '') = 'newest' then 'newest' else 'name' end;
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  return query
  with matching as (
    select c.*
      from public.clubs c
     where (btrim(coalesce(p_query, '')) = ''
            or c.name ilike v_like or c.city ilike v_like or c.slug ilike v_like)
       and (btrim(coalesce(p_status, '')) = '' or c.status = p_status)
  ),
  counted as (select count(*) as n from matching)
  select m.id, m.slug::text, m.name, m.city, m.status,
         coalesce(m.claimable, false), coalesce(m.spotlight, false),
         coalesce(p.full_name, '') as owner_name,
         (select count(*) from public.club_memberships cm
           where cm.club_id = m.id and cm.status = 'approved') as members,
         coalesce(m.legacy_created_at, m.created_at) as started,
         coalesce(m.suspended_reason, ''), m.review_asked_at,
         coalesce(m.review_asked_note, ''),
         counted.n
    from matching m
    left join public.profiles p on p.id = m.owner_id
    cross join counted
   -- The id breaks the tie in the direction the sort runs. Eleven clubs
   -- imported in one statement share a timestamp, and "newest first" handing
   -- back the oldest of them is the bug 0130 already paid for once.
   order by case when v_sort = 'newest'
                 then coalesce(m.legacy_created_at, m.created_at) end desc,
            case when v_sort = 'newest' then m.id end desc,
            case when v_sort = 'name' then m.name end asc
   limit greatest(coalesce(p_limit, 25), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end $$;

revoke all on function public.admin_clubs(text, text, text, integer, integer)
  from public, anon;
grant execute on function public.admin_clubs(text, text, text, integer, integer)
  to authenticated;

create or replace function public.admin_events(
  p_query text default '', p_status text default '', p_when text default '',
  p_sort text default 'date', p_limit integer default 25, p_offset integer default 0
) returns table (
  id bigint, legacy_id text, title text, start_date date, status text,
  club_slug text, club_name text, places bigint, sold bigint,
  added timestamptz,
  suspended_reason text, review_asked_at timestamptz, review_asked_note text,
  total_count bigint
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_like text := '%' || btrim(coalesce(p_query, '')) || '%';
  v_sort text := case when coalesce(p_sort, '') = 'newest' then 'newest' else 'date' end;
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  return query
  with matching as (
    select e.*, c.slug as c_slug, c.name as c_name
      from public.club_events e
      join public.clubs c on c.id = e.club_id
     where (btrim(coalesce(p_query, '')) = ''
            or e.title ilike v_like or c.name ilike v_like or c.city ilike v_like)
       and (btrim(coalesce(p_status, '')) = '' or e.status = p_status)
       -- "Upcoming" and "past" are London days, like every other date here.
       and (btrim(coalesce(p_when, '')) = ''
            or (p_when = 'upcoming' and e.start_date >= public.london_today())
            or (p_when = 'past' and e.start_date < public.london_today()))
  ),
  counted as (select count(*) as n from matching)
  select m.id, m.legacy_id, m.title, m.start_date, m.status,
         m.c_slug::text, m.c_name,
         coalesce((select sum(t.quantity_available) from public.club_event_ticket_types t
                    where t.event_id = m.id), 0)::bigint as places,
         (select count(*) from public.club_event_bookings b
           where b.event_id = m.id and b.status <> 'cancelled') as sold,
         m.created_at as added,
         coalesce(m.suspended_reason, ''), m.review_asked_at,
         coalesce(m.review_asked_note, ''),
         counted.n
    from matching m
    cross join counted
   -- Upcoming counts forwards, everything else counts back. On the Upcoming
   -- tab, newest first means the event furthest away leads and the one this
   -- Saturday is on page three, which is the opposite of why anybody opened
   -- the tab. Newest first is about when the event was PUT UP, which is the
   -- question the date order cannot answer whichever way it runs.
   order by case when v_sort = 'newest' then m.created_at end desc,
            case when v_sort = 'newest' then m.id end desc,
            case when v_sort = 'date' and p_when = 'upcoming' then m.start_date end asc,
            case when v_sort = 'date' and p_when <> 'upcoming' then m.start_date end desc
   limit greatest(coalesce(p_limit, 25), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end $$;

revoke all on function public.admin_events(text, text, text, text, integer, integer)
  from public, anon;
grant execute on function public.admin_events(text, text, text, text, integer, integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 3a · "Please also add a message admin button here"
-- ---------------------------------------------------------------------------
--
-- 0202 looked at this and recorded why it did not build it: `getContacts` only
-- ever returns clubmates, so a member cannot start a thread with the site, and
-- an admin going first is a route back that depends on the admin going first.
-- That reasoning is still right about the general case and wrong about this
-- one. An owner staring at a banner that says to put something right, with no
-- way to ask what, is the one person on the site who needs to write to us.
--
-- So one clause, not a new mechanism: the existing site thread, opened from
-- the other end, while and only while something of theirs is down.

create or replace function public.can_message_member(target_club bigint, other_person uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null or other_person is null or actor = other_person then
    return false;
  end if;

  -- Suspended accounts write nothing, the same as everywhere else.
  if not public.is_active_user() then
    return false;
  end if;

  -- From the site rather than from a club. The admin may open one with
  -- anybody; the person they wrote to may answer, and only them.
  if target_club is null then
    if public.is_admin() then
      return true;
    end if;
    if exists (
      select 1 from public.club_messages m
       where m.club_id is null
         and m.sender_id = other_person
         and m.recipient_id = actor
    ) then
      return true;
    end if;
    -- An owner whose listing or event a site admin has taken down, writing to
    -- an admin. They are being asked to put something right and had no way to
    -- ask what: a site thread could only ever be opened by an admin going
    -- first, so the conversation the client wants depended on us starting it.
    --
    -- Narrow on purpose. Only while something of theirs is actually down, and
    -- only to an active admin; it closes the moment the listing goes back up,
    -- and it gives them no reach over any other account on the site.
    return exists (select 1 from public.profiles p
                    where p.id = other_person and p.role = 'admin'
                      and coalesce(p.is_active, true))
       and (exists (select 1 from public.clubs c
                     where c.owner_id = actor and c.status = 'suspended')
            or exists (select 1 from public.club_events e
                         join public.clubs c2 on c2.id = e.club_id
                        where c2.owner_id = actor and e.status = 'suspended'));
  end if;

  -- Both approved at the same club.
  if exists (
    select 1 from public.club_memberships mine
      join public.club_memberships theirs on theirs.club_id = mine.club_id
     where mine.club_id = target_club
       and mine.profile_id = actor and mine.status = 'approved'
       and theirs.profile_id = other_person and theirs.status = 'approved'
  ) then
    return true;
  end if;

  -- The club answering somebody who has applied to join it. Legacy gives this
  -- to the owner and to an admin; can_manage_club covers both.
  if public.can_manage_club(target_club) and exists (
    select 1 from public.club_memberships m
     where m.club_id = target_club and m.profile_id = other_person
       and m.status in ('pending', 'approved')
  ) then
    return true;
  end if;

  return false;
end;
$$;

revoke all on function public.can_message_member(bigint, uuid) from public, anon;
grant execute on function public.can_message_member(bigint, uuid) to authenticated;

/**
 * The admins this reader may write to from the site, which is normally none.
 *
 * The contact list has to offer what the insert policy allows or the thread
 * cannot be opened at all: an empty conversation is how a first message
 * starts, and the page checks the contacts to decide whether somebody is
 * allowed to start one. Definer, because a member has nothing tying them to
 * an admin and no policy would return the row.
 *
 * It asks `can_message_member` itself rather than restating the rule. Two
 * readings of who may write to whom is the one thing this must not become.
 */
create or replace function public.my_site_contacts()
returns table (id uuid, full_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, coalesce(nullif(btrim(p.full_name), ''), 'FindAGamesClub')
    from public.profiles p
   where p.role = 'admin'
     and coalesce(p.is_active, true)
     and p.id <> (select auth.uid())
     and public.can_message_member(null, p.id)
   order by p.full_name
   limit 10;
$$;

revoke all on function public.my_site_contacts() from public, anon;
grant execute on function public.my_site_contacts() to authenticated;
