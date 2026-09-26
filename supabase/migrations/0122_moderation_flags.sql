/**
 * 0122 · One queue for everything somebody reports
 *
 * The client asked for "a moderation queue for reviews, board posts (club and
 * event) and messages, if flagged to admin". Legacy has none of it: it can flag
 * a review (`flag_club_review`) and nothing else.
 *
 * `club_reviews` is the only one of the six with flag columns, so adding four
 * more sets would be four more shapes of the same question. One table carries
 * `(target_type, target_id)` instead, which cannot have a foreign key across
 * six tables: the queue joins to the live row and a flag whose target has gone
 * is dropped on read rather than left to rot.
 *
 * The review columns are mirrored rather than replaced, so the club page keeps
 * working unchanged. Two mechanisms for one fact is the drift trap, so removing
 * those columns is in DEFERRED with the read path to switch first.
 *
 * Resolving is the admin's, decided with the client. A club already removes
 * posts on its own board through `board.moderate`; a flag is somebody saying
 * the club got it wrong, so the club is not the one who answers it. A manager
 * sees flags against their club so a removal is not a surprise.
 *
 * Behaviour-tested on scripts/pg-harness.sh.
 */

-- ------------------------------------------------- messages can be removed

-- The only one of the six with no soft delete. Everything else has had
-- removed_at since 0009, 0017 or 0059.
alter table public.club_messages
  add column if not exists removed_at timestamptz,
  add column if not exists removed_by uuid references public.profiles (id) on delete set null;

drop policy if exists club_messages_select on public.club_messages;
create policy club_messages_select on public.club_messages
  for select to authenticated
  using (removed_at is null
         and (sender_id = (select auth.uid()) or recipient_id = (select auth.uid())));

-- Nothing grants update on this table, so a removal can only come from
-- `resolve_moderation_flag` below.

-- ------------------------------------------------------------------ table

create table public.moderation_flags (
  id          bigint generated always as identity primary key,
  target_type text not null,
  target_id   bigint not null,
  -- Derived on the way in rather than supplied, so a reporter cannot file a
  -- complaint about one club against another.
  club_id     bigint references public.clubs (id) on delete cascade,
  event_id    bigint references public.club_events (id) on delete cascade,
  flagged_by  uuid references public.profiles (id) on delete set null,
  reason      text not null default '',
  status      text not null default 'open',
  resolution  text not null default '',
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at  timestamptz not null default now(),
  constraint moderation_flags_type check (target_type in
    ('review', 'post', 'reply', 'event_post', 'event_reply', 'message')),
  constraint moderation_flags_status check (status in ('open', 'dismissed', 'actioned')),
  constraint moderation_flags_reason_len check (char_length(reason) <= 500),
  constraint moderation_flags_resolved_pair
    check ((status = 'open') = (resolved_at is null))
);

-- One open flag per person per thing. Reporting it twice is not two problems,
-- and without this a queue can be filled by one person pressing a button.
create unique index moderation_flags_one_open
  on public.moderation_flags (target_type, target_id, flagged_by)
  where status = 'open';

create index moderation_flags_queue_idx
  on public.moderation_flags (status, created_at) where status = 'open';
create index moderation_flags_club_idx
  on public.moderation_flags (club_id, created_at desc);

revoke insert, update, delete on public.moderation_flags from authenticated, anon;
grant select on public.moderation_flags to authenticated;
alter table public.moderation_flags enable row level security;

-- An admin sees everything. A club's team sees flags against their own club so
-- a removal is not a surprise, and the person who reported it can see their own.
create policy moderation_flags_select on public.moderation_flags
  for select to authenticated
  using (public.is_admin()
         or flagged_by = (select auth.uid())
         or (club_id is not null and public.can_manage_club(club_id)));

