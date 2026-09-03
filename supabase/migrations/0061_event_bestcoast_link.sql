-- 0061 · A club setting its own Best Coast Pairings link
--
-- The button has been on the event page since the client asked for it, and it
-- is correct: it renders when the event has a link and hides when it does not.
-- The trouble is that nothing can ever give an event a link. Every one on the
-- site came from the legacy import, exactly one of the twenty has the field
-- filled in, and there is no screen where a club can add one. A button that
-- can never appear is a feature that does not exist.
--
-- club_events is select-only for anon and authenticated (0009), which is right:
-- an event carries prices, capacities and dates that a member must not touch.
-- So this is one function for one column rather than a write grant on the row,
-- the same shape as edit_booking_details (0057).

create or replace function public.set_event_bestcoast_link(
  p_event bigint,
  p_url text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club  bigint;
  v_value text := btrim(coalesce(p_url, ''));
begin
  if auth.uid() is null then
    raise exception 'EVENT_NOT_YOURS';
  end if;

  select e.club_id into v_club from public.club_events e where e.id = p_event;
  if v_club is null then
    raise exception 'EVENT_NOT_FOUND';
  end if;

  if not public.can_manage_club(v_club) then
    raise exception 'EVENT_NOT_YOURS';
  end if;

  -- Empty clears it, which is how a club takes the button down again.
  if v_value <> '' then
    -- A club types "bestcoastpairings.com/event/123" as often as the full
    -- address, so a missing scheme is added rather than refused. The reader's
    -- side validates again (utils/external-url.ts) because this column also
    -- holds whatever the legacy import put in it.
    if v_value !~* '^[a-z][a-z0-9+.-]*:' then
      v_value := 'https://' || v_value;
    end if;

    if v_value !~* '^https?://[^/\s.]+\.[^/\s]+' then
      raise exception 'EVENT_BAD_URL';
    end if;

    if char_length(v_value) > 500 then
      raise exception 'EVENT_BAD_URL';
    end if;
  end if;

  update public.club_events
     set bestcoast_link = v_value
   where id = p_event;

  return v_value;
end;
$$;

revoke all on function public.set_event_bestcoast_link(bigint, text) from public, anon;
grant execute on function public.set_event_bestcoast_link(bigint, text) to authenticated;
