-- 0014 · Table bookings, waiting lists, looking for games
--
-- One data model, three surfaces. Legacy synthesises a session from
-- club.schedule[index] + a date and keys everything on the string
-- "2026-04-16__0" (club_store.py:16017). That index is a position in an array,
-- so reordering the schedule silently repoints live bookings. Here a booking
-- points at club_sessions.id, which is stable, and keeps the legacy string in
-- legacy_session_key for import matching only.
--
-- Capacity is one integer per club (clubs.tables_available, club_store.py:3230).
-- Legacy counted rows and compared, which is a read-then-write race. Here every
-- booking owns a numbered table on that session and a partial unique index
-- makes two bookings on the same table impossible, so overbooking is a failed
-- insert rather than a lost table.

-- ---------------------------------------------------------------------------
-- 0. Two fixes to earlier migrations that this stage depends on
-- ---------------------------------------------------------------------------

-- benefits is a 29-key object in the source, but 0008 defaulted it to '[]'.
-- Every tier card on every club page currently renders zero benefits, and the
-- booking discount below reads this column, so it has to be an object first.
alter table public.club_membership_tiers alter column benefits set default '{}'::jsonb;
update public.club_membership_tiers set benefits = '{}'::jsonb where jsonb_typeof(benefits) = 'array';

-- 0008 granted select on club_membership_settings and nothing else, so an owner
-- cannot edit their own booking limits. RLS chooses rows, never columns, so the
-- write side needs a policy and a column grant.
create policy club_msettings_manage_insert
  on public.club_membership_settings for insert
  to authenticated
  with check (public.can_manage_club(club_id));

create policy club_msettings_manage_update
  on public.club_membership_settings for update
  to authenticated
  using (public.can_manage_club(club_id))
  with check (public.can_manage_club(club_id));

grant insert (club_id, basic_label, advance_booking_dates, upcoming_booking_limit,
              event_advance_days, looking_for_game_future_dates,
              looking_for_game_post_limit, loyalty_redemption_cap_percent)
  on public.club_membership_settings to authenticated;
grant update (basic_label, advance_booking_dates, upcoming_booking_limit,
              event_advance_days, looking_for_game_future_dates,
              looking_for_game_post_limit, loyalty_redemption_cap_percent)
  on public.club_membership_settings to authenticated;

-- Columns stay nullable with no default on purpose. Legacy reads five of the
-- six as `value or DEFAULT`, so a stored 0 means "use the default", while
-- upcoming_booking_limit keeps 0 to mean unlimited (club_store.py:13719-13753).
-- A column default cannot express that split; utils/booking-limits.ts does.

-- ---------------------------------------------------------------------------
-- 1. Per-club booking settings — the knobs that have no home today
-- ---------------------------------------------------------------------------
--
-- The six membership settings ARE already migrated (0008, club_membership_settings).
-- What is missing is the booking block: legacy keeps the table price under
-- club.loyaltyProgram.tableBookingPrice, which lives in CLUB_ENRICHMENTS and was
-- never exported, plus three windows that legacy hardcodes.

create table public.club_booking_settings (
  club_id                bigint primary key references public.clubs (id) on delete cascade,

  -- club_store.py:47, LOYALTY_DEFAULT_TABLE_BOOKING_PRICE = 'GBP 5'.
  table_booking_price    numeric(10,2) not null default 5.00 check (table_booking_price >= 0),
  price_currency         text not null default 'GBP',

  -- How far the calendar generates. Legacy disagrees with itself: the calendar
  -- builds 60 days (club_store.py:1917) and _find_booking_session accepts 120
  -- (:16683), so a member could POST past the end of their own calendar.
  calendar_horizon_days  smallint not null default 60
                           check (calendar_horizon_days between 1 and 120),

  -- Legacy enforces advance_booking_dates in the browser only. Off by default
  -- so turning it on is a visible decision, not a silent tightening.
  enforce_advance_window boolean not null default false,

  -- Legacy lets a member cancel only on a date strictly in the future
  -- (club_store.py:16224). 0 reproduces that: midnight at the start of the
  -- booking date, Europe/London. Any positive number is a real lead time.
  cancel_cutoff_hours    smallint not null default 0 check (cancel_cutoff_hours >= 0),

  waitlist_enabled       boolean not null default true,
  looking_for_games_enabled boolean not null default true,

  updated_at             timestamptz not null default now()
);

