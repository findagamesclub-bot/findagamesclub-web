-- 0128 · The club answers its own reports first
--
-- 0122 sent every report to the site admin and stopped. That is backwards for
-- community content and it is not how anywhere else works: on Facebook Groups,
-- Reddit and Discord a report on something posted inside a community goes to
-- that community's own moderators, and the platform only steps in for site-wide
-- rules or an appeal. The owner is closest to the context and the fastest to
-- act, and an admin who has never been to the club is guessing.
--
-- So the club gets its own queue over its own flags, and `/admin/moderation`
-- stays site-wide with the final say.
--
-- Two kinds of report never reach the club, because nobody should rule on
-- themselves:
--   · a review, which is somebody's opinion OF the club
--   · anything written by the club's own team
-- Both stay admin-only, and `club_may_judge` is the single place that says so
-- rather than the rule being written out in the queue, the counts and the
-- answer and drifting between them.
--
-- Checked on a throwaway Postgres built from every migration: a stranger and a
-- plain member are refused, a helper is not, a club sees only its own flags,
-- a review and a team member's post are hidden from the club and still in the
-- admin's queue, the club's answer tells the reporter through 0127's trigger,
-- an admin can overrule an answered flag, and putting something back clears
-- the removal.

/** Who wrote the thing a flag points at. One lookup, six tables. */
create or replace function public.flag_author(p_type text, p_id bigint)
returns uuid
language plpgsql stable security definer set search_path = public as $$
declare v_who uuid;
begin
  if p_type = 'review' then
    select author_profile_id into v_who from public.club_reviews where id = p_id;
  elsif p_type = 'post' then
    select author_profile_id into v_who from public.club_discussion_posts where id = p_id;
  elsif p_type = 'reply' then
    select author_profile_id into v_who from public.club_discussion_replies where id = p_id;
  elsif p_type = 'event_post' then
    select author_profile_id into v_who from public.club_event_board_posts where id = p_id;
  elsif p_type = 'event_reply' then
    select author_profile_id into v_who from public.club_event_board_replies where id = p_id;
  elsif p_type = 'message' then
    select sender_id into v_who from public.club_messages where id = p_id;
  end if;
  return v_who;
end $$;

/**
 * May this club answer this report itself?
 *
 * Deliberately not "may this person": the person is checked by `club_can`, and
 * this is about the report. Keeping the two apart is what lets the queue, the
 * counts and the answer share one rule.
 */
create or replace function public.club_may_judge(
  p_club bigint, p_type text, p_target bigint
) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v_author uuid;
begin
  -- A review is about the club. A club deciding whether a bad review of itself
  -- stays up is the one conflict of interest this whole queue must not create.
  if p_type = 'review' then return false; end if;

  v_author := public.flag_author(p_type, p_target);
  if v_author is null then return true; end if;

  -- Their own team's words go to the admin, including the owner's own.
  return not exists (
    select 1 from public.club_team t
     where t.club_id = p_club and t.profile_id = v_author);
end $$;

/**
 * A club's own queue.
 *
 * `board.moderate`, which admits a helper: taking a post down is already theirs
 * (0069) and the plan has always said helpers see flags. Answering one is the
 * same job they already do from the board, with a reason attached.
 */
