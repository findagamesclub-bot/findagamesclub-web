-- 0083 · The listing becomes editable
--
-- Stage 2, step 1. Three things, all about `clubs` itself; the tables behind
-- the later steps get their own migrations as those steps are built.
--
-- 1. A manager can edit the listing. `club_can(club, 'listing.edit')` has said
--    so since 0067, but this table's policy predates that and still names
--    `owner_id`, so a manager held the capability and got a zero-row update.
--    Nothing surfaced it because a blocked update returns no error.
-- 2. `member_count` becomes writable. It is the figure the club puts on its own
--    header, deliberately not the size of the roster, and readiness check 4
--    asks for it.
-- 3. Moving a club marks it for re-geocoding. Coordinates are never writable
--    from the browser, so changing a postcode has to leave a note for the job
--    that does it, rather than the form sending a latitude.

-- --------------------------------------------------------------- who may edit

drop policy if exists clubs_update_own on public.clubs;

-- Named for what it means now. The old name said "own", which is exactly the
-- thing that stopped being true.
create policy clubs_update_team on public.clubs
  for update to authenticated
  using (public.club_can(id, 'listing.edit'))
  with check (public.club_can(id, 'listing.edit'));

-- The club's own figure for how many members it has. Not the roster: a club
-- that has been running for ten years says 148 and has forty accounts here.
grant update (member_count) on public.clubs to authenticated;

-- ------------------------------------------------------------ re-geocoding

alter table public.clubs
  add column if not exists geocode_stale boolean not null default false;

-- Only the job that geocodes may clear it, and only the trigger sets it, so it
-- is not in any grant. A browser that could clear this could pin its club
-- anywhere by moving and then lying about it.

create or replace function public.clubs_mark_geocode_stale()
returns trigger
language plpgsql
as $$
begin
  -- Postcode drives the pin; the address is what a human reads. Either one
  -- changing means the coordinates on file describe the old place.
  if new.venue_postcode is distinct from old.venue_postcode
     or new.venue_address is distinct from old.venue_address then
    new.geocode_stale := true;
  end if;
  return new;
end;
$$;

drop trigger if exists clubs_geocode_stale on public.clubs;
create trigger clubs_geocode_stale
  before update on public.clubs
  for each row execute function public.clubs_mark_geocode_stale();

create index if not exists clubs_geocode_stale_idx
  on public.clubs (updated_at) where geocode_stale;

-- --------------------------------------------------------------------- guard

-- The whole-table grant hazard, checked rather than assumed: a `grant update`
-- with a column list is additive and does nothing if the table already carries
-- a bare grant from Supabase's defaults.
do $$
declare bad boolean;
begin
  select bool_or(column_name is null) into bad from (
    select null::text as column_name from information_schema.role_table_grants
     where table_name = 'clubs' and grantee = 'authenticated' and privilege_type = 'UPDATE'
    union all
    select column_name from information_schema.role_column_grants
     where table_name = 'clubs' and grantee = 'authenticated' and privilege_type = 'UPDATE'
  ) g;
  if bad then
    raise exception 'clubs carries a whole-table UPDATE grant; the column list is inert';
  end if;
end $$;
