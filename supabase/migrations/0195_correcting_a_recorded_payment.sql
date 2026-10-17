-- A payment is still a fact. It is now a fact the club can correct.
--
-- 0012 made this ledger insert-only: "a payment, once recorded, is a fact. No
-- updates, no deletes." That is right about what the row MEANS and wrong about
-- how it got there. Nothing in this app takes money, so the row is a club
-- typing what arrived at the door, and a club that picked the wrong billing
-- option or fumbled the note had no way back to it. The only correction
-- available was the SQL console, which is not a feature.
--
-- So the row becomes correctable and stops pretending it never was. Every
-- update stamps who changed it and when, both sides of the ledger show that
-- mark, and there is still no delete. A correction leaves a trace; a
-- disappearance does not, which is the half 0012 was really protecting.

alter table public.club_membership_payments
  add column if not exists edited_at timestamptz,
  add column if not exists edited_by uuid references public.profiles (id) on delete set null;

-- What the club typed is what the club may correct.
--
-- The row's identity is deliberately not in this list. Moving a payment to
-- another membership, another club or another person is not a correction, it
-- is a different payment, and `recorded_by` and `created_at` are the record of
-- who first wrote it down rather than fields anybody gets to revise.
grant update (tier_key, tier_label, billing_option_label, price, price_duration,
              period_start_at, period_end_at, note)
  on public.club_membership_payments to authenticated;

create policy club_membership_payments_correct
  on public.club_membership_payments for update
  to authenticated
  using (public.can_manage_club(club_id))
  with check (public.can_manage_club(club_id));

-- The stamp is NOT in the grant above, so it is the trigger that writes it and
-- a hand-rolled PostgREST call cannot claim somebody else made the correction,
-- or that nobody did.
create or replace function public.club_payment_corrected()
returns trigger
language plpgsql
as $$
begin
  new.edited_at := now();
  new.edited_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists club_membership_payments_corrected
  on public.club_membership_payments;

create trigger club_membership_payments_corrected
  before update on public.club_membership_payments
  for each row
  execute function public.club_payment_corrected();

-- Said again rather than assumed. 0012's revoke covered update AND delete, and
-- the grant above gives back only the first of them.
revoke delete on public.club_membership_payments from anon, authenticated;
