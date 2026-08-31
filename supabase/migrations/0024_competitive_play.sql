-- 0024 · Competitive play: leagues, ladders and campaigns
--
-- The club page's "Campaigns and leagues" panel (detail.js:411). Legacy keeps
-- the whole thing in one competitivePlay array per club; here it is four
-- tables, because standings and round results are rows people sort and filter,
-- not a blob rendered whole.
--
-- One deliberate omission: legacy hangs a full army list off every standing and
-- every match, snapshotted down to unit points. That is the army builder, which
-- is Milestone 3. The faction and detachment come across as text, since those
-- are what the standings table actually prints; the link to a stored list can
-- be added later without moving any of this.

create table public.club_competitions (
  id bigint generated always as identity primary key,
  club_id bigint not null references public.clubs (id) on delete cascade,
  -- Legacy's own slug for the competition, so a re-import updates rather than
  -- duplicates.
  legacy_id text not null default '',
  title text not null,
  -- league | ladder | campaign. Kept as text with the club's own label beside
  -- it: legacy lets an owner write "Escalation League" over the type.
  type text not null default 'league',
  type_label text not null default '',
  status text not null default 'active',
  status_label text not null default '',
  season text not null default '',
  game text not null default '',
  summary text not null default '',
  start_date date,
  end_date date,
  position smallint not null default 0,
  created_at timestamptz not null default now()
);
create index club_competitions_club_idx on public.club_competitions (club_id, status, position);
create unique index club_competitions_legacy_idx
  on public.club_competitions (club_id, legacy_id) where legacy_id <> '';

create table public.club_competition_standings (
  id bigint generated always as identity primary key,
  competition_id bigint not null references public.club_competitions (id) on delete cascade,
  -- Null for imported rows: the legacy player ids belong to accounts that were
  -- never migrated. Same call as club_event_results.
  profile_id uuid references public.profiles (id) on delete set null,
  member_name text not null default '',
  rank smallint not null default 0,
  played smallint not null default 0,
  wins smallint not null default 0,
  draws smallint not null default 0,
  losses smallint not null default 0,
  points integer not null default 0,
  -- "4-0-1", as the club writes it. Derivable from wins/draws/losses, but the
  -- club may order it differently and legacy prints what was typed.
  record_label text not null default '',
  notes text not null default '',
  faction text not null default '',
  detachment text not null default ''
);
create index club_competition_standings_idx
  on public.club_competition_standings (competition_id, rank);

create table public.club_competition_updates (
  id bigint generated always as identity primary key,
  competition_id bigint not null references public.club_competitions (id) on delete cascade,
  posted_on date,
  title text not null default '',
  summary text not null default '',
  position smallint not null default 0
);
create index club_competition_updates_idx
  on public.club_competition_updates (competition_id, posted_on desc);

create table public.club_competition_matches (
  id bigint generated always as identity primary key,
  update_id bigint not null references public.club_competition_updates (id) on delete cascade,
  player_one text not null default '',
  player_one_score text not null default '',
  player_two text not null default '',
  player_two_score text not null default '',
  position smallint not null default 0
);
create index club_competition_matches_idx
  on public.club_competition_matches (update_id, position);

-- Public, like the rest of the club page. Legacy renders this panel outside its
-- member-content gate (detail.js:411): a league table is how a club advertises
-- that it runs leagues.
alter table public.club_competitions           enable row level security;
alter table public.club_competition_standings  enable row level security;
alter table public.club_competition_updates    enable row level security;
alter table public.club_competition_matches    enable row level security;

create policy club_competitions_public on public.club_competitions
  for select to anon, authenticated using (true);
create policy club_competition_standings_public on public.club_competition_standings
  for select to anon, authenticated using (true);
create policy club_competition_updates_public on public.club_competition_updates
  for select to anon, authenticated using (true);
create policy club_competition_matches_public on public.club_competition_matches
  for select to anon, authenticated using (true);

-- Writes are the owner's, through the same helper every other club-owned table
-- uses. There is no UI for it yet; the editor is Milestone 3.
create policy club_competitions_manage on public.club_competitions
  for all to authenticated
  using (public.can_manage_club(club_id))
  with check (public.can_manage_club(club_id));

create policy club_competition_standings_manage on public.club_competition_standings
  for all to authenticated
  using (exists (select 1 from public.club_competitions c
                  where c.id = competition_id and public.can_manage_club(c.club_id)))
  with check (exists (select 1 from public.club_competitions c
                       where c.id = competition_id and public.can_manage_club(c.club_id)));

create policy club_competition_updates_manage on public.club_competition_updates
  for all to authenticated
  using (exists (select 1 from public.club_competitions c
                  where c.id = competition_id and public.can_manage_club(c.club_id)))
  with check (exists (select 1 from public.club_competitions c
                       where c.id = competition_id and public.can_manage_club(c.club_id)));

create policy club_competition_matches_manage on public.club_competition_matches
  for all to authenticated
  using (exists (select 1 from public.club_competition_updates u
                  join public.club_competitions c on c.id = u.competition_id
                 where u.id = update_id and public.can_manage_club(c.club_id)))
  with check (exists (select 1 from public.club_competition_updates u
                       join public.club_competitions c on c.id = u.competition_id
                      where u.id = update_id and public.can_manage_club(c.club_id)));

grant select on
  public.club_competitions, public.club_competition_standings,
  public.club_competition_updates, public.club_competition_matches
to anon, authenticated;

grant insert, update, delete on
  public.club_competitions, public.club_competition_standings,
  public.club_competition_updates, public.club_competition_matches
to authenticated;
