-- 0091 · A round's matches become rows
--
-- `club_event_pairings.matches` is a jsonb array, which means editing one
-- table rewrites the round: two people entering scores at the same tournament
-- overwrite each other, and nothing can point at a single match. Rows fix
-- both, and they are what Stage 8's army fields will hang off.
--
-- The jsonb column stays for now, untouched and unread. Dropping it in the
-- same migration that copies out of it leaves no way back if the copy is
-- wrong, and it costs nothing to keep until the screens have been used.

create table if not exists public.club_event_pairing_matches (
  id            bigint generated always as identity primary key,
  pairing_id    bigint not null references public.club_event_pairings (id) on delete cascade,
  event_id      bigint not null references public.club_events (id) on delete cascade,
  table_label   text not null default '',
  player_one    text not null default '',
  player_one_id uuid references public.profiles (id) on delete set null,
  player_two    text not null default '',
  player_two_id uuid references public.profiles (id) on delete set null,
  score_one     integer,
  score_two     integer,
  position      smallint not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists club_event_pairing_matches_pairing_idx
  on public.club_event_pairing_matches (pairing_id, position);
create index if not exists club_event_pairing_matches_event_idx
  on public.club_event_pairing_matches (event_id);

-- Whether members can see the draw yet. A round being built is the club's.
alter table public.club_event_pairings
  add column if not exists published boolean not null default true;

-- --------------------------------------------------------------- the copy
--
-- Legacy wrote the player's name under three different keys over the years
-- (`playerOneName`, `playerOne`, `player1`), which the reader in
-- eventDetail.service.ts already has to cope with. The copy reads all three
-- so nothing imported is lost.

insert into public.club_event_pairing_matches
  (pairing_id, event_id, table_label, player_one, player_two, score_one, score_two, position)
select p.id,
       p.event_id,
       coalesce(m.value ->> 'table', ''),
       coalesce(m.value ->> 'playerOneName', m.value ->> 'playerOne', m.value ->> 'player1', ''),
       coalesce(m.value ->> 'playerTwoName', m.value ->> 'playerTwo', m.value ->> 'player2', ''),
       nullif(m.value ->> 'playerOneScore', '')::integer,
       nullif(m.value ->> 'playerTwoScore', '')::integer,
       (m.ordinality - 1)::smallint
  from public.club_event_pairings p
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(p.matches) = 'array' then p.matches else '[]'::jsonb end
  ) with ordinality as m(value, ordinality)
 where not exists (select 1 from public.club_event_pairing_matches x where x.pairing_id = p.id)
   and coalesce(m.value ->> 'playerOneName', m.value ->> 'playerOne', m.value ->> 'player1',
                m.value ->> 'playerTwoName', m.value ->> 'playerTwo', m.value ->> 'player2', '') <> '';

-- Names that match a member of the club become links to that member, the way
-- legacy resolves them on every read (`resolve_player`, club_store.py:14819).
update public.club_event_pairing_matches m
   set player_one_id = p.id
  from public.club_events e
  join public.profiles p on lower(btrim(p.full_name)) <> ''
 where m.event_id = e.id
   and m.player_one_id is null
   and lower(btrim(m.player_one)) = lower(btrim(p.full_name))
   and exists (select 1 from public.club_memberships cm
                where cm.club_id = e.club_id and cm.profile_id = p.id
                  and cm.status = 'approved');

update public.club_event_pairing_matches m
   set player_two_id = p.id
  from public.club_events e
  join public.profiles p on lower(btrim(p.full_name)) <> ''
 where m.event_id = e.id
   and m.player_two_id is null
   and lower(btrim(m.player_two)) = lower(btrim(p.full_name))
   and exists (select 1 from public.club_memberships cm
                where cm.club_id = e.club_id and cm.profile_id = p.id
                  and cm.status = 'approved');

-- ------------------------------------------------------------------ access

alter table public.club_event_pairing_matches enable row level security;

revoke insert, update, delete on
  public.club_event_pairings, public.club_event_pairing_matches
  from authenticated, anon;

/**
 * A draw is readable once the club publishes it.
 *
 * Who may see a published draw is decided a layer up, on the event page, which
 * already gates pairings behind holding a ticket. This policy only hides the
 * rounds the club has not finished building.
 */