create or replace function public.club_moderation_queue(
  p_club bigint, p_type text default '', p_status text default 'open',
  p_query text default '', p_limit integer default 25, p_offset integer default 0
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
  -- `is_admin()` as well as `club_can`, because `club_role_of` returns null for
  -- an admin with no team row while `getClubAccess` gives them every capability
  -- at every club. Without this an admin opening a club's console reads "the
  -- queue would not load" about a queue that is working perfectly.
  if not (public.club_can(p_club, 'board.moderate') or public.is_admin()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  return query
  with targets as (
    select 'post'::text as t, p.id, p.author_profile_id as author,
           p.title as ttl, p.content as body
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
     where f.club_id = p_club
       and f.status <> 'withdrawn'
       and public.club_may_judge(p_club, f.target_type, f.target_id)
       and (btrim(coalesce(p_type, '')) = '' or f.target_type = p_type)
       and (btrim(coalesce(p_status, '')) = ''
            or (p_status = 'answered' and f.status <> 'open')
            or f.status = p_status)
       -- Content that has gone another way is not work anybody can do.
       and (f.status <> 'open' or t.id is not null)
       and (btrim(coalesce(p_query, '')) = ''
            or t.body ilike v_like or t.ttl ilike v_like or f.reason ilike v_like)
  ),
  counted as (select count(*) as n from matching)
  select m.id, m.target_type, m.target_id, m.status, m.reason, m.resolution,
         m.created_at,
         -- The club is never told who reported something. A roster of forty
         -- and a name on the screen is how a report becomes a falling out.
         'Somebody'::text,
         coalesce(nullif(btrim(au.full_name), ''), 'Somebody'),
         m.author,
         coalesce(c.slug::text, ''), coalesce(c.name, ''),
         m.body, m.ttl, m.gone, counted.n
    from matching m
    left join public.profiles au on au.id = m.author
    left join public.clubs c on c.id = m.club_id
    cross join counted
   order by case when m.status = 'open' then 0 else 1 end,
            case when m.status = 'open' then m.created_at end asc,
            m.created_at desc
   limit greatest(coalesce(p_limit, 25), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end $$;

/** The figures beside each tab, narrowing with the search and the kind. */
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
    from public.club_moderation_queue(p_club, p_type, '', p_query, 100000, 0);
  select count(*) into v_open
    from public.club_moderation_queue(p_club, p_type, 'open', p_query, 100000, 0);

  return jsonb_build_object('all', v_all, 'open', v_open, 'answered', v_all - v_open);
end $$;

/**
 * The club's answer.
 *
 * The same two actions the admin has, over the same soft deletes, so a post
 * taken down here is taken down exactly as it would be from the board. 0127's
 * trigger then tells the reporter, which is why this writes the status through
 * an ordinary update rather than doing anything clever.
 */
create or replace function public.resolve_club_flag(
  p_flag bigint, p_action text, p_reason text default ''
) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_type text; v_target bigint; v_club bigint; v_me uuid := (select auth.uid());
begin
  if p_action not in ('keep', 'remove') then
    raise exception 'UNKNOWN_ACTION';
  end if;

  select target_type, target_id, club_id into v_type, v_target, v_club
    from public.moderation_flags where id = p_flag and status = 'open';
  if v_type is null then raise exception 'FLAG_NOT_FOUND'; end if;

  if v_club is null
     or not (public.club_can(v_club, 'board.moderate') or public.is_admin()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;
  if not public.club_may_judge(v_club, v_type, v_target) then
    raise exception 'ADMIN_ONLY';
  end if;

  if p_action = 'remove' then
    if v_type = 'post' then
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
  end if;

  -- Three people reporting one post is one decision, here as well.
  update public.moderation_flags
     set status = case when p_action = 'remove' then 'actioned' else 'dismissed' end,
         resolution = left(coalesce(p_reason, ''), 500),
         resolved_by = v_me, resolved_at = now()
   where target_type = v_type and target_id = v_target and status = 'open';

  return true;
end $$;

revoke all on function public.flag_author(text, bigint) from public, anon;
revoke all on function public.club_may_judge(bigint, text, bigint) from public, anon;
revoke all on function public.club_moderation_queue(bigint, text, text, text, integer, integer)
  from public, anon;
revoke all on function public.club_moderation_counts(bigint, text, text) from public, anon;
revoke all on function public.resolve_club_flag(bigint, text, text) from public, anon;

grant execute on function public.club_may_judge(bigint, text, bigint) to authenticated;
grant execute on function public.club_moderation_queue(bigint, text, text, text, integer, integer)
  to authenticated;
grant execute on function public.club_moderation_counts(bigint, text, text) to authenticated;
grant execute on function public.resolve_club_flag(bigint, text, text) to authenticated;
-- `flag_author` stays ungranted. It answers "who wrote this" about content a
-- caller may not be able to see, and the two functions above are definer, so
-- nothing outside this file needs it.

/**
 * And the admin has the final say, which means being able to change one.
 *
 * 0122 refused anything that was not still open, which was right when the admin
 * was the only one answering. Now the club answers first, so "the platform
 * steps in for an appeal" has to be a real thing an admin can do: `keep` on
 * something the club took down puts it back, which is the only un-removal
 * anywhere in this codebase and belongs to nobody else.
 *
 * A withdrawn flag is still untouchable. Nobody answers a question that was
 * taken back.
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
    from public.moderation_flags where id = p_flag and status <> 'withdrawn';
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
  else
    -- Putting it back. Only reaches anything when somebody had taken it down.
    if v_type = 'review' then
      update public.club_reviews
         set removed_at = null, removed_by = null,
             flagged_at = null, flagged_by = null, flagged_by_name = null
       where id = v_target;
    elsif v_type = 'post' then
      update public.club_discussion_posts set removed_at = null, removed_by = null
       where id = v_target;
    elsif v_type = 'reply' then
      update public.club_discussion_replies set removed_at = null, removed_by = null
       where id = v_target;
    elsif v_type = 'event_post' then
      update public.club_event_board_posts set removed_at = null, removed_by = null
       where id = v_target;
    elsif v_type = 'event_reply' then
      update public.club_event_board_replies set removed_at = null, removed_by = null
       where id = v_target;
    elsif v_type = 'message' then
      update public.club_messages set removed_at = null, removed_by = null
       where id = v_target;
    end if;
  end if;

  update public.moderation_flags
     set status = case when p_action = 'remove' then 'actioned' else 'dismissed' end,
         resolution = left(coalesce(p_reason, ''), 500),
         resolved_by = v_me, resolved_at = now()
   where target_type = v_type and target_id = v_target and status <> 'withdrawn';

  return true;
end $$;

/**
 * And the reporter is told when the answer changes, not only the first time.
 *
 * 0127 fired on `old.status = 'open'`, which was the only transition there was.
 * An admin overruling a club goes from actioned to dismissed, and the person
 * who reported it is exactly who needs to know that the answer moved.
 */
create or replace function public.moderation_flag_answered() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_thing text; v_what text;
begin
  if new.status not in ('dismissed', 'actioned')
     or old.status is not distinct from new.status then
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
    case when btrim(coalesce(new.resolution, '')) = '' then v_what
         else v_what || ' ' || btrim(new.resolution) end,
    '/account/reports',
    'moderation_flag', new.id::text, '');

  return new;
end $$;

-- ------------------------------------------------- one way in, for a review
--
-- 0017 granted the owner `update (flagged_at, flagged_by_name)`, so the club's
-- "Flag for review" button wrote the column straight. It toasted "Flagged for
-- an administrator to look at" and filed nothing: no `moderation_flags` row
-- was ever created, so no admin ever saw it. The button has never once worked
-- the way its own words describe.
--
-- The column stays, because the club page reads it and the review is still the
-- one kind with two mechanisms for one fact. What goes is the ability to write
-- it from outside: `flag_content` sets it, `withdraw_moderation_flag` and
-- `resolve_moderation_flag` clear it, and all three are definer. So the chip on
-- the club page and the report in the admin's queue can no longer disagree.
revoke update (flagged_at, flagged_by_name) on public.club_reviews from authenticated;

do $$
declare v_bad boolean;
begin
  select bool_or(privilege_type is not null) into v_bad
    from information_schema.role_column_grants
   where table_schema = 'public' and table_name = 'club_reviews'
     and grantee = 'authenticated' and privilege_type = 'UPDATE'
     and column_name in ('flagged_at', 'flagged_by_name');
  if coalesce(v_bad, false) then
    raise exception 'club_reviews still lets a member write the flag columns';
  end if;
end $$;
