-- 0238: a note can be meant for the member
--
-- The client, items 18 and 19: "for merchandising refunds, we aren't showing
-- the refund notes to the member", and "when club owner marks as refund due
-- or refunded, they can add a note. However, this note is not shown to the
-- club member".
--
-- The refund's own note does reach the member and has since 0237. Order 16 in
-- the live data carries "Shirt was the wrong size and we had none left,
-- refunded in cash on games night" on its refund event, and the member who
-- bought it reads that. What happened on the order the client photographed is
-- that the dialog's note was left empty and the words went into the box
-- underneath, which is the club's working log and has been since 0020:
--
--     20  refund  refund_due  18:30  note=''
--     20  note                18:30  'member requested cancellation and refund'
--     20  refund  refunded    18:31  note=''
--     20  note                23:16  'refund processed back to your card ...'
--
-- Three of the four refunds on the site read that way, and the 23:16 line is
-- addressed to the member in so many words -- "your card", "thanks" -- in a
-- box they cannot open. Telling the club otherwise in helper text has been
-- tried and is what is on screen in their own screenshot.
--
-- So a typed note carries an audience, and the club says per note who it is
-- for. The default is the club, which is the whole of the safety here: every
-- note written before today keeps the promise it was written under, and
-- nothing anybody has already typed becomes readable by somebody it was not
-- readable by yesterday.

alter table public.club_money_events
  add column if not exists audience text not null default 'club';

alter table public.club_money_events
  drop constraint if exists club_money_events_audience_check;
alter table public.club_money_events
  add constraint club_money_events_audience_check
  check (audience in ('club', 'member'));

comment on column public.club_money_events.audience is
  'Who may read a typed note. The automatic lines ignore it: a payment, a '
  'refund or a status move is the member''s own money and always theirs to read.';


-- A new parameter makes a new function, so the old signature goes first.
drop function if exists public.add_money_note(text, bigint, text, text);

create or replace function public.add_money_note(
  p_scope text, p_entity bigint, p_side text default '',
  p_note text default '', p_audience text default 'club'
) returns bigint
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_club bigint;
  v_profile uuid;
  v_who text := coalesce(nullif(btrim(p_audience), ''), 'club');
  v_id bigint;
begin
  if btrim(coalesce(p_note, '')) = '' then
    raise exception 'NOTE_EMPTY' using errcode = 'check_violation';
  end if;

  if v_who not in ('club', 'member') then
    raise exception 'NOTE_AUDIENCE_UNKNOWN' using errcode = 'check_violation';
  end if;

  select club_id, profile_id into v_club, v_profile
    from public.money_entity_owner(p_scope, p_entity);

  if not found then
    raise exception 'ENTITY_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  -- The club's team writes notes about its own money; an admin writes them
  -- about a listing, which has no club team. A member reads and does not
  -- write: the log is the club's record of what arrived.
  if not (public.is_admin()
          or (v_club is not null and public.can_manage_club(v_club))) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  insert into public.club_money_events (
    club_id, scope, entity_id, side, profile_id, kind, note,
    happened_at, author_id, automatic, audience)
  values (v_club, p_scope, p_entity, coalesce(p_side, ''), v_profile, 'note',
          left(btrim(p_note), 2000), now(), auth.uid(), false, v_who)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.add_money_note(text, bigint, text, text, text)
  from public, anon;
grant execute on function public.add_money_note(text, bigint, text, text, text)
  to authenticated;


-- A `returns table` signature cannot change under `create or replace`, and
-- the audience has to come back so the club's own log can say which of its
-- notes the member is reading. Grants are restated because the drop takes
-- them with it.
drop function if exists public.club_money_history(text, bigint[]);

create or replace function public.club_money_history(
  p_scope text, p_entities bigint[]
) returns table (
  id bigint, entity_id bigint, side text, kind text, state text,
  method text, note text, happened_at timestamptz, automatic boolean,
  author_name text, audience text
)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.entity_id, e.side, e.kind, e.state, e.method, e.note,
         e.happened_at, e.automatic,
         coalesce(p.full_name, ''), e.audience
    from public.club_money_events e
    left join public.profiles p on p.id = e.author_id
   where e.scope = p_scope
     and e.entity_id = any (coalesce(p_entities, array[]::bigint[]))
     and (public.is_admin()
          or (e.club_id is not null and public.can_manage_club(e.club_id))
          -- A member reads the money that is theirs, every automatic line
          -- about it, and a typed note only where the club said so. The rest
          -- of the log stays the club's own working record, which is what it
          -- has been since 0020 and what every note already in the table was
          -- written under.
          or (e.profile_id is not null and e.profile_id = auth.uid()
              and (e.kind <> 'note' or e.audience = 'member')))
   order by e.happened_at, e.id
$$;

revoke all on function public.club_money_history(text, bigint[])
  from public, anon;
grant execute on function public.club_money_history(text, bigint[])
  to authenticated;


-- A correction is dated when it was made, not when the money moved.
--
-- 0237 made an edited refund note write its own event, which is right. It
-- stamped it with `refunded_at` though, so correcting the wording on an order
-- refunded at 18:31 wrote a second line also at 18:31, and the member read
-- two identical-looking refunds. The money moved when it moved; the sentence
-- describing it changed just now. That is the distinction `edited_at` already
-- draws on a listing payment, said here for the one section that can be
-- edited from a screen.
create or replace function public.club_merchandise_orders_money_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.status, new.refund_method, new.refund_note)
     is not distinct from (old.status, old.refund_method, old.refund_note) then
    return null;
  end if;

  perform public.log_money_event(
    new.club_id, 'order', new.id, '', new.profile_id,
    case when new.status = 'paid' then 'payment'
         when new.status in ('refunded', 'refund_due') then 'refund'
         else 'status' end,
    new.status,
    case when new.status in ('refunded', 'refund_due') then new.refund_method else '' end,
    case when new.status in ('refunded', 'refund_due') then new.refund_note else '' end,
    case when new.status is distinct from old.status
         then coalesce(new.refunded_at, now())
         else now() end,
    true);

  return null;
end;
$$;
