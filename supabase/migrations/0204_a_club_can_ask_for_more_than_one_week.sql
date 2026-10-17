-- 0204 · A club can ask for more than one week
--
-- The client's words: *"when a club owner goes to billing in dashboard, they
-- should see upcoming featured bookings, as well as current live bookings with
-- start/end date and cost and be able to request other future bookings. At the
-- moment, they can only request 1 at a time and do not see past bookings."*
--
-- Seeing the slots needs no SQL: `featured_listings` has been readable by
-- everybody since 0113 and is in the generated types, so the billing page can
-- simply select its own club's rows. That half is app work.
--
-- Asking for more than one does need SQL. 0161 put a unique index on it:
--
--   -- One open ask per club. A club that presses the button twice is one club
--   -- wanting one slot, and two rows is two things for an admin to answer.
--
-- The reasoning is right about the case it names and wrong about the one the
-- client is describing. A club running four events a year wants four weeks,
-- each with its own date and its own answer, and each really is a separate
-- thing to answer. So the rule moves from "one open ask" to "one open ask per
-- date", which still catches the double press, plus a cap so the queue stays
-- workable.

drop index if exists public.featured_requests_one_open;

-- Still indexed for the lookups above and for the admin's queue, just not
-- unique any more.
create index if not exists featured_requests_open_idx
  on public.featured_requests (club_id, status);

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

  -- One ask per date rather than one ask per club. Pressing the button twice
  -- for the same week is still one club wanting one slot, which is what the
  -- index this replaces was really protecting; wanting three different weeks
  -- is three things, and the client asked for exactly that.
  --
  -- `is not distinct from` because two nulls are the same ask here: "whenever
  -- suits" twice is one preference, and a plain unique index would let it
  -- through, since nulls never collide.
  if exists (
    select 1 from public.featured_requests
     where club_id = p_club and status = 'pending'
       and preferred_from is not distinct from p_from
  ) then
    raise exception 'ALREADY_ASKED' using errcode = 'check_violation';
  end if;

  -- Bounded, because an admin has to answer every one of these. Five open
  -- asks is a club planning a year; fifty is a queue nobody can work.
  if (select count(*) from public.featured_requests
       where club_id = p_club and status = 'pending') >= 5 then
    raise exception 'TOO_MANY_ASKS' using errcode = 'check_violation';
  end if;

  insert into public.featured_requests (club_id, requested_by, preferred_from, note)
  values (p_club, v_actor, p_from, btrim(coalesce(p_note, '')))
  returning id into v_id;

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

revoke all on function public.request_featured_slot(bigint, date, text) from public, anon;
grant execute on function public.request_featured_slot(bigint, date, text) to authenticated;
