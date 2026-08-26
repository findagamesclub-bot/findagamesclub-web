-- Discussion boards, direct messages, and the write side of reviews.
--
-- Nothing is imported. Every row in club-discussions.json, club-messages.json
-- and club-message-reads.json references the four development accounts
-- (ids 1, 2, 4 and 5 in holiday-planner.sqlite3), so importing would seed three
-- clubs' boards with posts by people who cannot sign in. Same call as bookings
-- and loyalty. The categories themselves came across in 0007.

-- ---------------------------------------------------------------- categories

/**
 * May this person post in, or read, a category at this club?
 *
 * A tier can reserve a category through benefits.privateDiscussionCategories.
 * Legacy checks this in Python only (_available_discussion_categories_for_user,
 * club_store.py:15813), which leaves the rows readable over PostgREST to any
 * member with the anon key. It belongs here.
 *
 * Position is the ladder, as everywhere else: a tier further down the club's
 * own list is higher, and holding it grants every category reserved at or
 * below it.
 */
create or replace function public.can_use_discussion_category(target_club bigint, category text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  wanted   text := btrim(lower(coalesce(category, '')));
  need_pos smallint;
  held_pos smallint;
begin
  if public.can_manage_club(target_club) then
    return true;
  end if;
  if not public.is_club_member(target_club) then
    return false;
  end if;

  -- The highest tier that reserves this category. Null means nobody reserved
  -- it, so it is an ordinary category and every member may use it.
  select max(t.position) into need_pos
    from public.club_membership_tiers t
   cross join lateral jsonb_array_elements_text(
     case jsonb_typeof(t.benefits -> 'privateDiscussionCategories')
       when 'array' then t.benefits -> 'privateDiscussionCategories'
       else '[]'::jsonb
     end
   ) as reserved(label)
   where t.club_id = target_club
     and btrim(lower(reserved.label)) = wanted;

  if need_pos is null then
    return true;
  end if;

  select t.position into held_pos
    from public.club_memberships m
    join public.club_membership_tiers t
      on t.club_id = m.club_id and t.tier_key = m.tier_key
   where m.club_id = target_club
     and m.profile_id = (select auth.uid())
     and m.status = 'approved';

  return coalesce(held_pos, -1) >= need_pos;
end;
$$;

revoke all on function public.can_use_discussion_category(bigint, text) from public, anon;
grant execute on function public.can_use_discussion_category(bigint, text) to authenticated;

-- --------------------------------------------------------------------- board

create table public.club_discussion_posts (
  id                bigint generated always as identity primary key,
  club_id           bigint not null references public.clubs (id) on delete cascade,
  author_profile_id uuid   not null default auth.uid()
                    references public.profiles (id) on delete cascade,
  category          text   not null,
  title             text   not null,
  content           text   not null,
  -- Question and options together. Options are fixed when the poll is written
  -- and legacy never edits them, so they are content, not rows. The votes are
  -- rows, because those need a unique constraint and a group-by.
  poll              jsonb,
  -- Soft, not a hard delete. Legacy pops the record (club_store.py:3032),
  -- which takes everybody's replies with it and leaves no trace of why a
  -- thread vanished.
  removed_at        timestamptz,
  removed_by        uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint club_discussion_posts_title_len check (char_length(btrim(title)) between 1 and 200),
  constraint club_discussion_posts_content_len check (char_length(btrim(content)) between 1 and 8000)
);

create index club_discussion_posts_club_idx
  on public.club_discussion_posts (club_id, created_at desc) where removed_at is null;
create index club_discussion_posts_author_idx
  on public.club_discussion_posts (author_profile_id);

create table public.club_discussion_replies (
  id                bigint generated always as identity primary key,
  post_id           bigint not null references public.club_discussion_posts (id) on delete cascade,
  author_profile_id uuid   not null default auth.uid()
                    references public.profiles (id) on delete cascade,
  content           text   not null,
  removed_at        timestamptz,
  removed_by        uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  constraint club_discussion_replies_content_len check (char_length(btrim(content)) between 1 and 4000)
);

create index club_discussion_replies_post_idx
  on public.club_discussion_replies (post_id, created_at) where removed_at is null;

create table public.club_discussion_poll_votes (
  id          bigint generated always as identity primary key,
  post_id     bigint not null references public.club_discussion_posts (id) on delete cascade,
  profile_id  uuid   not null default auth.uid()
              references public.profiles (id) on delete cascade,
  option_key  text   not null,
  voted_at    timestamptz not null default now(),
  -- One vote each, changeable. Legacy overwrites the existing vote rather than
  -- adding a second (club_store.py:3113).
  constraint club_discussion_poll_votes_one_each unique (post_id, profile_id)
);

create index club_discussion_poll_votes_tally_idx
  on public.club_discussion_poll_votes (post_id, option_key);

-- ------------------------------------------------------------------ messages

/**
 * Direct messages, one club at a time.
 *
 * Legacy threads by a composite string, "didcot-wargames-didcot::2-4"
 * (club_store.py:20174). Here the pair is two stored generated columns, so the
 * thread is an index rather than a string that has to be parsed back apart.
 */
create table public.club_messages (
  id           bigint generated always as identity primary key,
  club_id      bigint not null references public.clubs (id) on delete cascade,
  sender_id    uuid   not null default auth.uid()
               references public.profiles (id) on delete cascade,
  recipient_id uuid   not null references public.profiles (id) on delete cascade,
  content      text   not null,
  created_at   timestamptz not null default now(),
  pair_low     uuid generated always as (least(sender_id, recipient_id)) stored,
  pair_high    uuid generated always as (greatest(sender_id, recipient_id)) stored,
  constraint club_messages_not_self check (sender_id <> recipient_id),
  constraint club_messages_content_len check (char_length(btrim(content)) between 1 and 4000)
);

create index club_messages_thread_idx
  on public.club_messages (club_id, pair_low, pair_high, created_at desc);
create index club_messages_inbox_idx
  on public.club_messages (recipient_id, created_at desc);

/**
 * How far down a thread somebody has read.
 *
 * A watermark, not a per-message receipt: legacy compares the newest incoming
 * message against one readAt per thread (club_store.py:18031). Counting unread
 * is then messages after the watermark that were not sent by the reader.
 */
create table public.club_message_reads (
  id         bigint generated always as identity primary key,
  profile_id uuid   not null default auth.uid()
             references public.profiles (id) on delete cascade,
  club_id    bigint not null references public.clubs (id) on delete cascade,
  pair_low   uuid not null,
  pair_high  uuid not null,
  read_at    timestamptz not null default now(),
  constraint club_message_reads_one_per_thread unique (profile_id, club_id, pair_low, pair_high)
);

/**
 * Who may open a conversation.
 *
 * Ported from create_direct_message (club_store.py:10779). Three ways in, and
 * the third one matters: once two people have a thread it stays open, so a
 * conversation does not break the day somebody's membership lapses.
 */
create or replace function public.can_message_member(target_club bigint, other_person uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null or other_person is null or actor = other_person then
    return false;
  end if;

  -- Both approved at the same club.
  if exists (
    select 1 from public.club_memberships mine
      join public.club_memberships theirs on theirs.club_id = mine.club_id
     where mine.club_id = target_club
       and mine.profile_id = actor and mine.status = 'approved'
       and theirs.profile_id = other_person and theirs.status = 'approved'
  ) then
    return true;
  end if;

  -- The club answering somebody who has applied to join it.
  if public.can_manage_club(target_club) and exists (
    select 1 from public.club_memberships m
     where m.club_id = target_club and m.profile_id = other_person
       and m.status in ('pending', 'approved')
  ) then
    return true;
  end if;

  -- A thread that already exists.
  return exists (
    select 1 from public.club_messages m
     where m.club_id = target_club
       and m.pair_low = least(actor, other_person)
       and m.pair_high = greatest(actor, other_person)
  );
end;
$$;

revoke all on function public.can_message_member(bigint, uuid) from public, anon;
grant execute on function public.can_message_member(bigint, uuid) to authenticated;

-- ------------------------------------------------------- reviews, write side

alter table public.club_reviews
  add column if not exists flagged_by uuid references public.profiles (id) on delete set null,
  add column if not exists removed_by uuid references public.profiles (id) on delete set null;

-- The rule create_club_review enforces in code (club_store.py:3142, "You have
-- already left a review for this club"). Partial, because a removed review
-- must not block the author from writing an honest replacement.
create unique index if not exists club_reviews_one_active_per_author
  on public.club_reviews (club_id, author_profile_id)
  where removed_at is null and author_profile_id is not null;

/** Moderation stamps itself, so nobody can flag or remove in another name. */
create or replace function public.club_reviews_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.flagged_at is distinct from old.flagged_at then
    new.flagged_by := case when new.flagged_at is null then null else (select auth.uid()) end;
    new.flagged_by_name := case
      when new.flagged_at is null then null
      else coalesce((select full_name from public.profiles where id = (select auth.uid())), '')
    end;
  end if;

  if new.removed_at is distinct from old.removed_at then
    new.removed_by := case when new.removed_at is null then null else (select auth.uid()) end;
    new.removed_by_name := case
      when new.removed_at is null then null
      else coalesce((select full_name from public.profiles where id = (select auth.uid())), '')
    end;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger club_reviews_stamp
  before update on public.club_reviews
  for each row execute function public.club_reviews_before_update();

-- ------------------------------------------------------------ row-level security

alter table public.club_discussion_posts       enable row level security;
alter table public.club_discussion_replies     enable row level security;
alter table public.club_discussion_poll_votes  enable row level security;
alter table public.club_messages               enable row level security;
alter table public.club_message_reads          enable row level security;

-- Members read the board, and only the categories their tier reaches.
create policy club_discussion_posts_select on public.club_discussion_posts
  for select to authenticated
  using (removed_at is null and public.can_use_discussion_category(club_id, category));

create policy club_discussion_posts_insert on public.club_discussion_posts
  for insert to authenticated
  with check (
    author_profile_id = (select auth.uid())
    and public.is_club_member(club_id)
    and public.can_use_discussion_category(club_id, category)
  );

-- The author or the club. Legacy allows only the club (club_store.py:3035),
-- which leaves a member who posted by mistake with no way to take it back.
create policy club_discussion_posts_remove on public.club_discussion_posts
  for update to authenticated
  using (
    removed_at is null
    and (author_profile_id = (select auth.uid()) or public.can_manage_club(club_id))
  )
  with check (removed_at is not null);

create policy club_discussion_replies_select on public.club_discussion_replies
  for select to authenticated
  using (removed_at is null and exists (
    select 1 from public.club_discussion_posts p
     where p.id = post_id and p.removed_at is null
       and public.can_use_discussion_category(p.club_id, p.category)
  ));

create policy club_discussion_replies_insert on public.club_discussion_replies
  for insert to authenticated
  with check (
    author_profile_id = (select auth.uid())
    and exists (
      select 1 from public.club_discussion_posts p
       where p.id = post_id and p.removed_at is null
         and public.is_club_member(p.club_id)
         and public.can_use_discussion_category(p.club_id, p.category)
    )
  );

create policy club_discussion_replies_remove on public.club_discussion_replies
  for update to authenticated
  using (
    removed_at is null
    and (author_profile_id = (select auth.uid()) or exists (
      select 1 from public.club_discussion_posts p
       where p.id = post_id and public.can_manage_club(p.club_id)
    ))
  )
  with check (removed_at is not null);

-- Votes are public within the board: a poll nobody can count is not a poll.
create policy club_discussion_poll_votes_select on public.club_discussion_poll_votes
  for select to authenticated
  using (exists (
    select 1 from public.club_discussion_posts p
     where p.id = post_id and p.removed_at is null
       and public.can_use_discussion_category(p.club_id, p.category)
  ));

create policy club_discussion_poll_votes_insert on public.club_discussion_poll_votes
  for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and exists (
      select 1 from public.club_discussion_posts p
       where p.id = post_id and p.removed_at is null and p.poll is not null
         and public.is_club_member(p.club_id)
         and public.can_use_discussion_category(p.club_id, p.category)
    )
  );

create policy club_discussion_poll_votes_change on public.club_discussion_poll_votes
  for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- Messages: yours to read, whether you sent them or received them.
create policy club_messages_select on public.club_messages
  for select to authenticated
  using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));

