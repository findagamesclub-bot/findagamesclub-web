-- 0127 · The other half of reporting
--
-- 0122 built the admin's side and stopped there. A member could report
-- something and then had no way of knowing they had: the page looked identical
-- afterwards, pressing Report again only said "you already did" after a reason
-- had been typed into it, nothing listed what they had reported, and when an
-- admin decided, the person who raised it was never told. Reporting into
-- silence is how people stop reporting.
--
-- Four things here, none of which change who may see or remove anything:
--   · `withdrawn`, so a mis-press does not sit in a queue forever
--   · `withdraw_moderation_flag`, which only the reporter may call
--   · a trigger telling every reporter when their flag is answered
--   · `my_reports` / `my_report_counts`, the reporter's own view
--
-- Which of the things on a page you have already flagged needs no function:
-- `moderation_flags_select` (0122) already lets a reporter read their own rows,
-- so the repository selects them directly and RLS is the guard.
--
-- Checked on a throwaway Postgres built from every migration: a stranger
-- cannot withdraw somebody else's flag, withdrawing clears a review's mirrored
-- flag only when no other report is open on it, answering tells every reporter
-- but not the admin who answered, withdrawing tells nobody, a withdrawn flag
-- never appears in the admin queue, and `my_reports` shows one person's own
-- and nobody else's.

alter table public.moderation_flags
  drop constraint if exists moderation_flags_status;
alter table public.moderation_flags
  add constraint moderation_flags_status
  check (status in ('open', 'dismissed', 'actioned', 'withdrawn'));

/**
 * Taking a report back.
 *
 * The reporter's own, and only while it is open: once an admin has answered
 * it, the answer is a decision somebody took and not something the person who
 * asked for it may erase. Withdrawn rather than deleted for the same reason
 * 0106 gives about a declined listing.
 */
create or replace function public.withdraw_moderation_flag(p_flag bigint)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_me uuid := (select auth.uid()); v_type text; v_target bigint;
begin
  select target_type, target_id into v_type, v_target
    from public.moderation_flags
   where id = p_flag and flagged_by = v_me and status = 'open';
  if v_type is null then
    raise exception 'FLAG_NOT_FOUND';
  end if;

  update public.moderation_flags
     set status = 'withdrawn', resolved_by = v_me, resolved_at = now()
   where id = p_flag;

  -- `club_reviews` keeps its own `flagged_at` so the club page works
  -- unchanged, which means two mechanisms for one fact. Clear it only when
  -- nothing else is still open against that review, or one person changing
  -- their mind would unflag a review two other people have reported.
  if v_type = 'review' and not exists (
    select 1 from public.moderation_flags
     where target_type = 'review' and target_id = v_target and status = 'open')
  then
    update public.club_reviews
       set flagged_at = null, flagged_by = null, flagged_by_name = null
     where id = v_target;
  end if;

  return true;
end $$;

/**
 * Telling the person who reported it what happened.
 *
 * A trigger on the update rather than a call inside `resolve_moderation_flag`,
 * for the reason 0124 and 0126 both give: the status moves from the admin
 * dialog today and will move from a bulk action or an appeal later, and a
 * notice that fires on one path is worse than none.
 *
 * Nothing is sent when the admin was also the reporter, and nothing is sent on
 * a withdrawal: being told the outcome of a decision you made yourself is
 * noise.
 *
 * The author of the content is deliberately not told either. Legacy tells
 * nobody, the client asked for a queue rather than a warning system, and
 * "somebody reported you" is a message that invites a hunt for who. Warning an
 * author is its own feature with its own wording, and it is in the plan for
 * the moderation dialog, not here.
 */
create or replace function public.moderation_flag_answered() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_thing text; v_what text;
begin
  if old.status <> 'open' or new.status not in ('dismissed', 'actioned') then
    return new;
  end if;
  if new.flagged_by is null
     or new.flagged_by is not distinct from (select auth.uid()) then
    return new;
  end if;

  v_thing := case new.target_type
    when 'review' then 'The review'
    when 'post' then 'The board post'
    when 'reply' then 'The board reply'
    when 'event_post' then 'The event post'
    when 'event_reply' then 'The event reply'
    when 'message' then 'The message'
    else 'What you reported' end;

  v_what := v_thing || case when new.status = 'actioned'
    then ' you reported has been taken down.'
    else ' you reported has been left up.' end;

  perform public.notify_person(
    new.flagged_by,
    'report-answered',
    'Your report was looked at',
    -- The admin's own words when there are any. Without them the outcome on
    -- its own still answers the only question the reporter has.
    case when btrim(coalesce(new.resolution, '')) = '' then v_what
         else v_what || ' ' || btrim(new.resolution) end,
    '/account/reports',
    'moderation_flag', new.id::text, '');

  return new;
end $$;

