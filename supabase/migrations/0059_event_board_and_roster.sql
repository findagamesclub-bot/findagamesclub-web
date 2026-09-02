-- 0059 · The event board, and who else is going
--
-- Two gaps against legacy's event page, both behind the same gate.
--
-- 1. The roster. Legacy shows "Players signed up" to anyone holding a ticket,
--    not only to the club (_can_access_event_board, club_store.py:16187).
--    Ours was club-only, so a member who had paid could not see who else was
--    turning up, which is the thing you want to know before a tournament.
--    club_event_bookings_select (0015) shows a member their own booking and
--    nothing else, so this reads past it.
--
-- 2. The discussion board. Legacy has a page per event with posts and replies
--    (/clubs/<slug>/events/<id>/board). We had none.
--
-- A separate pair of tables rather than an event column on
-- club_discussion_posts: the club board is organised by category, which an
-- event has no use for, and widening a busy table's RLS to carry a second
-- audience is how a board ends up readable by the wrong people.

/**
 * Holding a ticket, or running the club.
 *
 * Mirrors legacy's _can_access_event_board. Security definer because the
 * caller cannot see other people's bookings, and this has to count them.
 */
create or replace function public.can_access_event_board(target_event bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.club_event_bookings b
     where b.event_id = target_event
       and b.profile_id = (select auth.uid())
       and b.status <> 'cancelled'
  ) or exists (
    select 1 from public.club_events e
     where e.id = target_event
       and public.can_manage_club(e.club_id)
  );
$$;

revoke all on function public.can_access_event_board(bigint) from public, anon;
grant execute on function public.can_access_event_board(bigint) to authenticated;

/**
 * Who is signed up, as a fellow attendee may see it.
 *
 * Deliberately not the club's view: no email, no booking reference and no
 * money. One row per person rather than per trip through checkout, because
 * three bookings for the same day is one fact to a reader.
 */
create or replace function public.club_event_roster(p_event bigint)
returns table (
  profile_id uuid,
  full_name text,
  is_member boolean,
  tickets integer,
  bookings integer,
  first_booked timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  -- Counted from the items in a subquery rather than joined in: joining the
  -- items multiplies the booking rows, and count(distinct b.id) would be the
  -- only figure left that still reads true.
  with tickets as (
    select b.id,
           b.profile_id,
           -- The name typed at checkout, which is what the club prints on a
           -- door list. Their profile name only stands in if it was blank.
           coalesce(nullif(btrim(b.full_name), ''),
                    nullif(btrim(p.full_name), ''),
                    'Guest')                             as who,
           b.created_at,
           coalesce((select sum(i.quantity)
                       from public.club_event_booking_items i
                      where i.booking_id = b.id), 0)::integer as seats
      from public.club_event_bookings b
      left join public.profiles p on p.id = b.profile_id
     where b.event_id = p_event
       and b.status <> 'cancelled'
       and public.can_access_event_board(p_event)
  )
  select
    t.profile_id,
    t.who,
    t.profile_id is not null      as is_member,
    sum(t.seats)::integer         as tickets,
    count(*)::integer             as bookings,
    min(t.created_at)             as first_booked
  from tickets t
  -- Grouped by person, not by booking: three trips through checkout for the
  -- same day is one fact to a reader.
  group by t.profile_id, t.who
  order by min(t.created_at), t.who;
$$;

revoke all on function public.club_event_roster(bigint) from public, anon;
grant execute on function public.club_event_roster(bigint) to authenticated;

-- ---------------------------------------------------------------- the board

create table public.club_event_board_posts (
  id                bigint generated always as identity primary key,
  event_id          bigint not null references public.club_events (id) on delete cascade,
  author_profile_id uuid   not null default auth.uid()
                    references public.profiles (id) on delete cascade,
  title             text   not null,
  content           text   not null,
  -- Soft, matching the club board: a hard delete takes everybody's replies
  -- with it and leaves no trace of why a thread vanished.
  removed_at        timestamptz,
  removed_by        uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint club_event_board_posts_title_len
    check (char_length(btrim(title)) between 1 and 200),
  constraint club_event_board_posts_content_len
    check (char_length(btrim(content)) between 1 and 8000)
);

create index club_event_board_posts_event_idx
  on public.club_event_board_posts (event_id, created_at desc) where removed_at is null;

create table public.club_event_board_replies (
  id                bigint generated always as identity primary key,
  post_id           bigint not null references public.club_event_board_posts (id) on delete cascade,
  author_profile_id uuid   not null default auth.uid()
                    references public.profiles (id) on delete cascade,
  content           text   not null,
  removed_at        timestamptz,
  removed_by        uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  constraint club_event_board_replies_content_len
    check (char_length(btrim(content)) between 1 and 4000)
);

create index club_event_board_replies_post_idx
  on public.club_event_board_replies (post_id, created_at) where removed_at is null;

create trigger club_event_board_posts_set_updated_at
  before update on public.club_event_board_posts
  for each row execute function public.set_updated_at();

alter table public.club_event_board_posts   enable row level security;
alter table public.club_event_board_replies enable row level security;

create policy club_event_board_posts_select on public.club_event_board_posts
  for select to authenticated
  using (public.can_access_event_board(event_id));

create policy club_event_board_posts_insert on public.club_event_board_posts
  for insert to authenticated
  with check (
    author_profile_id = (select auth.uid())
    and public.can_access_event_board(event_id)
    and removed_at is null
  );

-- The author may withdraw their own; the club may remove anybody's. Pinned to
-- setting removed_at, so an update cannot rewrite somebody else's words.
create policy club_event_board_posts_remove on public.club_event_board_posts
  for update to authenticated
  using (
    removed_at is null
    and (author_profile_id = (select auth.uid())
         or exists (select 1 from public.club_events e
                     where e.id = event_id and public.can_manage_club(e.club_id)))
  )
  with check (removed_at is not null);

create policy club_event_board_replies_select on public.club_event_board_replies
  for select to authenticated
  using (exists (
    select 1 from public.club_event_board_posts p
     where p.id = post_id and public.can_access_event_board(p.event_id)
  ));

create policy club_event_board_replies_insert on public.club_event_board_replies
  for insert to authenticated
  with check (
    author_profile_id = (select auth.uid())
    and removed_at is null
    and exists (
      select 1 from public.club_event_board_posts p
       where p.id = post_id and p.removed_at is null
         and public.can_access_event_board(p.event_id)
    )
  );

create policy club_event_board_replies_remove on public.club_event_board_replies
  for update to authenticated
  using (
    removed_at is null
    and (author_profile_id = (select auth.uid())
         or exists (
           select 1 from public.club_event_board_posts p
            join public.club_events e on e.id = p.event_id
           where p.id = post_id and public.can_manage_club(e.club_id)))
  )
  with check (removed_at is not null);

-- Supabase's default privileges grant `authenticated` insert, update and
-- delete on the WHOLE of every new table in public, and a later column grant
-- is additive rather than a replacement. So the revoke has to come first or
-- the column lists below are decoration.
revoke insert, update, delete on public.club_event_board_posts   from authenticated, anon;
revoke insert, update, delete on public.club_event_board_replies from authenticated, anon;

grant select on public.club_event_board_posts, public.club_event_board_replies
  to authenticated;

grant insert (event_id, title, content) on public.club_event_board_posts to authenticated;
grant update (removed_at, removed_by)   on public.club_event_board_posts to authenticated;

grant insert (post_id, content)        on public.club_event_board_replies to authenticated;
grant update (removed_at, removed_by)  on public.club_event_board_replies to authenticated;
