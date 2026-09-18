-- 0093 · A ticket's audience has exactly two values
--
-- `audience` is free text, and every reader compares it against the string
-- 'all': the eligibility trigger in 0067, the TS ladder in
-- `utils/ticket-eligibility.ts`, and legacy itself. Legacy gets away with the
-- looseness because it normalises on the way in
-- (`_normalise_ticket_audience`, club_store.py:15500), turning "public",
-- "open", "everyone" and five more into 'all'.
--
-- The Stage 3 editor wrote 'public' straight through, which meant a ticket the
-- club had marked open to everybody was refused to everybody in the browser,
-- and refused to non-members by the trigger. Found in testing, on a real
-- event, before anybody had bought one.
--
-- Two halves: fold what is already stored, then stop it happening again.

-- ------------------------------------------------------------------- the data

update public.club_event_ticket_types
   set audience = case
         when btrim(lower(coalesce(audience, ''))) in
              ('member', 'members', 'member-only', 'members-only', 'members only')
           then 'members'
         else 'all'
       end
 where audience is null
    or audience not in ('all', 'members');

-- ------------------------------------------------------------------- the rule
--
-- Null stays allowed: the trigger and the ladder both read a null as 'all',
-- and the imported rows predate anybody being required to say.

do $$
begin
  alter table public.club_event_ticket_types
    add constraint club_event_ticket_types_audience_check
    check (audience is null or audience in ('all', 'members'));
exception when duplicate_object then null;
end $$;

-- A row that slipped through would be a ticket nobody could buy, so fail the
-- migration rather than leave one behind.
do $$
declare bad integer;
begin
  select count(*) into bad from public.club_event_ticket_types
   where audience is not null and audience not in ('all', 'members');
  if bad > 0 then
    raise exception '% ticket types still carry an audience nothing reads', bad;
  end if;
end $$;
