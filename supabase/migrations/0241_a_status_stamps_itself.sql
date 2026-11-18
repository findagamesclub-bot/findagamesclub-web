-- 0241: a status stamps itself
--
-- A regression I shipped in 0237, found by the client marking an order paid.
--
-- 0020 granted `authenticated` UPDATE on two columns of this table, `status`
-- and `status_updated_at`, and `setOrderStatus` has written both ever since.
-- 0237 added the refund columns and tightened the grant so a form could not
-- claim a refund date:
--
--     revoke update on public.club_merchandise_orders from anon, authenticated;
--     grant update (status) on public.club_merchandise_orders to authenticated;
--
-- The revoke was right and the grant was one column short. Postgres refuses
-- the whole statement when any column in it is not granted, so marking an
-- order Paid, Collected or Cancelled has failed since 0237 went on, with
-- "permission denied for column status_updated_at" surfacing as the service's
-- catch-all "Only the club can change an order." The refund path kept working
-- throughout, because `club_set_order_refund` is a definer function and
-- column grants do not apply inside one. That is exactly why testing refunds
-- did not catch it.
--
-- Granting the column back would fix it and reopen what 0237 closed: a
-- timestamp the browser supplies is a timestamp the browser can lie about.
-- So it is stamped here instead, and the client stops sending it. Same answer
-- 0237 gave for `refunded_at`, applied to the column it overlooked.

create or replace function public.club_merchandise_orders_status_stamp()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Only when it actually moved. A club correcting a note on an order must
  -- not restamp the day its status last changed.
  if new.status is distinct from old.status then
    new.status_updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists club_merchandise_orders_status_stamp
  on public.club_merchandise_orders;
create trigger club_merchandise_orders_status_stamp
  before update on public.club_merchandise_orders
  for each row
  execute function public.club_merchandise_orders_status_stamp();
