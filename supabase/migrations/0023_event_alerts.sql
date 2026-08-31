-- Save an event search and hear about new matches.
--
-- The filters are stored as jsonb rather than a column per filter: the filter
-- set is UI, and it has already changed twice. A column per filter means a
-- migration every time somebody adds a dropdown.
create table if not exists public.club_event_alerts (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  label text not null,
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  last_sent_at timestamptz
);

create index if not exists club_event_alerts_profile
  on public.club_event_alerts (profile_id, created_at desc);

-- The same search saved twice is one alert, not two.
create unique index if not exists club_event_alerts_one_per_search
  on public.club_event_alerts (profile_id, md5(filters::text));

alter table public.club_event_alerts enable row level security;

-- Supabase grants `authenticated` the whole table on create. Revoke first or
-- the column list below is inert — see CLAUDE.md.
revoke insert, update, delete on public.club_event_alerts from authenticated, anon;
grant select on public.club_event_alerts to authenticated;
grant insert (profile_id, label, filters) on public.club_event_alerts to authenticated;
grant delete on public.club_event_alerts to authenticated;

create policy club_event_alerts_select on public.club_event_alerts
  for select to authenticated
  using (profile_id = (select auth.uid()));

create policy club_event_alerts_insert on public.club_event_alerts
  for insert to authenticated
  with check (profile_id = (select auth.uid()));

create policy club_event_alerts_delete on public.club_event_alerts
  for delete to authenticated
  using (profile_id = (select auth.uid()));