do $$
declare v_bad boolean;
begin
  select bool_or(column_name is null) into v_bad from (
    select null::text as column_name from information_schema.role_table_grants
     where table_name = 'moderation_flags'
       and grantee = 'authenticated' and privilege_type = 'INSERT'
    union all
    select column_name from information_schema.role_column_grants
     where table_name = 'moderation_flags'
       and grantee = 'authenticated' and privilege_type = 'INSERT') g;
  if coalesce(v_bad, false) then
    raise exception 'moderation_flags still carries a whole-table insert grant';
  end if;
end $$;

-- --------------------------------------------------------------- reporting

/**
 * Report something.
 *
 * The club is derived from the target, never supplied, so a reporter cannot
 * file a complaint about one club against another.
 *
 * `security definer`, because the caller has no insert grant on
 * `moderation_flags` and should not: a direct PostgREST insert could otherwise
 * file a flag about content the caller has never seen. That means the
 * visibility check is explicit here instead of being left to RLS, and it
 * mirrors each table's own select policy exactly:
 *
 *   review        public, so anybody signed in may report one
 *   post          can_use_discussion_category(club, category)
 *   reply         the same, through its post
 *   event_post    can_access_event_board(event)
 *   event_reply   the same, through its post
 *   message       sender or recipient
 *
 * That is a coupling. Those helpers read `auth.uid()` from the request GUC
 * rather than from the session role, which is what lets a definer function ask
 * them about the caller, and `supabase/tests/stage7-moderation.sql` proves the
 * message case by having a stranger try. **If one of those policies changes,
 * this list changes with it** or somebody can report what they cannot read.
 */
create or replace function public.flag_content(
  p_type text, p_id bigint, p_reason text default ''
) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_club bigint; v_event bigint; v_seen boolean := false; v_id bigint;
        v_me uuid := (select auth.uid());
begin
  if v_me is null then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  if p_type = 'review' then
    select club_id into v_club from public.club_reviews
     where id = p_id and removed_at is null;
    v_seen := v_club is not null;

  elsif p_type = 'post' then
    select p.club_id into v_club from public.club_discussion_posts p
     where p.id = p_id and p.removed_at is null
       and public.can_use_discussion_category(p.club_id, p.category);
    v_seen := v_club is not null;

  elsif p_type = 'reply' then
    select p.club_id into v_club
      from public.club_discussion_replies r
      join public.club_discussion_posts p on p.id = r.post_id
     where r.id = p_id and r.removed_at is null and p.removed_at is null
       and public.can_use_discussion_category(p.club_id, p.category);
    v_seen := v_club is not null;

  elsif p_type = 'event_post' then
    select e.club_id, e.id into v_club, v_event
      from public.club_event_board_posts b
      join public.club_events e on e.id = b.event_id
     where b.id = p_id and b.removed_at is null
       and public.can_access_event_board(b.event_id);
    v_seen := v_club is not null;

  elsif p_type = 'event_reply' then
    select e.club_id, e.id into v_club, v_event
      from public.club_event_board_replies r
      join public.club_event_board_posts b on b.id = r.post_id
      join public.club_events e on e.id = b.event_id
     where r.id = p_id and r.removed_at is null and b.removed_at is null
       and public.can_access_event_board(b.event_id);
    v_seen := v_club is not null;

  elsif p_type = 'message' then
    -- A message carries no club when it is not about one, so being a party to
    -- it is what proves the caller may see it.
    select club_id into v_club from public.club_messages
     where id = p_id and removed_at is null
       and (sender_id = v_me or recipient_id = v_me);
    v_seen := found;

  else
    raise exception 'UNKNOWN_TARGET';
  end if;

  -- "Not there" and "not yours" are deliberately the same answer, so a refusal
  -- does not confirm that a private message exists.
  if not v_seen then raise exception 'TARGET_NOT_FOUND'; end if;

  insert into public.moderation_flags
    (target_type, target_id, club_id, event_id, flagged_by, reason)
  values (p_type, p_id, v_club, v_event, v_me, left(coalesce(p_reason, ''), 500))
  -- Reporting the same thing twice is not two problems.
  on conflict do nothing
  returning id into v_id;

  if v_id is null then return null; end if;

  -- The review columns stay in step, so the club page keeps working.
  if p_type = 'review' then
    update public.club_reviews
       set flagged_at = coalesce(flagged_at, now()),
           flagged_by = coalesce(flagged_by, v_me)
     where id = p_id;
  end if;

  return v_id;