-- Split by role for the reason 0090 spells out: `club_can` is revoked from
-- `anon`, so naming it in a policy that anon evaluates fails the read outright.
drop policy if exists event_pairings_public on public.club_event_pairings;
drop policy if exists event_pairings_public_anon on public.club_event_pairings;

create policy event_pairings_public_anon on public.club_event_pairings
  for select to anon using (published);

create policy event_pairings_public on public.club_event_pairings
  for select to authenticated
  using (published or exists (select 1 from public.club_events e
                               where e.id = event_id
                                 and public.club_can(e.club_id, 'events.manage')));

drop policy if exists event_pairing_matches_public on public.club_event_pairing_matches;
drop policy if exists event_pairing_matches_public_anon on public.club_event_pairing_matches;

create policy event_pairing_matches_public_anon on public.club_event_pairing_matches
  for select to anon
  using (exists (select 1 from public.club_event_pairings p
                  where p.id = pairing_id and p.published));

create policy event_pairing_matches_public on public.club_event_pairing_matches
  for select to authenticated
  using (exists (select 1 from public.club_event_pairings p
                  where p.id = pairing_id
                    and (p.published or exists (select 1 from public.club_events e
                                                 where e.id = p.event_id
                                                   and public.club_can(e.club_id, 'events.manage')))));

drop policy if exists event_pairings_write on public.club_event_pairings;
create policy event_pairings_write on public.club_event_pairings
  for all to authenticated
  using (exists (select 1 from public.club_events e
                  where e.id = event_id and public.club_can(e.club_id, 'events.manage')))
  with check (exists (select 1 from public.club_events e
                       where e.id = event_id and public.club_can(e.club_id, 'events.manage')));

drop policy if exists event_pairing_matches_write on public.club_event_pairing_matches;
create policy event_pairing_matches_write on public.club_event_pairing_matches
  for all to authenticated
  using (exists (select 1 from public.club_events e
                  where e.id = event_id and public.club_can(e.club_id, 'events.manage')))
  with check (exists (select 1 from public.club_events e
                       where e.id = event_id and public.club_can(e.club_id, 'events.manage')));

grant select on public.club_event_pairing_matches to anon, authenticated;

grant insert (event_id, round, label, published), update (round, label, published)
  on public.club_event_pairings to authenticated;

grant insert (pairing_id, event_id, table_label, player_one, player_one_id,
              player_two, player_two_id, score_one, score_two, position),
      update (table_label, player_one, player_one_id, player_two, player_two_id,
              score_one, score_two, position)
  on public.club_event_pairing_matches to authenticated;

grant delete on
  public.club_event_pairings, public.club_event_pairing_matches to authenticated;

-- -------------------------------------------------------------- the refusal

/**
 * A round beyond the event's own round count.
 *
 * Legacy raises "Event pairings round cannot exceed the number of rounds."
 * (club_store.py:14858) and so does this, because a round 6 in a five round
 * tournament is a typo that would otherwise sit there looking real.
 */
create or replace function public.club_event_pairings_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rounds integer;
begin
  if new.round is null or new.round < 1 then
    raise exception 'PAIRING_ROUND_OUT_OF_RANGE: a round starts at 1'
      using errcode = 'check_violation';
  end if;

  select round_count into rounds from public.club_events where id = new.event_id;

  if rounds is not null and rounds > 0 and new.round > rounds then
    raise exception 'PAIRING_ROUND_OUT_OF_RANGE: this event has % rounds', rounds
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists club_event_pairings_round on public.club_event_pairings;
create trigger club_event_pairings_round
  before insert or update on public.club_event_pairings
  for each row execute function public.club_event_pairings_guard();

-- One round row per round, so two people building round two cannot make two.
create unique index if not exists club_event_pairings_one_per_round
  on public.club_event_pairings (event_id, round);

do $$
declare bad boolean;
begin
  select bool_or(column_name is null) into bad from (
    select null::text as column_name from information_schema.role_table_grants
     where table_name in ('club_event_pairings', 'club_event_pairing_matches')
       and grantee = 'authenticated' and privilege_type in ('INSERT', 'UPDATE')
    union all
    select column_name from information_schema.role_column_grants
     where table_name in ('club_event_pairings', 'club_event_pairing_matches')
       and grantee = 'authenticated' and privilege_type in ('INSERT', 'UPDATE')
  ) g;
  if bad then
    raise exception 'a pairings table carries a whole-table grant';
  end if;
end $$;
