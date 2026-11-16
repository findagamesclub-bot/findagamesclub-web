-- 0235 · a refund cannot have happened before the money arrived
--
-- Found by opening the coaching list, not by reading anything. One row drew:
--
--     Refunded      25 AUG
--     Marked paid   12 NOV
--
-- which says the club gave money back eleven weeks before it was given any.
--
-- It is 0233's backfill, and the fault is in the fallback rather than in the
-- data. A refund recorded before this migration existed had no date of its
-- own: coaching had `refund_status` and nothing beside it, and a table
-- booking or an event place could carry a status with `refunded_at` still
-- null. So the backfill reached for the next most likely date, which was
-- `cancelled_at`, and a place cancelled in August that somebody had paid for
-- in November comes out backwards.
--
-- The honest floor is the payment. Whatever we do not know about when the
-- money went back, we know it was not before it came in, so a refund event
-- with no date of its own sits on the payment's date rather than ahead of it.
-- Only the backfilled rows move: anything written by a trigger since has a
-- real `refunded_at` behind it.
--
--
-- A second thing the same screen turned up. The shop's old log stored one
-- free-text body per move, written by 0020 as `'Marked ' || new.status`, so a
-- refunded order read **"Marked refund_due"** with the underscore showing.
-- 0233 brought those across as notes, which is what they were, and the
-- underscore came with them.
--
-- They are not notes. They are the same six moves every other section now
-- logs as a typed event, written in the one shape the site had before there
-- was a shape. So they are converted rather than reworded: the shop ends up
-- reading like the other five, which is the whole of the client's item 16,
-- and nothing a person actually typed is touched.
--
-- Checked on a throwaway Postgres built from every migration with
-- supabase/tests/stage13-one-way-of-writing-money-down.sql.

begin;

update public.club_money_events r
   set happened_at = p.happened_at
  from public.club_money_events p
 where r.kind = 'refund'
   and p.kind = 'payment'
   and p.scope = r.scope
   and p.entity_id = r.entity_id
   and p.side = r.side
   and r.happened_at < p.happened_at
   -- Only what the backfill wrote. A trigger-written refund carries the row's
   -- own `refunded_at`, and if that really is earlier than the payment then
   -- the row says so and the log should not quietly disagree with it.
   and r.author_id is null
   and r.automatic;

-- The shop's machine-written lines, given the kind they always meant.
update public.club_money_events e
   set kind = case w.status
                when 'paid' then 'payment'
                when 'refunded' then 'refund'
                when 'refund_due' then 'refund'
                else 'status' end,
       state = w.status,
       note = ''
  from (select id, substring(note from '^Marked ([a-z_]+)$') as status
          from public.club_money_events
         where scope = 'order' and kind = 'note' and automatic) w
 where e.id = w.id
   and w.status in ('placed', 'paid', 'fulfilled', 'cancelled',
                    'refund_due', 'refunded');

commit;
