-- 0011 · Announcement ids are per club, not global
--
-- Mana Wharf and Didcot both have an announcement with id=1 and id=2. 0008 used
-- the legacy id as a global primary key, which rejected the second club's rows.
-- Surrogate key now, with the legacy id kept and unique per club.

drop table if exists public.club_announcements;

create table public.club_announcements (
  id         bigint generated always as identity primary key,
  club_id    bigint not null references public.clubs (id) on delete cascade,
  legacy_id  integer,
  message    text not null,
  created_at timestamptz not null default now(),
  unique (club_id, legacy_id)
);

create index club_announcements_club_idx on public.club_announcements (club_id, created_at desc);

alter table public.club_announcements enable row level security;

create policy club_announce_public
  on public.club_announcements for select to anon, authenticated using (true);

grant select on public.club_announcements to anon, authenticated;
