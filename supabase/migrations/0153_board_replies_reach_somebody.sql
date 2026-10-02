-- 0153 · A reply on the board reaches the people in the conversation
--
-- **Nothing on the board notified anybody.** The only trigger on
-- `club_discussion_replies` was 0037's, which keeps `last_activity_at` for
-- paging. A member could answer a question on a club board and the person who
-- asked it would find out by going back and looking, which is the failure the
-- site exists to remove. The client found it on a thread with thirteen
-- replies.
--
-- Who hears about a reply, and why not everybody:
--
--   the thread's author     it is an answer to something they did
--   everybody who replied   they are in the conversation
--   nobody else             a forty-member board would send forty notices a
--                           night, and the first thing anybody does about that
--                           is turn the whole lot off
--
-- A new thread notifies nobody, deliberately. It is not an answer to anyone,
-- and telling the club about every one is the same flood by another route.
-- Legacy tells nobody about either.
--
-- **Two kinds, not one.** A reply to your own thread is low volume and arrives
-- in the "Replies to things you did" family, which cannot be switched off. A
-- reply in a thread you merely joined is higher volume and lands in "Your
-- clubs", where email is off until somebody asks for it. One kind would have
-- meant either silencing the first or emailing the second whether they wanted
-- it or not.
--
-- The read watermark is here as well, because the notice and the badge are the
-- same question asked twice: "how much of this thread has this person not seen".
-- Keeping them apart would mean a bell that says three and a card that says
-- five.
--
-- Checked on a throwaway Postgres built from every migration: the author is
-- told, a previous replier is told, the person who wrote it is not, a removed
-- reply tells nobody, ten replies make one notice that counts them, opening the
-- thread clears both the count and the notice, and the reads table carries no
-- grant to anybody.

-- ---------------------------------------------------------------------------
-- 1. How much of a thread somebody has seen
-- ---------------------------------------------------------------------------

create table if not exists public.club_discussion_reads (
  profile_id uuid   not null references public.profiles(id) on delete cascade,
  post_id    bigint not null references public.club_discussion_posts(id) on delete cascade,
  read_at    timestamptz not null default now(),
  primary key (profile_id, post_id)
);

comment on table public.club_discussion_reads is
  'One row per person per thread they have opened. Unread is counted against '
  'this, so the bell and the card cannot disagree.';

create index if not exists club_discussion_reads_by_post
  on public.club_discussion_reads (post_id);

alter table public.club_discussion_reads enable row level security;
-- No policy. Reached only through the two functions below, which pin the row
-- to `auth.uid()` so nobody can write somebody else's watermark.

-- ---------------------------------------------------------------------------
-- 2. Telling the people in the conversation
-- ---------------------------------------------------------------------------

/**
 * How many replies in this thread the reader has not seen.
 *
 * Their own replies never count: writing something is not a thing to catch up
 * on. A reader with no watermark has seen nothing, which is what the
 * `-infinity` fallback says.
 */