comment on table public.club_booking_settings is
  'Per-club booking knobs. Absent row means the defaults above; six of eleven clubs take no bookings at all.';

insert into public.club_booking_settings (club_id)
select id from public.clubs where coalesce(tables_available, 0) > 0
on conflict (club_id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------------------------

-- Every date rule in this stage is a club-night rule, and a club night is a
-- Europe/London wall-clock day. At 00:30 BST on the 21st a UTC database still
-- says the 20th, which would let a member cancel a booking that started an hour
-- ago. Nothing here may use current_date.
create or replace function public.london_today()
returns date
language sql
stable
set search_path = public
as $$
  select (now() at time zone 'Europe/London')::date;
$$;

revoke all on function public.london_today() from public;
grant execute on function public.london_today() to anon, authenticated;

-- The one money rule duplicated into SQL, and deliberately: the member cannot be
-- allowed to name their own discount, and column grants alone cannot stop them
-- because owners and members are both `authenticated`. Mirrors
-- _table_booking_pricing_for_user (club_store.py:14468-14488), including
-- waiveGameBookingFee forcing 100.
--
-- NOT yet mirrored: a paused tier reverts to basic (club_store.py:14301). The
-- schema has no pause columns yet — when Stage 2 adds tier_access_status, this
-- function and utils/booking-price.ts change together or they drift.
create or replace function public.booking_discount_percent(target_club bigint, target_profile uuid)
returns smallint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case
             when coalesce((t.benefits ->> 'waiveGameBookingFee')::boolean, false) then 100
             else least(100, greatest(0, coalesce((t.benefits ->> 'bookingDiscountPercent')::numeric, 0)))
           end
      from public.club_memberships m
      join public.club_membership_tiers t
        on t.club_id = m.club_id and t.tier_key = m.tier_key
     where m.club_id = target_club
       and m.profile_id = target_profile
       and m.status = 'approved'
       and m.tier_key is not null
     limit 1
  ), 0)::smallint;
$$;

