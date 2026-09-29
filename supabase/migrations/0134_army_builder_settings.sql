-- 0134 · Whether a club runs the army builder at all
--
-- The switch every army screen reads. A club that plays board games sees
-- exactly the result dialog it sees today, and that is decided by this row
-- rather than by guessing from the club's game list: a club can list Warhammer
-- 40,000 and still not want a list builder, and a club can add it next week.
--
-- The four AI limits are here now and used in stage 11. They carry legacy's own
-- defaults (`settings.coachingDailyLimit` 5, `matchupDailyLimit` 2 in the
-- catalogue file) so the column list does not change under a working feature
-- later.
--
-- Checked on a throwaway Postgres: a member cannot write it, an owner can, a
-- helper cannot, and a club with no row reads as off rather than as an error.

create table public.club_army_builder_settings (
  club_id     bigint primary key references public.clubs (id) on delete cascade,
  enabled     boolean not null default false,
  edition_id  text references public.army_editions (id) on delete set null,
  coaching_daily_limit  integer not null default 5,
  matchup_daily_limit   integer not null default 2,
  scouting_daily_limit  integer not null default 2,
  season_daily_limit    integer not null default 2,
  monthly_ai_cap_pence  integer not null default 0,
  updated_at  timestamptz not null default now()
);

revoke insert, update, delete on public.club_army_builder_settings
  from authenticated, anon;
grant select on public.club_army_builder_settings to authenticated, anon;

alter table public.club_army_builder_settings enable row level security;

-- Public read: whether a club runs the builder decides what a visitor sees on
-- its page, and there is nothing private in a switch.
create policy club_army_builder_settings_select on public.club_army_builder_settings
  for select to authenticated, anon using (true);

do $$
declare v_bad boolean;
begin
  select bool_or(column_name is null) into v_bad from (
    select null::text as column_name from information_schema.role_table_grants
     where table_name = 'club_army_builder_settings' and grantee = 'authenticated'
       and privilege_type = 'INSERT'
    union all
    select column_name from information_schema.role_column_grants
     where table_name = 'club_army_builder_settings' and grantee = 'authenticated'
       and privilege_type = 'INSERT') g;
  if coalesce(v_bad, false) then
    raise exception 'club_army_builder_settings still carries a whole-table insert grant';
  end if;
end $$;

/**
 * The club turning it on.
 *
 * `listing.edit`, so an owner or a manager but not a helper: this decides what
 * every member of the club sees on a result dialog, which is a listing
 * decision rather than a night's work.
 */
create or replace function public.save_army_builder_settings(
  p_club bigint, p_enabled boolean, p_edition text default null
) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.club_can(p_club, 'listing.edit') then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  insert into public.club_army_builder_settings (club_id, enabled, edition_id, updated_at)
  values (p_club, coalesce(p_enabled, false), p_edition, now())
  on conflict (club_id) do update
    set enabled = excluded.enabled, edition_id = excluded.edition_id,
        updated_at = now();

  return true;
end $$;

/**
 * What a club runs, with the defaults filled in.
 *
 * A club with no row reads as off. Nobody has to remember to insert one when a
 * club is created, and a missing row can never read as an error on a page that
 * only wanted to know whether to draw a section.
 *
 * The edition and the version have to come from the SAME row. Reading the id
 * from the club and the version from whichever edition is active pairs a
 * club's pinned edition with somebody else's version, and a result would then
 * be validated against a catalogue it was never recorded from. One join, on
 * the edition the club actually runs.
 */
create or replace function public.army_builder_for(p_club bigint)
returns table (enabled boolean, edition_id text, catalogue_version text)
language sql stable security definer set search_path = public as $$
  select coalesce(s.enabled, false), ed.id, ed.catalogue_version
    from (select 1) one
    left join public.club_army_builder_settings s on s.club_id = p_club
    left join public.army_editions ed
      on ed.id = coalesce(s.edition_id,
                          (select id from public.army_editions
                            where status = 'active' limit 1))
$$;

revoke all on function public.save_army_builder_settings(bigint, boolean, text)
  from public, anon;
revoke all on function public.army_builder_for(bigint) from public, anon;
grant execute on function public.save_army_builder_settings(bigint, boolean, text)
  to authenticated;
grant execute on function public.army_builder_for(bigint) to authenticated, anon;