create or replace function public.unread_replies(p_post bigint, p_reader uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
    from public.club_discussion_replies rep
    left join public.club_discussion_reads rd
      on rd.post_id = p_post and rd.profile_id = p_reader
   where rep.post_id = p_post
     and rep.removed_at is null
     and rep.author_profile_id <> p_reader
     and rep.created_at > coalesce(rd.read_at, '-infinity'::timestamptz);
$$;

create or replace function public.notify_on_discussion_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post  record;
  v_club  record;
  v_who   text;
  v_body  text;
  v_href  text;
  r       record;
  v_count integer;
begin
  -- A reply that arrives already removed is a moderator's doing, not news.
  if new.removed_at is not null then
    return new;
  end if;

  select p.id, p.title, p.club_id, p.author_profile_id
    into v_post
    from public.club_discussion_posts p
   where p.id = new.post_id and p.removed_at is null;

  if v_post.id is null then
    return new;
  end if;

  select slug, name into v_club from public.clubs where id = v_post.club_id;
  select full_name into v_who from public.profiles where id = new.author_profile_id;
  v_who  := coalesce(nullif(btrim(v_who), ''), 'Somebody');
  v_href := '/clubs/' || v_club.slug || '/board/' || v_post.id;
  -- 0077 wrote this for message previews and it is the same job: the opening
  -- of what somebody said, on one line, cut on a space.
  v_body := public.message_preview(new.content);

  for r in
    -- The author, and everybody who has already replied, folded so somebody
    -- who is both is told once. `bool_or` keeps "started it" winning, because
    -- that is the stronger claim on their attention.
    select who, bool_or(started) as started
      from (
        select v_post.author_profile_id as who, true as started
        union all
        select rep.author_profile_id, false
          from public.club_discussion_replies rep
         where rep.post_id = new.post_id and rep.removed_at is null
      ) everybody
     where who is not null
       -- Nobody is told about their own doing.
       and who <> new.author_profile_id
     group by who
  loop
    v_count := public.unread_replies(new.post_id, r.who);

    perform public.notify_person(
      r.who,
      case when r.started then 'board-reply-yours' else 'board-reply-joined' end,
      case
        when v_count > 1 and r.started
          then v_count || ' new replies on your thread'
        when v_count > 1
          then v_count || ' new replies in a thread you are in'
        when r.started
          then v_who || ' replied to your thread'
        else v_who || ' replied in a thread you are in'
      end,
      v_post.title || ' · ' || v_body,
      v_href,
      -- One notice per thread per person. `notify_person` rewrites it in place
      -- while it is unread, so ten replies is one row that counts them rather
      -- than ten rows that bury everything else.
      'discussion_post', v_post.id::text);
  end loop;

  return new;
end;
$$;

drop trigger if exists club_discussion_replies_notify on public.club_discussion_replies;
create trigger club_discussion_replies_notify
  after insert on public.club_discussion_replies
  for each row execute function public.notify_on_discussion_reply();

-- ---------------------------------------------------------------------------
-- 3. Opening a thread is reading it
-- ---------------------------------------------------------------------------

/**
 * Mark a thread read, and take its notice off the bell with it.
 *
 * Both halves, for the reason 0105 gives: a badge for work somebody has just
 * done is the site asking twice. Read, not deleted, so the record of what
 * happened survives.
 */
create or replace function public.mark_thread_read(p_post bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
begin
  if v_me is null or p_post is null then
    return;
  end if;

  -- `clock_timestamp()`, not `now()`. `now()` is the transaction's start, so a
  -- reply that lands while this request is still running would be marked read
  -- without ever being seen. The window is small and it is free to close.
  insert into public.club_discussion_reads (profile_id, post_id, read_at)
  values (v_me, p_post, clock_timestamp())
  on conflict (profile_id, post_id) do update set read_at = clock_timestamp();

  update public.notifications
     set read_at = now()
   where profile_id = v_me
     and kind in ('board-reply-yours', 'board-reply-joined')
     and entity_type = 'discussion_post'
     and entity_id = p_post::text
     and read_at is null;
end;
$$;

/** The counts for a page of threads, in one round trip rather than twenty. */
create or replace function public.unread_in_threads(p_posts bigint[])
returns table (post_id bigint, unread integer)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, public.unread_replies(p.id, (select auth.uid()))
    from public.club_discussion_posts p
   where p.id = any (coalesce(p_posts, '{}'::bigint[]))
     and p.removed_at is null
     -- Counts are a fact about a club's own board, so the caller has to be in
     -- it. The ids come from a page RLS already filtered, but a hand-rolled
     -- call does not, and reply counts are not public.
     and (public.is_club_member(p.club_id) or public.can_manage_club(p.club_id));
$$;

-- ---------------------------------------------------------------------------
-- 4. Grants
-- ---------------------------------------------------------------------------

revoke all on public.club_discussion_reads from authenticated, anon;

revoke all on function public.unread_replies(bigint, uuid) from public, anon, authenticated;
revoke all on function public.unread_in_threads(bigint[]) from public, anon;
revoke all on function public.mark_thread_read(bigint) from public, anon;

grant execute on function public.unread_in_threads(bigint[]) to authenticated;
grant execute on function public.mark_thread_read(bigint) to authenticated;

do $$
declare v_bad boolean;
begin
  select bool_or(true) into v_bad
    from information_schema.role_table_grants
   where table_name = 'club_discussion_reads' and grantee in ('authenticated', 'anon');
  if coalesce(v_bad, false) then
    raise exception 'club_discussion_reads should be reachable only through its functions';
  end if;
end $$;