revoke all on function public.booking_discount_percent(bigint, uuid) from public, anon;
grant execute on function public.booking_discount_percent(bigint, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Bookings
-- ---------------------------------------------------------------------------

create table public.club_bookings (
  id                bigint generated always as identity primary key,
  club_id           bigint not null references public.clubs (id) on delete cascade,

  -- restrict, not cascade. A schedule row with bookings on it must not be
  -- deletable: scripts/import-to-supabase.mjs:116 deletes club_sessions per club
  -- and reinserts them, which would otherwise orphan every booking in silence.
  club_session_id   bigint not null references public.club_sessions (id) on delete restrict,
  session_date      date   not null,

  -- What the slot said when it was booked. Legacy denormalises these
  -- (club_store.py:16361) and live data proves why: booking 1 reads
  -- '19:00-23:00' because the club edited the schedule afterwards.
  session_day       text not null default '',
  session_time      text not null default '',
  session_label     text not null default '',

  -- Which table, 0-based. Filled by the trigger below, never by the client.
  table_index       smallint not null default -1,

  game_title        text not null,
  notes             text not null default '',

  booked_by         uuid not null default auth.uid()
                      references public.profiles (id) on delete cascade,
  opponent_profile_id uuid references public.profiles (id) on delete set null,
  opponent_name     text not null default '',
  accepted_by       uuid references public.profiles (id) on delete set null,
  accepted_at       timestamptz,

  source            text not null default 'member'
                      check (source in ('member', 'waitlist', 'looking-for-game')),
  status            text not null default 'booked'
                      check (status in ('booked', 'cancelled')),
  cancelled_at      timestamptz,
  cancelled_by      uuid references public.profiles (id) on delete set null,
  cancel_reason     text,

  -- Frozen at booking time. A later price change must not rewrite history.
  price_currency        text not null default 'GBP',
  base_price            numeric(10,2) not null default 0,
  tier_discount_percent smallint      not null default 0 check (tier_discount_percent between 0 and 100),
  tier_discount_amount  numeric(10,2) not null default 0,
  loyalty_points_spent  integer       not null default 0 check (loyalty_points_spent >= 0),
  loyalty_discount_amount numeric(10,2) not null default 0,
  total_price           numeric(10,2) not null default 0 check (total_price >= 0),
  membership_tier_key   text,
  membership_tier_label text not null default '',

  legacy_id          bigint,
  legacy_session_key text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint club_bookings_cancel_pair check ((status = 'cancelled') = (cancelled_at is not null)),
  constraint club_bookings_not_self    check (opponent_profile_id is null or opponent_profile_id <> booked_by),
  constraint club_bookings_seat_range  check (table_index >= -1)
);

-- The whole anti-overbooking mechanism. One booking per numbered table per
-- session date; the trigger below refuses any index at or above the club's
-- tables_available. Together they cap the session at exactly capacity, with no
-- lock and no counting.
create unique index club_bookings_seat_uniq
  on public.club_bookings (club_session_id, session_date, table_index)
  where status = 'booked';

create index club_bookings_club_date_idx on public.club_bookings (club_id, session_date)
  where status = 'booked';
create index club_bookings_booked_by_idx on public.club_bookings (booked_by, session_date desc);
create index club_bookings_opponent_idx  on public.club_bookings (opponent_profile_id)
  where opponent_profile_id is not null;
create unique index club_bookings_legacy_uniq on public.club_bookings (club_id, legacy_id)
  where legacy_id is not null;

-- ---------------------------------------------------------------------------
-- 4. Participants — the exact port of _booking_involves_user
-- ---------------------------------------------------------------------------
--
-- Legacy's date-clash rule counts you as booked whether you booked, accepted, or
-- were merely named as somebody's opponent (club_store.py:16110-16142), and the
-- upcoming-bookings cap counts the same set (:14444). Neither can be expressed
-- as an index across three nullable columns, so participation is its own row.
-- Rows exist only while the booking is active, which makes the clash rule a
-- plain unique index and the cap a plain count.

create table public.club_booking_participants (
  booking_id   bigint not null references public.club_bookings (id) on delete cascade,
  profile_id   uuid   not null references public.profiles (id) on delete cascade,
  club_id      bigint not null references public.clubs (id) on delete cascade,
  session_date date   not null,
  role         text   not null check (role in ('booked_by', 'opponent', 'accepted_by')),
  primary key (booking_id, profile_id)
);

-- "You already have a booking for that club date." (club_store.py:3257)
create unique index club_booking_participants_one_per_date
  on public.club_booking_participants (club_id, profile_id, session_date);

create index club_booking_participants_upcoming_idx
  on public.club_booking_participants (profile_id, club_id, session_date);

create or replace function public.sync_booking_participants()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.club_booking_participants where booking_id = new.id;

  if new.status = 'booked' then
    -- distinct on keeps the strongest role when one person is on the booking
    -- twice, and the primary key would reject the duplicate otherwise.
    insert into public.club_booking_participants (booking_id, profile_id, club_id, session_date, role)
    select distinct on (p.profile_id)
           new.id, p.profile_id, new.club_id, new.session_date, p.role
      from (values (new.booked_by,           'booked_by',   1),
                   (new.opponent_profile_id, 'opponent',    2),
                   (new.accepted_by,         'accepted_by', 3)) as p(profile_id, role, rank)
     where p.profile_id is not null
     order by p.profile_id, p.rank;
  end if;

  return new;
end;
$$;

create trigger club_bookings_participants
  after insert or update of status, booked_by, opponent_profile_id, accepted_by, session_date
  on public.club_bookings
  for each row execute function public.sync_booking_participants();

-- ---------------------------------------------------------------------------
-- 5. Booking guards: validity, seat allocation, frozen price
-- ---------------------------------------------------------------------------

create or replace function public.club_bookings_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  slot public.club_sessions%rowtype;
  cap  integer;
  base numeric(10,2);
  pct  smallint;
begin
  select * into slot from public.club_sessions s where s.id = new.club_session_id;
  if slot.id is null or slot.club_id <> new.club_id then
    raise exception 'BOOKING_SESSION_NOT_FOUND' using errcode = 'check_violation';
  end if;

  -- The date must actually fall on the slot's weekday, or a member could book
  -- Thursday's table on a Tuesday. to_char is locale-dependent; the Supabase
  -- default lc_time is C, which gives English weekday names like the source.
  if nullif(btrim(slot.day), '') is not null
     and lower(btrim(slot.day)) <> lower(btrim(to_char(new.session_date, 'Day'))) then
    raise exception 'BOOKING_SESSION_WRONG_DAY' using errcode = 'check_violation';
  end if;

  if new.session_date < public.london_today() then
    raise exception 'BOOKING_SESSION_PAST' using errcode = 'check_violation';
  end if;

  select coalesce(c.tables_available, 0) into cap from public.clubs c where c.id = new.club_id;
  if cap <= 0 then
    raise exception 'BOOKING_CLOSED' using errcode = 'check_violation';
  end if;

  -- Lowest free table. The read is racy by design: two concurrent inserts can
  -- both pick the same index, and club_bookings_seat_uniq turns the loser into a
  -- 23505 the service retries. Overbooking is impossible either way.
  if new.table_index < 0 then
    select min(g.i) into new.table_index
      from generate_series(0, cap - 1) as g(i)
     where not exists (
       select 1 from public.club_bookings b
        where b.club_session_id = new.club_session_id
          and b.session_date    = new.session_date
          and b.status          = 'booked'
          and b.table_index     = g.i);
  end if;
  if new.table_index is null or new.table_index >= cap then
    raise exception 'BOOKING_NO_TABLES' using errcode = 'check_violation';
  end if;

  new.session_day   := coalesce(nullif(new.session_day,   ''), slot.day);
  new.session_time  := coalesce(nullif(new.session_time,  ''), slot.time);
  new.session_label := coalesce(nullif(new.session_label, ''), slot.label);
  new.legacy_session_key := coalesce(new.legacy_session_key,
                                     new.session_date::text || '__' || slot.position::text);

  -- Money is server-computed, always. The member has no insert grant on these
  -- columns, so whatever the client sends is discarded before it lands.
  select coalesce(s.table_booking_price, 5.00), coalesce(s.price_currency, 'GBP')
    into base, new.price_currency
    from public.club_booking_settings s where s.club_id = new.club_id;
  base := coalesce(base, 5.00);
  new.price_currency := coalesce(new.price_currency, 'GBP');

  pct := public.booking_discount_percent(new.club_id, new.booked_by);
  new.base_price            := base;
  new.tier_discount_percent := pct;
  new.tier_discount_amount  := round(base * pct / 100.0, 2);
  new.loyalty_points_spent  := 0;      -- redemption is out of Stage 3
  new.loyalty_discount_amount := 0;
  new.total_price           := greatest(base - new.tier_discount_amount, 0);

  select m.tier_key, coalesce(t.label, '')
    into new.membership_tier_key, new.membership_tier_label
    from public.club_memberships m
    left join public.club_membership_tiers t
      on t.club_id = m.club_id and t.tier_key = m.tier_key
   where m.club_id = new.club_id and m.profile_id = new.booked_by and m.status = 'approved'
   limit 1;
  new.membership_tier_label := coalesce(new.membership_tier_label, '');

  return new;
end;
$$;

create trigger club_bookings_guard
  before insert on public.club_bookings
  for each row execute function public.club_bookings_before_insert();

-- Cancellation stamps itself. cancelled_at and cancelled_by are not granted to
-- anyone, so a member cannot cancel in someone else's name or backdate it.
create or replace function public.club_bookings_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelled' and old.status = 'booked' then
    new.cancelled_at := now();
    new.cancelled_by := (select auth.uid());
  elsif new.status = old.status then
    new.cancelled_at := old.cancelled_at;
    new.cancelled_by := old.cancelled_by;
  else
    raise exception 'BOOKING_STATUS_LOCKED' using errcode = 'check_violation';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger club_bookings_stamp
  before update on public.club_bookings
  for each row execute function public.club_bookings_before_update();

-- ---------------------------------------------------------------------------
-- 6. Waiting list
-- ---------------------------------------------------------------------------

create table public.club_booking_waitlist (
  id              bigint generated always as identity primary key,
  club_id         bigint not null references public.clubs (id) on delete cascade,
  club_session_id bigint not null references public.club_sessions (id) on delete restrict,
  session_date    date   not null,
  session_day     text not null default '',
  session_time    text not null default '',
  session_label   text not null default '',

  game_title      text not null,
  notes           text not null default '',

  requested_by    uuid not null default auth.uid()
                    references public.profiles (id) on delete cascade,
  opponent_profile_id uuid references public.profiles (id) on delete set null,
  opponent_name   text not null default '',

  status          text not null default 'active'
                    check (status in ('active', 'promoted', 'skipped', 'withdrawn')),
  -- Legacy burns an entry the moment it fails one check (club_store.py:16578).
  -- Transient reasons now keep the member's place and record why they were
  -- passed over; only a terminal reason moves status to 'skipped'.
  last_skip_reason text check (last_skip_reason in ('date-clash', 'booking-limit', 'opponent-unavailable', 'not-a-member')),
  last_skipped_at  timestamptz,
  skip_count       smallint not null default 0,

  promoted_at     timestamptz,
  booking_id      bigint references public.club_bookings (id) on delete set null,
  withdrawn_at    timestamptz,

  legacy_id       bigint,
  created_at      timestamptz not null default now(),

  constraint club_booking_waitlist_promoted_pair
    check ((status = 'promoted') = (promoted_at is not null and booking_id is not null))
);

-- "You are already on the waitlist for that club date." (club_store.py:3320).
-- Per DATE, not per session — a per-session index would be the wrong rule.
create unique index club_booking_waitlist_one_per_date
  on public.club_booking_waitlist (club_id, requested_by, session_date)
  where status = 'active';

-- The FIFO scan. Order is (created_at, id) and is never stored as a position:
-- a position column needs renumbering on every leave, promote and skip.
create index club_booking_waitlist_queue_idx
  on public.club_booking_waitlist (club_session_id, session_date, created_at, id)
  where status = 'active';

create index club_booking_waitlist_profile_idx
  on public.club_booking_waitlist (requested_by, session_date desc);

-- ---------------------------------------------------------------------------
-- 7. Looking for games
-- ---------------------------------------------------------------------------

create table public.club_looking_for_games (
  id              bigint generated always as identity primary key,
  club_id         bigint not null references public.clubs (id) on delete cascade,
  club_session_id bigint not null references public.club_sessions (id) on delete restrict,
  session_date    date   not null,
  session_day     text not null default '',
  session_time    text not null default '',
  session_label   text not null default '',

  game_title      text not null,
  notes           text not null default '',

  created_by      uuid not null default auth.uid()
                    references public.profiles (id) on delete cascade,

  status          text not null default 'open'
                    check (status in ('open', 'accepted', 'cancelled')),
  accepted_by     uuid references public.profiles (id) on delete set null,
  accepted_at     timestamptz,
  -- set null, never cascade: cancelling the booking kills the match but keeps
  -- the post as history (club_store.py:16314-16328).
  booking_id      bigint references public.club_bookings (id) on delete set null,

  legacy_id       bigint,
  created_at      timestamptz not null default now(),

  constraint club_lfg_accept_pair check ((status = 'accepted') = (accepted_by is not null)),
  constraint club_lfg_not_self    check (accepted_by is null or accepted_by <> created_by)
);

-- "You already have an open looking-for-game post for that club date."
create unique index club_lfg_one_open_per_date
  on public.club_looking_for_games (club_id, created_by, session_date)
  where status = 'open';

create index club_lfg_board_idx
  on public.club_looking_for_games (club_id, session_date, session_time)
  where status = 'open';

-- ---------------------------------------------------------------------------
-- 8. The two writes a member cannot make for themselves
-- ---------------------------------------------------------------------------
--
-- Promotion creates a booking in someone else's name, and accepting a post
-- creates a booking in the poster's name. Both are impossible under the insert
-- policy below, which is the point: they exist only here, where the invariants
-- are re-checked. Eligibility that involves tier benefits stays in TypeScript —
-- the service walks the queue and calls this for one candidate at a time.

create or replace function public.promote_waitlist_entry(entry_id bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  entry public.club_booking_waitlist%rowtype;
  new_booking_id bigint;
begin
  select * into entry from public.club_booking_waitlist w where w.id = entry_id for update;
  if entry.id is null or entry.status <> 'active' then
    return null;
  end if;
  -- No caller check here on purpose: this is internal. Execute is revoked from
  -- anon and authenticated below, so the only ways in are the cancellation
  -- trigger (a system consequence) and promote_waitlist_entry_as_manager, which
  -- check the caller. is_club_member() would have been wrong — it is true for
  -- every approved member, which would let one member promote another into a
  -- table booking, and a charge, that person never asked for.
  if entry.session_date < public.london_today() then
    return null;
  end if;
  -- Still a participant somewhere that day? Then they are not promotable now,
  -- but they keep their place.
  if exists (select 1 from public.club_booking_participants p
              where p.club_id = entry.club_id
                and p.profile_id = entry.requested_by
                and p.session_date = entry.session_date) then
    update public.club_booking_waitlist
       set last_skip_reason = 'date-clash', last_skipped_at = now(), skip_count = skip_count + 1
     where id = entry.id;
    return null;
  end if;

  insert into public.club_bookings
    (club_id, club_session_id, session_date, game_title, notes,
     booked_by, opponent_profile_id, opponent_name, source)
  values
    (entry.club_id, entry.club_session_id, entry.session_date, entry.game_title, entry.notes,
     entry.requested_by, entry.opponent_profile_id, entry.opponent_name, 'waitlist')
  returning id into new_booking_id;

  update public.club_booking_waitlist
     set status = 'promoted', promoted_at = now(), booking_id = new_booking_id
   where id = entry.id;

  return new_booking_id;
end;
$$;

revoke all on function public.promote_waitlist_entry(bigint) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Promotion happens two ways, and neither is "any member asks for it".
--
--   1. Automatically, when a booking on that session is cancelled. That is a
--      system consequence, so it runs in a trigger with no caller involved.
--   2. Explicitly, by the club owner working their queue.
-- ---------------------------------------------------------------------------

/** The next promotable entry for one session, oldest first. */
create or replace function public.promote_next_for_session(
  target_session bigint, target_date date)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate bigint;
  booked bigint;
begin
  for candidate in
    select w.id from public.club_booking_waitlist w
     where w.club_session_id = target_session
       and w.session_date = target_date
       and w.status = 'active'
     order by w.created_at, w.id
  loop
    booked := public.promote_waitlist_entry(candidate);
    if booked is not null then
      return booked;
    end if;
  end loop;
  return null;
end;
$$;

revoke all on function public.promote_next_for_session(bigint, date) from public, anon, authenticated;

/** Owner-initiated promotion. The caller check that promote_waitlist_entry lost. */
create or replace function public.promote_waitlist_entry_as_manager(entry_id bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  target_club bigint;
begin
  select club_id into target_club from public.club_booking_waitlist where id = entry_id;
  if target_club is null then
    return null;
  end if;
  if not public.can_manage_club(target_club) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;
  return public.promote_waitlist_entry(entry_id);
end;
$$;

revoke all on function public.promote_waitlist_entry_as_manager(bigint) from public, anon;
grant execute on function public.promote_waitlist_entry_as_manager(bigint) to authenticated;

/** A cancelled booking frees a table, so the queue moves. */
create or replace function public.club_bookings_after_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelled' and old.status = 'booked' then
    -- Best effort. A seat that cannot be filled is not a reason to fail the
    -- cancellation the member actually asked for.
    begin
      perform public.promote_next_for_session(new.club_session_id, new.session_date);
    exception when others then
      raise warning 'waitlist promotion failed for session % on %: %',
        new.club_session_id, new.session_date, sqlerrm;
    end;
  end if;
  return null;
end;
$$;

create trigger club_bookings_promote_queue
  after update on public.club_bookings
  for each row execute function public.club_bookings_after_cancel();

create or replace function public.accept_looking_for_game(post_id bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  post public.club_looking_for_games%rowtype;
  new_booking_id bigint;
  actor uuid := (select auth.uid());
begin
  select * into post from public.club_looking_for_games p where p.id = post_id for update;
  if post.id is null or post.status <> 'open' then
    raise exception 'LFG_NOT_AVAILABLE' using errcode = 'check_violation';
  end if;
  if not public.is_club_member(post.club_id) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;
  if post.created_by = actor then
    raise exception 'LFG_OWN_POST' using errcode = 'check_violation';
  end if;

  -- The booking belongs to the poster and is priced on the poster's tier
  -- (club_store.py:3744-3765). The acceptor is the second seat.
  insert into public.club_bookings
    (club_id, club_session_id, session_date, game_title, notes,
     booked_by, accepted_by, accepted_at, source)
  values
    (post.club_id, post.club_session_id, post.session_date,
     coalesce(nullif(post.game_title, ''), 'Club game'), post.notes,
     post.created_by, actor, now(), 'looking-for-game')
  returning id into new_booking_id;

  update public.club_looking_for_games
     set status = 'accepted', accepted_by = actor, accepted_at = now(), booking_id = new_booking_id
   where id = post.id;

  return new_booking_id;
end;
$$;

revoke all on function public.accept_looking_for_game(bigint) from public, anon;
grant execute on function public.accept_looking_for_game(bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Row level security
-- ---------------------------------------------------------------------------

alter table public.club_booking_settings     enable row level security;
alter table public.club_bookings             enable row level security;
alter table public.club_booking_participants enable row level security;
alter table public.club_booking_waitlist     enable row level security;
alter table public.club_looking_for_games    enable row level security;

-- Settings are club configuration, and the price has to render on the form
-- before anyone books, so they are public like the rest of the club page.
create policy club_booking_settings_public
  on public.club_booking_settings for select to anon, authenticated using (true);
create policy club_booking_settings_insert
  on public.club_booking_settings for insert to authenticated
  with check (public.can_manage_club(club_id));
create policy club_booking_settings_update
  on public.club_booking_settings for update to authenticated
  using (public.can_manage_club(club_id))
  with check (public.can_manage_club(club_id));

-- Members see the club's bookings for today and the future; on past dates they
-- see only their own, which is what get_booking_day does (club_store.py:2436).
create policy club_bookings_select
  on public.club_bookings for select to authenticated
  using (
    booked_by = (select auth.uid())
    or opponent_profile_id = (select auth.uid())
    or accepted_by = (select auth.uid())
    or public.can_manage_club(club_id)
    or (public.is_club_member(club_id) and session_date >= public.london_today())
  );

-- Booking for yourself, as a confirmed booking, nothing else. source, price,
-- accepted_by, cancelled_at and table_index are not in the insert grant below,
-- so the with check is the second lock on the same door: no member can book in
-- another member's name or arrive pre-accepted from the waiting list.
create policy club_bookings_insert
  on public.club_bookings for insert to authenticated
  with check (
    booked_by = (select auth.uid())
    and public.is_club_member(club_id)
    and status = 'booked'
    and source = 'member'
    and accepted_by is null
    and accepted_at is null
    and cancelled_at is null
    and loyalty_points_spent = 0
    and session_date >= public.london_today()
  );

-- Anyone on the booking may cancel it, strictly before the day it happens.
create policy club_bookings_cancel
  on public.club_bookings for update to authenticated
  using (
    status = 'booked'
    and session_date > public.london_today()
    and (booked_by = (select auth.uid())
         or opponent_profile_id = (select auth.uid())
         or accepted_by = (select auth.uid()))
  )
  with check (status = 'cancelled');

-- The owner may cancel at any time, including a past date, which is how legacy
-- behaves (_can_cancel_booking returns true for a manager unconditionally).
create policy club_bookings_manage
  on public.club_bookings for update to authenticated
  using (public.can_manage_club(club_id) and status = 'booked')
  with check (public.can_manage_club(club_id) and status = 'cancelled');

-- Derived rows. Readable so the calendar can show who is playing; written only
-- by the trigger, which runs as definer.
create policy club_booking_participants_select
  on public.club_booking_participants for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_club_member(club_id));

-- Legacy shows the whole queue to every approved member on today-or-future
-- dates and narrows to your own rows on past ones (club_store.py:2443-2459).
create policy club_booking_waitlist_select
  on public.club_booking_waitlist for select to authenticated
  using (
    requested_by = (select auth.uid())
    or public.can_manage_club(club_id)
    or (public.is_club_member(club_id) and session_date >= public.london_today())
  );

-- Joining is for yourself, as an active entry, already unpromoted. Pinning
-- status, promoted_at and booking_id here is what stops a member inserting
-- themselves as promoted and then reading a confirmed booking out of it.
create policy club_booking_waitlist_join
  on public.club_booking_waitlist for insert to authenticated
  with check (
    requested_by = (select auth.uid())
    and public.is_club_member(club_id)
    and status = 'active'
    and promoted_at is null
    and booking_id is null
    and last_skip_reason is null
    and skip_count = 0
    and session_date >= public.london_today()
  );

-- Leaving the queue. New in the rewrite; legacy has no way out at all.
create policy club_booking_waitlist_leave
  on public.club_booking_waitlist for update to authenticated
  using (requested_by = (select auth.uid()) and status = 'active')
  with check (requested_by = (select auth.uid()) and status = 'withdrawn' and booking_id is null);

-- An owner may remove someone from the queue but may NOT mark them promoted:
-- promotion has to create a real booking, so it only exists inside
-- promote_waitlist_entry().
create policy club_booking_waitlist_manage
  on public.club_booking_waitlist for update to authenticated
  using (public.can_manage_club(club_id) and status = 'active')
  with check (public.can_manage_club(club_id) and status in ('skipped', 'withdrawn') and booking_id is null);

create policy club_lfg_select
  on public.club_looking_for_games for select to authenticated
  using (public.is_club_member(club_id));

create policy club_lfg_post
  on public.club_looking_for_games for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and public.is_club_member(club_id)
    and status = 'open'
    and accepted_by is null
    and accepted_at is null
    and booking_id is null
    and session_date >= public.london_today()
  );

-- Withdrawing your own post. Accepting is not reachable from any policy.
create policy club_lfg_withdraw
  on public.club_looking_for_games for update to authenticated
  using (created_by = (select auth.uid()) and status = 'open')
  with check (created_by = (select auth.uid()) and status = 'cancelled' and accepted_by is null and booking_id is null);

create policy club_lfg_manage
  on public.club_looking_for_games for update to authenticated
  using (public.can_manage_club(club_id) and status = 'open')
  with check (public.can_manage_club(club_id) and status = 'cancelled' and accepted_by is null);

-- ---------------------------------------------------------------------------
-- 10. Grants. RLS chooses rows; these choose columns.
-- ---------------------------------------------------------------------------

grant select on public.club_booking_settings to anon, authenticated;
grant select on public.club_bookings, public.club_booking_participants,
                public.club_booking_waitlist, public.club_looking_for_games
  to authenticated;

grant insert (club_id, table_booking_price, price_currency, calendar_horizon_days,
              enforce_advance_window, cancel_cutoff_hours, waitlist_enabled,
              looking_for_games_enabled)
  on public.club_booking_settings to authenticated;
grant update (table_booking_price, price_currency, calendar_horizon_days,
              enforce_advance_window, cancel_cutoff_hours, waitlist_enabled,
              looking_for_games_enabled, updated_at)
  on public.club_booking_settings to authenticated;

-- Everything else on a booking is server-computed: booked_by defaults to
-- auth.uid(), the snapshots and table_index come from the trigger, and the whole
-- money block comes from club_booking_settings and the member's tier. A member
-- naming any of those columns gets a permission error, not a discount.
grant insert (club_id, club_session_id, session_date, game_title, notes,
              opponent_profile_id, opponent_name)
  on public.club_bookings to authenticated;
grant update (status, cancel_reason) on public.club_bookings to authenticated;
revoke delete on public.club_bookings from anon, authenticated;

grant insert (club_id, club_session_id, session_date, game_title, notes,
              opponent_profile_id, opponent_name)
  on public.club_booking_waitlist to authenticated;
grant update (status, withdrawn_at) on public.club_booking_waitlist to authenticated;
revoke delete on public.club_booking_waitlist from anon, authenticated;

grant insert (club_id, club_session_id, session_date, game_title, notes)
  on public.club_looking_for_games to authenticated;
grant update (status) on public.club_looking_for_games to authenticated;
revoke delete on public.club_looking_for_games from anon, authenticated;

-- Participation is derived. Nobody writes it by hand.
revoke insert, update, delete on public.club_booking_participants from anon, authenticated;

-- No sequence grants: all three ids are `generated always as identity`, so the
-- client cannot supply one and Postgres advances the sequence itself.