end $$;

/** Telling the admins is a trigger, so every path that files a flag reaches it. */
create or replace function public.moderation_flag_told() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_admin record;
begin
  for v_admin in
    select id from public.profiles
     where role = 'admin' and coalesce(is_active, true)
       and id is distinct from new.flagged_by
  loop
    perform public.notify_person(
      v_admin.id, 'content-reported',
      'Something has been reported',
      'Somebody reported a ' || new.target_type || ' for a look.',
      '/admin/moderation', 'moderation_flag', new.id::text, '');
  end loop;
  return new;
end $$;

drop trigger if exists moderation_flag_told on public.moderation_flags;
create trigger moderation_flag_told after insert on public.moderation_flags
  for each row execute function public.moderation_flag_told();

-- ------------------------------------------------------------------ queue

/**
 * Everything waiting, with the words that were reported.
 *
 * One `union all` over the six tables rather than six round trips, and a LEFT
 * join to them, which matters more than it looks: removing a post sets
 * `removed_at`, and an inner join would then drop the flag out of the queue
 * entirely. An admin who removed something by mistake would have no way back
 * to it, and the record of what they did would be gone from the only screen
 * that shows it. It stays, marked `target_gone`, with no words to show.
 *
 * `total_count` rides on every row, the same shape `admin_clubs` uses, so the
 * pager is right without a second query.
 */
