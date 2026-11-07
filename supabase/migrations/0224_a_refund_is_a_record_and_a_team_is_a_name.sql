-- 0224 · a refund is a record, and a team name belongs to the person who
-- booked under it
--
-- Three of the client's new issues on team events, one migration, because all
-- three are columns on `club_event_bookings` that the booking already half
-- had.
--
--   21e  "when cancelling an event booking, we should also allow the owner to
--         mark the booking as refunded, so it is clear for records when a
--         payment was made, and when a refund was then given and how."
--
--        0092 gave a booking `refund_status`, and the roster can already move
--        it to `refunded`. What it cannot say is WHEN or HOW, which is the
--        half the client asked for and the half an accounts record needs. The
--        payment beside it has carried `paid_at`, `payment_method` and
--        `payment_note` since the same migration; the refund had one word.
--
--   21f  "when editing a booking, the owner should have the option to change
--         the team name."
--
--        0211 captured it at checkout and nothing could change it afterwards.
--        A team renames itself between entering and turning up, and a booker
--        types it from memory.
--
--   21g  "when viewing your tickets as a member, for any team tickets booked,
--         the member should see the team name given for that ticket and
--         booking on their confirmation and tickets page."
--
--        The column is there and only the club could read it: the member's own
--        two screens select a fixed column list, and `team_name` is not in the
--        generated `database.ts`, which `check:columns` is right to refuse.
--        So it comes back through a function instead.
--
-- Checked on a throwaway Postgres built from every migration with
-- supabase/tests/stage13-a-refund-is-a-record.sql.

begin;

-- ----------------------------------------------- 1. when, and how, it went back

alter table public.club_event_bookings
  add column if not exists refunded_at    timestamptz,
  add column if not exists refund_method  text not null default '',
  add column if not exists refund_note    text not null default '';

comment on column public.club_event_bookings.refund_method is
  'How the money went back. The same vocabulary the payment beside it uses.';

/**
 * `refunded_at` is stamped, never sent from a form.
 *
 * When the money went back is a fact about the row, which is the rule 0092
 * already set for `paid_at` and 0205 copied for a table booking. Moving the
 * status off `refunded` clears it, so a row marked by mistake leaves no date
 * behind saying otherwise — and clears the method and the note with it,
 * because those describe a refund that is no longer recorded.
 */
create or replace function public.club_event_bookings_stamp()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.payment_status is distinct from old.payment_status then
    new.paid_at := case when new.payment_status = 'unpaid' then null
                        else coalesce(new.paid_at, now()) end;
  end if;

  if new.status = 'cancelled' and old.status <> 'cancelled' then
    new.cancelled_at := coalesce(new.cancelled_at, now());
    new.cancelled_by := coalesce(new.cancelled_by, auth.uid());
    -- Somebody who paid and then lost their place is owed something. The club
    -- settles it by hand; this is the flag that stops it being forgotten.
    if new.payment_status <> 'unpaid' and new.refund_status = 'not_due' then
      new.refund_status := 'due';
    end if;
  end if;

  if new.refund_status is distinct from old.refund_status then
    if new.refund_status = 'refunded' then
      new.refunded_at := coalesce(new.refunded_at, now());
    else
      new.refunded_at   := null;
      new.refund_method := '';
      new.refund_note   := '';
    end if;
  end if;

  return new;
end;
$$;

-- ----------------------------------- 2. the three the club may now write
--
-- Beside `payment_method` and `payment_note`, which 0092 granted for the same
-- reason: the club writes down what happened in the room, and the policy on
-- this table is what decides who the club is. `club_event_bookings_cancel`
-- also admits the member, pinned by its `with check` to a row they are
-- cancelling — the same bounded exposure `full_name` and `notes` already have.

grant update (refund_method, refund_note, team_name)
  on public.club_event_bookings to authenticated;

-- --------------------- 3. the three columns a member's own screens cannot select
--
-- `team_name` (0211) and the three refund columns above are not in the
-- generated `database.ts`, and `check:columns` is right to refuse a select
-- naming a column its schema has never heard of. The member's tickets page
-- and their confirmation both read a fixed column list, so what they cannot
-- select comes back through a function instead.
--
-- One function rather than one per column, because they are read together by
-- the same two screens and a second round trip buys nothing.

/**
 * What the club wrote down that the booking's own column list cannot carry.
 *
 * `security invoker`, so `club_event_bookings_select` decides what comes back:
 * a member reads their own and a club reads its event's, and this writes no
 * second copy of that rule.
 *
 * An array in rather than one call per booking: a member with a season of
 * tickets would otherwise be forty round trips to draw forty captions.
 */
create or replace function public.event_booking_extras(p_bookings bigint[])
returns table (
  booking_id    bigint,
  team_name     text,
  refund_method text,
  refund_note   text,
  refunded_at   timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select b.id,
         coalesce(btrim(b.team_name), ''),
         coalesce(b.refund_method, ''),
         coalesce(b.refund_note, ''),
         b.refunded_at
    from public.club_event_bookings b
   where b.id = any (coalesce(p_bookings, '{}'::bigint[]))
$$;

revoke all on function public.event_booking_extras(bigint[]) from public, anon;
grant execute on function public.event_booking_extras(bigint[]) to authenticated;

commit;
