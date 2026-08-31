-- 0041 · Telling the club when somebody buys something
--
-- notify_on_order only ever fired on UPDATE, and only when a status reached
-- 'fulfilled', which notifies the *member* that their order is ready. Nothing
-- told the *club* that an order had been placed at all, so a club owner had to
-- go and look at the shop page to find out. sara khan has four clubs and zero
-- notifications on record, which is the proof.
--
-- Coaching had the same hole and no trigger at all, so it is closed here too.
-- Applications and tier requests already notify the owner (0027), and this
-- brings the other two things a member can start into line with them.

create or replace function public.notify_on_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club record;
  v_who text;
  v_items int;
begin
  select slug, name, owner_id into v_club from public.clubs where id = new.club_id;

  if tg_op = 'INSERT' then
    select full_name into v_who from public.profiles where id = new.profile_id;

    -- Counted rather than described: the lines are inserted after the order, so
    -- at INSERT time there is nothing to name. "2 items" needs the count, and
    -- an AFTER trigger on the order row cannot have it yet, so the body says
    -- what it can say and the queue has the detail.
    perform public.notify_person(
      v_club.owner_id, 'order_placed',
      coalesce(nullif(btrim(v_who), ''), 'A member') || ' ordered merchandise',
      coalesce(v_club.name, ''),
      '/clubs/' || v_club.slug || '/shop',
      'order', new.id::text
    );
    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  -- The club has answered. Every status the member would want to hear about,
  -- not just fulfilled: "we have your money" and "we cancelled it" both matter.
  if new.status = 'fulfilled' then
    perform public.notify_person(
      new.profile_id, 'order',
      'Your order is ready at ' || coalesce(v_club.name, 'the club'),
      'Collect it next time you are in.',
      '/account/orders', 'order', new.id::text
    );
  elsif new.status = 'paid' then
    perform public.notify_person(
      new.profile_id, 'order',
      coalesce(v_club.name, 'The club') || ' marked your order paid',
      'They will let you know when it is ready to collect.',
      '/account/orders', 'order', new.id::text
    );
  elsif new.status = 'cancelled' then
    perform public.notify_person(
      new.profile_id, 'order',
      coalesce(v_club.name, 'The club') || ' cancelled your order',
      'Talk to the club if that was not expected.',
      '/account/orders', 'order', new.id::text
    );
  end if;

  return new;
end;
$$;

drop trigger if exists club_merchandise_orders_notify on public.club_merchandise_orders;
create trigger club_merchandise_orders_notify
  after insert or update on public.club_merchandise_orders
  for each row execute function public.notify_on_order();

-- ------------------------------------------------------------------ coaching

create or replace function public.notify_on_coaching_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club record;
  v_slot record;
  v_who text;
begin
  select s.club_id, s.title, s.slot_date into v_slot
    from public.club_coaching_slots s where s.id = new.slot_id;
  if v_slot.club_id is null then
    return new;
  end if;

  select slug, name, owner_id into v_club from public.clubs where id = v_slot.club_id;
  select full_name into v_who from public.profiles where id = new.profile_id;

  perform public.notify_person(
    v_club.owner_id, 'coaching_booked',
    coalesce(nullif(btrim(v_who), ''), 'A member') || ' booked coaching',
    coalesce(v_slot.title, 'A session') || ' on ' || coalesce(v_slot.slot_date::text, ''),
    '/clubs/' || v_club.slug || '/coaching',
    'coaching', new.id::text
  );
  return new;
end;
$$;

drop trigger if exists club_coaching_bookings_notify on public.club_coaching_bookings;
create trigger club_coaching_bookings_notify
  after insert on public.club_coaching_bookings
  for each row execute function public.notify_on_coaching_booking();