create or replace function public.moderation_queue(
  p_type text default '', p_status text default 'open', p_query text default '',
  p_limit integer default 25, p_offset integer default 0
) returns table (
  id bigint, target_type text, target_id bigint, status text,
  reason text, resolution text, created_at timestamptz,
  reporter_name text, author_name text, author_id uuid,
  club_slug text, club_name text, body text, title text,
  /** The words have gone: removed, or the row deleted with its parent. */
  target_gone boolean, total_count bigint
)
language plpgsql stable security definer set search_path = public as $$
declare v_like text := '%' || btrim(coalesce(p_query, '')) || '%';
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  return query
  with targets as (
    select 'review'::text as t, r.id, r.author_profile_id as author,
           ''::text as ttl, coalesce(r.comment, '') as body
      from public.club_reviews r where r.removed_at is null
    union all
    select 'post', p.id, p.author_profile_id, p.title, p.content
      from public.club_discussion_posts p where p.removed_at is null
    union all
    select 'reply', r.id, r.author_profile_id, '', r.content
      from public.club_discussion_replies r where r.removed_at is null
    union all
    select 'event_post', b.id, b.author_profile_id, b.title, b.content
      from public.club_event_board_posts b where b.removed_at is null
    union all
    select 'event_reply', r.id, r.author_profile_id, '', r.content
      from public.club_event_board_replies r where r.removed_at is null
    union all
    select 'message', m.id, m.sender_id, '', m.content
      from public.club_messages m where m.removed_at is null
  ),
  matching as (
    select f.*, t.author, coalesce(t.ttl, '') as ttl, coalesce(t.body, '') as body,
           t.id is null as gone
      from public.moderation_flags f
      left join targets t on t.t = f.target_type and t.id = f.target_id
     where (btrim(coalesce(p_type, '')) = '' or f.target_type = p_type)
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
         m.body, m.ttl, m.gone, counted.n
    from matching m
    left join public.profiles rp on rp.id = m.flagged_by
    left join public.profiles au on au.id = m.author
    left join public.clubs c on c.id = m.club_id
    cross join counted
   -- Oldest first while they are waiting: somebody has been waiting longest.
   order by case when m.status = 'open' then 0 else 1 end,
            case when m.status = 'open' then m.created_at end asc,
            m.created_at desc
   limit greatest(coalesce(p_limit, 25), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end $$;

/** The figures beside each tab, narrowing with the search like every other. */
create or replace function public.moderation_queue_counts(
  p_type text default '', p_query text default ''
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_all int; v_open int; v_answered int;
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  select count(*) into v_all from public.moderation_queue(p_type, '', p_query, 100000, 0);
  select count(*) into v_open from public.moderation_queue(p_type, 'open', p_query, 100000, 0);
  v_answered := v_all - v_open;

  return jsonb_build_object('all', v_all, 'open', v_open, 'answered', v_answered);
end $$;

/**
 * Answer one.
 *
 * `keep` dismisses the flag and leaves the words alone, which is legacy's
 * behaviour for a review and the right default: a report is somebody's opinion.
 * `remove` soft-deletes the target through the same `removed_at` every other
 * path uses, so a removed post still holds its thread together.
 *
 * Every open flag on the same thing is answered at once. Three people reporting
 * one post is one decision, not three.
 */
create or replace function public.resolve_moderation_flag(
  p_flag bigint, p_action text, p_reason text default ''
) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_type text; v_target bigint; v_me uuid := (select auth.uid());
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;
  if p_action not in ('keep', 'remove') then
    raise exception 'UNKNOWN_ACTION';
  end if;

  select target_type, target_id into v_type, v_target
    from public.moderation_flags where id = p_flag and status = 'open';
  if v_type is null then raise exception 'FLAG_NOT_FOUND'; end if;

  if p_action = 'remove' then
    if v_type = 'review' then
      update public.club_reviews set removed_at = now(), removed_by = v_me
       where id = v_target and removed_at is null;
    elsif v_type = 'post' then
      update public.club_discussion_posts set removed_at = now(), removed_by = v_me
       where id = v_target and removed_at is null;
    elsif v_type = 'reply' then
      update public.club_discussion_replies set removed_at = now(), removed_by = v_me
       where id = v_target and removed_at is null;
    elsif v_type = 'event_post' then
      update public.club_event_board_posts set removed_at = now(), removed_by = v_me
       where id = v_target and removed_at is null;
    elsif v_type = 'event_reply' then
      update public.club_event_board_replies set removed_at = now(), removed_by = v_me
       where id = v_target and removed_at is null;
    elsif v_type = 'message' then
      update public.club_messages set removed_at = now(), removed_by = v_me
       where id = v_target and removed_at is null;
    end if;
  elsif v_type = 'review' then
    -- Keeping a review clears the mirrored flag, or the club page goes on
    -- showing it as reported after somebody decided it was fine.
    update public.club_reviews
       set flagged_at = null, flagged_by = null, flagged_by_name = null
     where id = v_target;
  end if;

  update public.moderation_flags
     set status = case when p_action = 'remove' then 'actioned' else 'dismissed' end,
         resolution = left(coalesce(p_reason, ''), 500),
         resolved_by = v_me, resolved_at = now()
   where target_type = v_type and target_id = v_target and status = 'open';

  return true;
end $$;

revoke all on function public.flag_content(text, bigint, text) from public, anon;
revoke all on function public.moderation_queue(text, text, text, integer, integer)
  from public, anon;
revoke all on function public.moderation_queue_counts(text, text) from public, anon;
revoke all on function public.resolve_moderation_flag(bigint, text, text) from public, anon;

grant execute on function public.flag_content(text, bigint, text) to authenticated;
grant execute on function public.moderation_queue(text, text, text, integer, integer)
  to authenticated;
grant execute on function public.moderation_queue_counts(text, text) to authenticated;
grant execute on function public.resolve_moderation_flag(bigint, text, text) to authenticated;
