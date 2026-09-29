-- 0143 · Army lists and their versions
--
-- The client asked for "Army Builder, with the catalogue an admin maintains"
-- and "Army lists, list analysis, opponent scouting and season coaching (see
-- local app to see how it works now)". Stage 8 built the catalogue. This is
-- what members build out of it.
--
-- Two tables, not one, and the split is the whole design. `army_lists` is the
-- thing somebody names and comes back to; `army_list_versions` is what it was
-- at each point it changed. A result links to a VERSION, never to the list, so
-- "what did she bring in April" survives every edit since.
--
-- Legacy's rule for when a version happens (`update_army_list`,
-- club_store.py:6950): a save writes a new version only when the signature
-- moves. The signature covers the edition, the catalogue version, the list
-- type, the system, the points limit, the faction, the detachment and
-- disposition pairs, and each unit's name, option and quantity. It does NOT
-- cover the list's name or any points figure, so renaming saves in place and
-- a re-price against the same catalogue is not a new army.
--
-- Deleting is soft, where legacy pops the row (7012). Stage 8 gave
-- `game_result_armies` a list and a version to point at, so a hard delete
-- would take the evidence out from under a game somebody already played.
--
-- Checked on a throwaway Postgres built from every migration: nobody may write
-- either table directly, a member reads their clubmates' lists and cannot edit
-- them, somebody at another club reads nothing, a version cannot be altered
-- once a later one exists, and a soft-deleted list is invisible to everyone.

create table public.army_lists (
  id                 bigint generated always as identity primary key,
  club_id            bigint not null references public.clubs (id) on delete cascade,
  profile_id         uuid not null references public.profiles (id) on delete cascade,
  name               text not null default '',
  -- Legacy folds every spelling to these two (`_normalise_army_list_type`,
  -- club_store.py:17200). A collection has no points limit and no detachment,
  -- which is a list type rather than a second feature.
  list_type          text not null default 'army-list'
                       check (list_type in ('army-list', 'collection')),
  system_id          text not null default '',
  edition_id         text not null default '',
  faction_id         text not null default '',
  faction_label      text not null default '',
  points_limit       text not null default '',
  current_version_id bigint,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  constraint army_lists_name_present check (btrim(name) <> '')
);

create table public.army_list_versions (
  id                     bigint generated always as identity primary key,
  list_id                bigint not null references public.army_lists (id) on delete cascade,
  version_number         int not null check (version_number >= 1),
  -- The name rides on the version so a restored version restores what it was
  -- called, even though the name is outside the signature.
  name                   text not null default '',
  list_type              text not null default 'army-list',
  faction_id             text not null default '',
  faction_label          text not null default '',
  detachment_selections  jsonb not null default '[]'::jsonb,
  -- One entry per line: unitName, optionLabel, optionModelCount, quantity,
  -- unitPoints, linePoints. Already merged and sorted by the writer, so the
  -- signature can treat the order as meaningful.
  units                  jsonb not null default '[]'::jsonb,
  points_limit           text not null default '',
  total_points           int not null default 0 check (total_points >= 0),
  edition_id             text not null default '',
  catalogue_version      text not null default '',
  change_summary         text not null default '',
  signature              text not null default '',
  created_at             timestamptz not null default now(),
  unique (list_id, version_number)
);

alter table public.army_lists
  add constraint army_lists_current_version_fk
  foreign key (current_version_id) references public.army_list_versions (id)
  on delete set null;

-- A member's own shelf, newest first, which is how both screens read it.
create index army_lists_mine_idx
  on public.army_lists (profile_id, updated_at desc)
  where deleted_at is null;

-- Everything at one club, which is the club builder's own list.
create index army_lists_club_idx
  on public.army_lists (club_id, updated_at desc)
  where deleted_at is null;

create index army_list_versions_list_idx
  on public.army_list_versions (list_id, version_number desc);

revoke insert, update, delete on public.army_lists from authenticated, anon;
revoke insert, update, delete on public.army_list_versions from authenticated, anon;
grant select on public.army_lists to authenticated;
grant select on public.army_list_versions to authenticated;

alter table public.army_lists enable row level security;
alter table public.army_list_versions enable row level security;

/**
 * Who may read a list.
 *
 * Legacy's answer, which is wider than people expect: every list at the club
 * is readable by every member who passes the builder's own gate
 * (`list_visible_army_lists`, club_store.py:6811). That is deliberate, and it
 * is what makes scouting a clubmate before Thursday possible at all. Only the
 * owner may change one, which is a separate question answered by the writers
 * in 0144 rather than by a policy here, since nothing is granted anyway.
 *
 * The gate itself is not re-checked here. A member who loses their tier keeps
 * being able to READ what the club can already see; what they lose is the
 * ability to write, which is where the ladder is enforced. Hiding rows from
 * somebody on the wrong tier would also hide their own lists from them, which
 * is the opposite of what a tier is for.
 */
create policy army_lists_select on public.army_lists
  for select to authenticated
  using (
    deleted_at is null
    and (profile_id = (select auth.uid())
         or public.is_club_member(club_id)
         or public.can_manage_club(club_id))
  );

create policy army_list_versions_select on public.army_list_versions
  for select to authenticated
  using (exists (
    select 1 from public.army_lists l
     where l.id = list_id
       and l.deleted_at is null
       and (l.profile_id = (select auth.uid())
            or public.is_club_member(l.club_id)
            or public.can_manage_club(l.club_id))
  ));

/**
 * A version is written once and never edited again, except the newest one.
 *
 * The exception is not a loophole, it is legacy's behaviour: a save whose
 * signature has not moved rewrites the current version in place rather than
 * stacking a duplicate (`update_army_list`, club_store.py:6990). Anything
 * earlier is what somebody played, and what a result points at.
 */
create or replace function public.army_list_version_frozen()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.army_list_versions v
              where v.list_id = old.list_id
                and v.version_number > old.version_number) then
    raise exception 'ARMY_VERSION_FROZEN'
      using errcode = 'insufficient_privilege',
            hint = 'A version with a later one after it cannot be changed.';
  end if;
  return new;
end $$;

create trigger army_list_versions_frozen
  before update or delete on public.army_list_versions
  for each row execute function public.army_list_version_frozen();

create or replace function public.army_lists_touch()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger army_lists_touched
  before update on public.army_lists
  for each row execute function public.army_lists_touch();

do $$
declare v_bad boolean; v_table text;
begin
  foreach v_table in array array['army_lists', 'army_list_versions'] loop
    select bool_or(column_name is null) into v_bad from (
      select null::text as column_name from information_schema.role_table_grants
       where table_name = v_table and grantee = 'authenticated'
         and privilege_type = 'INSERT'
      union all
      select column_name from information_schema.role_column_grants
       where table_name = v_table and grantee = 'authenticated'
         and privilege_type = 'INSERT') g;
    if coalesce(v_bad, false) then
      raise exception '% still carries a whole-table insert grant', v_table;
    end if;
  end loop;
end $$;
