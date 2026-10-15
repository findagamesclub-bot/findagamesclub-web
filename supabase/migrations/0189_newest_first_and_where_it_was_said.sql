-- 0189 · Newest first on two more lists, and the way back to where it was said
--
-- The client's words, on the events list: *"can we add a sort by newest
-- event"* and *"what is pagination set to on this?"*; on the moderation queue:
-- *"can we add a sort by newest report"* and *"can we add a link/button to the
-- board comment, reply, message or review so the admin can easily see the full
-- context of the board or message."*
--
-- Pagination is 25 and always was, one constant shared by every admin list.
--
-- **Both sort pickers already existed with one option in them**, which is a
-- control that cannot do anything: the events list offered "By date" and the
-- moderation queue offered "Longest waiting", and neither had a second. 0188
-- found the same thing on the clubs list. The reporter's own screen has had a
-- real one since 0130, so three screens about the same rows disagreed about
-- whether you may reorder them.
--
-- **Newest means most recently added, not the latest date on the event.**
-- "By date" already walks the start date in both directions, ascending on
-- Upcoming and descending on Past, so a second control for the same column
-- would be the same sort wearing a different word. `created_at` is the thing
-- it cannot answer: what has appeared on the site since I last looked. Same
-- reading as 0188's "newest club", and the card says when so the key the
-- order is built on is on the row.
--
-- **The default does not move on either list.** Upcoming counts forwards
-- because the event this Saturday is why anybody opened the tab (0118), and
-- the queue leads with whoever has been waiting longest because it is a
-- worklist. Newest is an option on top of both.
--
-- **The context link needs two columns, not a URL.** SQL knows which thread a
-- reply belongs to and which event a board post hangs off; it does not know
-- what this app's routes are called, and a path built here would have to be
-- found and changed the next time one moved. `context_id` is the thread to
-- open and `event_key` is the event's own `legacy_id`, and
-- `utils/moderation-context.ts` turns the pair into an address.
--
-- **A message gets neither, and that is a decision rather than a gap.** There
-- is no screen anywhere that shows one person somebody else's private
-- conversation, and there should not be: `/admin/messages` is the admin's own
-- inbox. The dialog says so rather than offering a link that would have to
-- open something this site does not have. What a moderator is given instead
-- is the recipient's name, which is the context a message actually has: this
-- person wrote this to that person.
--
-- **The id breaks the tie in whichever direction the sort runs.** Three
-- reports filed in one sitting share a second, and a trailing `id desc` on
-- both orders means "longest waiting" hands back the newest of them. 0130
-- paid for this once already.
--
-- Return types change on all three, and `create or replace` cannot change one,
-- so each is dropped first. Which is wanted anyway: a default parameter makes
-- a NEW function in Postgres, and a caller that forgets the sort would
-- otherwise pick up the old signature and quietly keep its order. Eighth time,
-- after 0136, 0165, 0171, 0178, 0186, 0187 and 0188.

-- ------------------------------------------------------- the events list

drop function if exists public.admin_events(text, text, text, integer, integer);

