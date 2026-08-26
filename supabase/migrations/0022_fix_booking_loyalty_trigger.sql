-- club_bookings has no profile_id. The person is booked_by.
--
-- The reference raised "record new has no field profile_id" at runtime, which
-- plpgsql cannot catch at create time, so the function was accepted and only
-- failed when a club actually had a gameBooking milestone. That made every
-- cancellation at Didcot and G Matthews impossible, and no table booking has
-- ever earned its points.
create or replace function public.club_bookings_award_loyalty()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  base integer;
  key  text := 'booking:' || new.id;
begin
  select coalesce((s.milestones ->> 'gameBooking')::integer, 0)
    into base from public.club_loyalty_settings s
   where s.club_id = new.club_id and s.enabled;

  if coalesce(base, 0) <= 0 then
    return new;
  end if;

  if tg_op = 'INSERT' and new.status = 'booked' then
    perform public.award_loyalty(
      new.club_id, new.booked_by, 'game-booking',
      'Table booked', base, key);

  elsif tg_op = 'UPDATE' and new.status = 'cancelled' and old.status = 'booked' then
    -- Only claw back points that were actually given. A booking made before the
    -- club switched loyalty on — or while this trigger was broken — never
    -- earned anything, and deducting for it would put the member below zero.
    if exists (
      select 1 from public.club_loyalty_transactions
       where club_id = new.club_id and source_key = key
    ) then
      insert into public.club_loyalty_transactions
        (club_id, profile_id, kind, category, description,
         available_delta, lifetime_delta, source_key)
      values
        (new.club_id, new.booked_by, 'cancelled', 'game-booking',
         'Table booking cancelled', -base, -base, key || '::cancelled')
      on conflict (club_id, source_key) do nothing;
    end if;
  end if;

  return new;
end;
$function$;