create policy club_messages_insert on public.club_messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.can_message_member(club_id, recipient_id)
  );

create policy club_message_reads_select on public.club_message_reads
  for select to authenticated using (profile_id = (select auth.uid()));
create policy club_message_reads_insert on public.club_message_reads
  for insert to authenticated with check (profile_id = (select auth.uid()));
create policy club_message_reads_update on public.club_message_reads
  for update to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));

-- Anyone with an account may review any club. Legacy does not require
-- membership (create_club_review, club_store.py:3130) and neither does this.
create policy club_reviews_insert on public.club_reviews
  for insert to authenticated
  with check (author_profile_id = (select auth.uid()));

-- The author edits their own words; the club flags; an admin removes.
create policy club_reviews_update_own on public.club_reviews
  for update to authenticated
  using (author_profile_id = (select auth.uid()) and removed_at is null)
  with check (author_profile_id = (select auth.uid()));

create policy club_reviews_moderate on public.club_reviews
  for update to authenticated
  using (
    public.can_manage_club(club_id)
    or exists (select 1 from public.profiles p
                where p.id = (select auth.uid()) and p.role = 'admin')
  );

-- ---------------------------------------------------------------- privileges
--
-- Supabase's default privileges hand `authenticated` a whole-table insert and
-- update on every new table, which makes a later column grant inert. Revoke
-- first, every time. This cost an hour on the Stage 3 tables.