create or replace function public.admin_events(
  p_query text default '', p_status text default '', p_when text default '',
  p_sort text default 'date', p_limit integer default 25, p_offset integer default 0
) returns table (
  id bigint, legacy_id text, title text, start_date date, status text,
  club_slug text, club_name text, places bigint, sold bigint,
  added timestamptz, total_count bigint
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_like text := '%' || btrim(coalesce(p_query, '')) || '%';
  v_sort text := case when coalesce(p_sort, '') = 'newest' then 'newest' else 'date' end;
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  return query
  with matching as (
    select e.*, c.slug as c_slug, c.name as c_name
      from public.club_events e
      join public.clubs c on c.id = e.club_id
     where (btrim(coalesce(p_query, '')) = ''
            or e.title ilike v_like or c.name ilike v_like or c.city ilike v_like)
       and (btrim(coalesce(p_status, '')) = '' or e.status = p_status)
       -- "Upcoming" and "past" are London days, like every other date here.
       and (btrim(coalesce(p_when, '')) = ''
            or (p_when = 'upcoming' and e.start_date >= public.london_today())
            or (p_when = 'past' and e.start_date < public.london_today()))
  ),
  counted as (select count(*) as n from matching)
  select m.id, m.legacy_id, m.title, m.start_date, m.status,
         m.c_slug::text, m.c_name,
         coalesce((select sum(t.quantity_available) from public.club_event_ticket_types t
                    where t.event_id = m.id), 0)::bigint as places,
         (select count(*) from public.club_event_bookings b
           where b.event_id = m.id and b.status <> 'cancelled') as sold,
         m.created_at as added,
         counted.n
    from matching m
    cross join counted
   -- Upcoming counts forwards, everything else counts back. On the Upcoming
   -- tab, newest first means the event furthest away leads and the one this
   -- Saturday is on page three, which is the opposite of why anybody opened
   -- the tab. Newest first is about when the event was PUT UP, which is the
   -- question the date order cannot answer whichever way it runs.
   order by case when v_sort = 'newest' then m.created_at end desc,
            case when v_sort = 'newest' then m.id end desc,
            case when v_sort = 'date' and p_when = 'upcoming' then m.start_date end asc,
            case when v_sort = 'date' and p_when <> 'upcoming' then m.start_date end desc
   limit greatest(coalesce(p_limit, 25), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end $$;

revoke all on function public.admin_events(text, text, text, text, integer, integer)
  from public, anon;
grant execute on function public.admin_events(text, text, text, text, integer, integer)
  to authenticated;

-- ---------------------------------------------------- the two moderation queues
--
-- Both are 0127's and 0129's own bodies with the sort and the two context
-- columns added. Rebuilt from the LATEST definition of each, not from 0122
-- and 0128: doing that the other way round is what dropped
-- `save_pairing_armies`' outcome stamp in 0181.
--
-- `context` is its own CTE rather than six more scalar subqueries, so the
-- thread and the event are found once per row by the same left join the words
-- already come through.

drop function if exists public.moderation_queue(text, text, text, integer, integer);

create or replace function public.moderation_queue(
  p_type text default '', p_status text default 'open', p_query text default '',
  p_sort text default 'waiting', p_limit integer default 25, p_offset integer default 0
) returns table (
  id bigint, target_type text, target_id bigint, status text,
  reason text, resolution text, created_at timestamptz,
  reporter_name text, author_name text, author_id uuid,
  club_slug text, club_name text, body text, title text,
  context_id bigint, event_key text, sent_to text,
  target_gone boolean, total_count bigint
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_like text := '%' || btrim(coalesce(p_query, '')) || '%';
  v_sort text := case when coalesce(p_sort, '') = 'newest' then 'newest' else 'waiting' end;
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  return query
  with targets as (
    -- `ctx` is the thread to open and `evt` is the event it hangs off. A post
    -- is its own thread; a reply points at its parent; a review and a message
    -- have no thread at all.
    select 'review'::text as t, r.id, r.author_profile_id as author,
           ''::text as ttl, coalesce(r.comment, '') as body,
           null::bigint as ctx, null::bigint as evt, null::uuid as sent
      from public.club_reviews r where r.removed_at is null
    union all
    select 'post', p.id, p.author_profile_id, p.title, p.content,
           p.id, null::bigint, null::uuid
      from public.club_discussion_posts p where p.removed_at is null
    union all
    select 'reply', r.id, r.author_profile_id, '', r.content,
           r.post_id, null::bigint, null::uuid
      from public.club_discussion_replies r where r.removed_at is null
    union all
    select 'event_post', b.id, b.author_profile_id, b.title, b.content,
           b.id, b.event_id, null::uuid
      from public.club_event_board_posts b where b.removed_at is null
    union all
    select 'event_reply', r.id, r.author_profile_id, '', r.content,
           r.post_id, p.event_id, null::uuid
      from public.club_event_board_replies r
      join public.club_event_board_posts p on p.id = r.post_id
     where r.removed_at is null
    union all
    select 'message', m.id, m.sender_id, '', m.content,
           null::bigint, null::bigint, m.recipient_id
      from public.club_messages m where m.removed_at is null
  ),
  matching as (
    select f.*, t.author, coalesce(t.ttl, '') as ttl, coalesce(t.body, '') as body,
           t.ctx, t.evt, t.sent, t.id is null as gone
      from public.moderation_flags f
      left join targets t on t.t = f.target_type and t.id = f.target_id
     where f.status <> 'withdrawn'
       and (btrim(coalesce(p_type, '')) = '' or f.target_type = p_type)
       and (btrim(coalesce(p_status, '')) = ''
            or (p_status = 'answered' and f.status <> 'open')
            or f.status = p_status)
       -- A flag still open on content that has already gone another way is not
       -- work anybody can do, so it never reaches the waiting tab.
       and (f.status <> 'open' or t.id is not null)
       and (btrim(coalesce(p_query, '')) = ''
            or t.body ilike v_like or t.ttl ilike v_like or f.reason ilike v_like)
  ),
  counted as (select count(*) as n from matching)
  select m.id, m.target_type, m.target_id, m.status, m.reason, m.resolution,
         m.created_at,
         coalesce(nullif(btrim(rp.full_name), ''), 'Somebody'),
         coalesce(nullif(btrim(au.full_name), ''), 'Somebody'),
         m.author,
         coalesce(c.slug::text, ''), coalesce(c.name, ''),
         m.body, m.ttl,
         m.ctx, coalesce(e.legacy_id, ''),
         -- Who a message was sent to. The one piece of context a private
         -- message has, since there is no page that shows the conversation.
         coalesce(nullif(btrim(to_p.full_name), ''),
                  case when m.sent is null then '' else 'a member' end),
         m.gone, counted.n
    from matching m
    left join public.profiles rp on rp.id = m.flagged_by
    left join public.profiles au on au.id = m.author
    left join public.profiles to_p on to_p.id = m.sent
    left join public.clubs c on c.id = m.club_id
    left join public.club_events e on e.id = m.evt
    cross join counted
   -- Oldest first while they are waiting: somebody has been waiting longest.
   -- Newest first drops the status grouping entirely, because the question it
   -- answers is "what has come in", and an answered report from this morning
   -- is part of that.
   order by case when v_sort = 'waiting' and m.status = 'open' then 0
                 when v_sort = 'waiting' then 1 end asc,
            case when v_sort = 'waiting' and m.status = 'open' then m.created_at end asc,
            case when v_sort = 'waiting' and m.status = 'open' then m.id end asc,
            m.created_at desc, m.id desc
   limit greatest(coalesce(p_limit, 25), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end $$;

revoke all on function public.moderation_queue(text, text, text, text, integer, integer)
  from public, anon;
grant execute on function public.moderation_queue(text, text, text, text, integer, integer)
  to authenticated;

drop function if exists
  public.club_moderation_queue(bigint, text, text, text, integer, integer);

create or replace function public.club_moderation_queue(
  p_club bigint, p_type text default '', p_status text default 'open',
  p_query text default '', p_sort text default 'waiting',
  p_limit integer default 25, p_offset integer default 0
) returns table (
  id bigint, target_type text, target_id bigint, status text,
  reason text, resolution text, created_at timestamptz,
  reporter_name text, author_name text, author_id uuid,
  club_slug text, club_name text, body text, title text,
  context_id bigint, event_key text, sent_to text,
  target_gone boolean, total_count bigint
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_like text := '%' || btrim(coalesce(p_query, '')) || '%';
  v_sort text := case when coalesce(p_sort, '') = 'newest' then 'newest' else 'waiting' end;
begin
  if not (public.club_can(p_club, 'board.moderate') or public.is_admin()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  return query
  with targets as (
    select 'post'::text as t, p.id, p.author_profile_id as author,
           p.title as ttl, p.content as body,
           p.id as ctx, null::bigint as evt, null::uuid as sent
      from public.club_discussion_posts p where p.removed_at is null
    union all
    select 'reply', r.id, r.author_profile_id, '', r.content,
           r.post_id, null::bigint, null::uuid
      from public.club_discussion_replies r where r.removed_at is null
    union all
    select 'event_post', b.id, b.author_profile_id, b.title, b.content,
           b.id, b.event_id, null::uuid
      from public.club_event_board_posts b where b.removed_at is null
    union all
    select 'event_reply', r.id, r.author_profile_id, '', r.content,
           r.post_id, p.event_id, null::uuid
      from public.club_event_board_replies r
      join public.club_event_board_posts p on p.id = r.post_id
     where r.removed_at is null
    union all
    select 'message', m.id, m.sender_id, '', m.content,
           null::bigint, null::bigint, m.recipient_id
      from public.club_messages m where m.removed_at is null
  ),
  matching as (
    select f.*, t.author, coalesce(t.ttl, '') as ttl, coalesce(t.body, '') as body,
           t.ctx, t.evt, t.sent, t.id is null as gone
      from public.moderation_flags f
      left join targets t on t.t = f.target_type and t.id = f.target_id
     where f.club_id = p_club
       and f.status <> 'withdrawn'
       and public.club_may_judge(p_club, f.target_type, f.target_id)
       and (btrim(coalesce(p_type, '')) = '' or f.target_type = p_type)
       and (btrim(coalesce(p_status, '')) = ''
            or (p_status = 'answered' and f.status <> 'open')
            or f.status = p_status)
       and (f.status <> 'open' or t.id is not null)
       and (btrim(coalesce(p_query, '')) = ''
            or t.body ilike v_like or t.ttl ilike v_like or f.reason ilike v_like)
  ),
  counted as (select count(*) as n from matching)
  select m.id, m.target_type, m.target_id, m.status, m.reason, m.resolution,
         m.created_at,
         -- The name, as the client asked for. A deleted account has none, so
         -- the fallback stays and the screen still reads "a member".
         coalesce(nullif(btrim(rp.full_name), ''), 'Somebody'),
         coalesce(nullif(btrim(au.full_name), ''), 'Somebody'),
         m.author,
         coalesce(c.slug::text, ''), coalesce(c.name, ''),
         m.body, m.ttl,
         m.ctx, coalesce(e.legacy_id, ''),
         coalesce(nullif(btrim(to_p.full_name), ''),
                  case when m.sent is null then '' else 'a member' end),
         m.gone, counted.n
    from matching m
    left join public.profiles rp on rp.id = m.flagged_by
    left join public.profiles au on au.id = m.author
    left join public.profiles to_p on to_p.id = m.sent
    left join public.clubs c on c.id = m.club_id
    left join public.club_events e on e.id = m.evt
    cross join counted
   order by case when v_sort = 'waiting' and m.status = 'open' then 0
                 when v_sort = 'waiting' then 1 end asc,
            case when v_sort = 'waiting' and m.status = 'open' then m.created_at end asc,
            case when v_sort = 'waiting' and m.status = 'open' then m.id end asc,
            m.created_at desc, m.id desc
   limit greatest(coalesce(p_limit, 25), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end $$;

revoke all on function
  public.club_moderation_queue(bigint, text, text, text, text, integer, integer)
  from public, anon;
grant execute on function
  public.club_moderation_queue(bigint, text, text, text, text, integer, integer)
  to authenticated;

-- ------------------------------------------------------- the tab counts
--
-- **Both counts functions call the queue, and dropping a signature breaks a
-- caller.** `moderation_queue_counts` (0122) and `club_moderation_counts`
-- (0128) each run the queue twice with a limit of 100,000 and count the rows,
-- so the five- and six-argument calls inside them stopped resolving the moment
-- the signatures above changed.
--
-- Worth saying how that would have reached a screen: `getQueue` catches a
-- failed counts read and falls back to `{}`, and `tabsWith` turns a missing
-- figure into 0. So every tab would have read "Waiting 0" over a queue with
-- rows in it, with nothing anywhere saying why. The same shape as every other
-- plausible lie in this file, and the behaviour suite is what caught it.
--
-- They pass `'waiting'` rather than the new default, because a count does not
-- care what order the rows come back in and naming it is what makes that a
-- decision rather than an accident.

create or replace function public.moderation_queue_counts(
  p_type text default '', p_query text default ''
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_all int; v_open int; v_answered int;
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  select count(*) into v_all
    from public.moderation_queue(p_type, '', p_query, 'waiting', 100000, 0);
  select count(*) into v_open
    from public.moderation_queue(p_type, 'open', p_query, 'waiting', 100000, 0);
  v_answered := v_all - v_open;

  return jsonb_build_object('all', v_all, 'open', v_open, 'answered', v_answered);
end $$;

create or replace function public.club_moderation_counts(
  p_club bigint, p_type text default '', p_query text default ''
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_all int; v_open int;
begin
  if not (public.club_can(p_club, 'board.moderate') or public.is_admin()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  select count(*) into v_all
    from public.club_moderation_queue(p_club, p_type, '', p_query, 'waiting', 100000, 0);
  select count(*) into v_open
    from public.club_moderation_queue(p_club, p_type, 'open', p_query, 'waiting', 100000, 0);

  return jsonb_build_object('all', v_all, 'open', v_open, 'answered', v_all - v_open);
end $$;