drop trigger if exists moderation_flag_answered on public.moderation_flags;
create trigger moderation_flag_answered after update on public.moderation_flags
  for each row execute function public.moderation_flag_answered();

/**
 * What one person has reported.
 *
 * The same union as `moderation_queue`, scoped to the caller's own flags. It
 * has to be definer: a removed post is hidden from everybody by its own select
 * policy, so a reporter reading through RLS would be told their report was
 * actioned and shown nothing, which reads as the site having lost it.
 *
 * Deliberately narrower than the admin's view. No reporter name, because the
 * only reporter here is you. No author name and no other reporters, because a
 * report is anonymous in both directions and somebody checking on their own
 * report has no business assembling a case file.
 */
create or replace function public.my_reports(
  p_status text default 'open', p_limit integer default 20, p_offset integer default 0
) returns table (
  id bigint, target_type text, status text, reason text, resolution text,
  created_at timestamptz, resolved_at timestamptz,
  club_slug text, club_name text, body text, title text,
  target_gone boolean, total_count bigint
)
language plpgsql stable security definer set search_path = public as $$
declare v_me uuid := (select auth.uid());
begin
  if v_me is null then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  return query
  with targets as (
    select 'review'::text as t, r.id, ''::text as ttl, coalesce(r.comment, '') as body
      from public.club_reviews r where r.removed_at is null
    union all
    select 'post', p.id, p.title, p.content
      from public.club_discussion_posts p where p.removed_at is null
    union all
    select 'reply', r.id, '', r.content
      from public.club_discussion_replies r where r.removed_at is null
    union all
    select 'event_post', b.id, b.title, b.content
      from public.club_event_board_posts b where b.removed_at is null
    union all
    select 'event_reply', r.id, '', r.content
      from public.club_event_board_replies r where r.removed_at is null
    union all
    select 'message', m.id, '', m.content
      from public.club_messages m where m.removed_at is null
  ),
  matching as (
    select f.*, coalesce(t.ttl, '') as ttl, coalesce(t.body, '') as body,
           t.id is null as gone
      from public.moderation_flags f
      left join targets t on t.t = f.target_type and t.id = f.target_id
     where f.flagged_by = v_me
       and (btrim(coalesce(p_status, '')) = 'any'
            or (p_status = 'answered' and f.status in ('dismissed', 'actioned'))
            or (p_status = 'open' and f.status = 'open')
            or (p_status = 'withdrawn' and f.status = 'withdrawn'))
  ),
  counted as (select count(*) as n from matching)
  select m.id, m.target_type, m.status, m.reason, m.resolution,
         m.created_at, m.resolved_at,
         coalesce(c.slug::text, ''), coalesce(c.name, ''),
         m.body, m.ttl, m.gone, counted.n
    from matching m
    left join public.clubs c on c.id = m.club_id
    cross join counted
   -- Newest first. Unlike the admin queue this is not a worklist, so what
   -- somebody wants is the one they just filed.
   order by m.created_at desc, m.id desc
   limit greatest(coalesce(p_limit, 20), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end $$;

/** The figures beside each tab. */
create or replace function public.my_report_counts() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_me uuid := (select auth.uid());
begin
  if v_me is null then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  return (
    with mine as (
      select status from public.moderation_flags where flagged_by = v_me)
    select jsonb_build_object(
      'all',       (select count(*) from mine),
      'open',      (select count(*) from mine where status = 'open'),
      'answered',  (select count(*) from mine where status in ('dismissed', 'actioned')),
      'withdrawn', (select count(*) from mine where status = 'withdrawn')
    ));
end $$;

revoke all on function public.withdraw_moderation_flag(bigint) from public, anon;
revoke all on function public.my_reports(text, integer, integer) from public, anon;
revoke all on function public.my_report_counts() from public, anon;
grant execute on function public.withdraw_moderation_flag(bigint) to authenticated;
grant execute on function public.my_reports(text, integer, integer) to authenticated;
grant execute on function public.my_report_counts() to authenticated;

/**
 * And the admin queue never shows a withdrawn one.
 *
 * Its status filter reads "answered" as anything that is not open, so without
 * this a report somebody took back would sit in the Answered tab as though an
 * admin had ruled on it. The queue is a worklist and a record of decisions;
 * a withdrawal is neither. The row is still there for anybody querying the
 * table, so a pattern of reporting and withdrawing is not hidden, it just is
 * not filed as work.
 *
 * Replaced whole rather than patched, because `create or replace` cannot take
 * a fragment. The only change is the `f.status <> 'withdrawn'` line.
 */
create or replace function public.moderation_queue(
  p_type text default '', p_status text default 'open', p_query text default '',
  p_limit integer default 25, p_offset integer default 0
) returns table (
  id bigint, target_type text, target_id bigint, status text,
  reason text, resolution text, created_at timestamptz,
  reporter_name text, author_name text, author_id uuid,
  club_slug text, club_name text, body text, title text,
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