revoke all on public.club_discussion_posts      from authenticated, anon;
revoke all on public.club_discussion_replies    from authenticated, anon;
revoke all on public.club_discussion_poll_votes from authenticated, anon;
revoke all on public.club_messages              from authenticated, anon;
revoke all on public.club_message_reads         from authenticated, anon;

grant select on public.club_discussion_posts      to authenticated, anon;
grant select on public.club_discussion_replies    to authenticated, anon;
grant select on public.club_discussion_poll_votes to authenticated, anon;
grant select on public.club_messages              to authenticated;
grant select on public.club_message_reads         to authenticated;

grant insert (club_id, category, title, content, poll) on public.club_discussion_posts to authenticated;
-- Removing is the only update. Nobody edits a post after the fact, so the
-- board cannot be rewritten under a reply that answered it.
grant update (removed_at, removed_by, updated_at)      on public.club_discussion_posts to authenticated;

grant insert (post_id, content)                   on public.club_discussion_replies to authenticated;
grant update (removed_at, removed_by)             on public.club_discussion_replies to authenticated;

grant insert (post_id, option_key)                on public.club_discussion_poll_votes to authenticated;
grant update (option_key, voted_at)               on public.club_discussion_poll_votes to authenticated;

grant insert (club_id, recipient_id, content)     on public.club_messages to authenticated;
grant insert (club_id, pair_low, pair_high, read_at) on public.club_message_reads to authenticated;
grant update (read_at)                            on public.club_message_reads to authenticated;

-- Reviews already granted select in 0009. The write side, column by column.
revoke insert, update on public.club_reviews from authenticated, anon;
grant insert (club_id, author_profile_id, author_name, rating, comment) on public.club_reviews to authenticated;
grant update (rating, comment, flagged_at, flagged_by_name, removed_at, removed_by_name, updated_at)
  on public.club_reviews to authenticated;
