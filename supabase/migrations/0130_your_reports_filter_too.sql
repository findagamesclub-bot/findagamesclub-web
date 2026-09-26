-- 0130 · Searching your own reports
--
-- 0127 gave `/account/reports` tabs and nothing else, on the reasoning that one
-- person's own reports are a handful of rows and a search box that narrows
-- nothing is a control offering to do something it cannot. The client asked for
-- the same bar the two moderation queues have, and consistency is the stronger
-- argument: three screens about the same rows, and one of them behaving
-- differently is one more thing to learn for no reason.
--
-- Dropped and recreated rather than replaced: adding parameters changes the
-- signature, and `create or replace` would leave the old one behind as an
-- ambiguous overload.
--
-- Checked on a throwaway Postgres built from every migration: the search
-- matches the words, the reason and the answer, the kind narrows, both sorts
-- hold, the counts narrow with both, and somebody still sees only their own.

drop function if exists public.my_reports(text, integer, integer);
drop function if exists public.my_report_counts();

create or replace function public.my_reports(
  p_status text default 'open', p_type text default '', p_query text default '',
  p_sort text default 'recent', p_limit integer default 20, p_offset integer default 0
) returns table (
  id bigint, target_type text, status text, reason text, resolution text,
  created_at timestamptz, resolved_at timestamptz,
  club_slug text, club_name text, body text, title text,
  target_gone boolean, total_count bigint
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_me uuid := (select auth.uid());
  v_like text := '%' || btrim(coalesce(p_query, '')) || '%';
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
           t.id is null as gone, c.name as c_name, c.slug as c_slug
      from public.moderation_flags f
      left join targets t on t.t = f.target_type and t.id = f.target_id
      left join public.clubs c on c.id = f.club_id
     where f.flagged_by = v_me
       and (btrim(coalesce(p_status, '')) = 'any'
            or (p_status = 'answered' and f.status in ('dismissed', 'actioned'))
            or (p_status = 'open' and f.status = 'open')
            or (p_status = 'withdrawn' and f.status = 'withdrawn'))
       and (btrim(coalesce(p_type, '')) = '' or f.target_type = p_type)
       -- The words, why it was raised, what came back, and which club: four
       -- things somebody might remember about a report they filed weeks ago.
       and (btrim(coalesce(p_query, '')) = ''
            or t.body ilike v_like or t.ttl ilike v_like
            or f.reason ilike v_like or f.resolution ilike v_like
            or c.name ilike v_like)
  ),
  counted as (select count(*) as n from matching)
  select m.id, m.target_type, m.status, m.reason, m.resolution,
         m.created_at, m.resolved_at,
         coalesce(m.c_slug::text, ''), coalesce(m.c_name, ''),
         m.body, m.ttl, m.gone, counted.n
    from matching m
    cross join counted
   -- Newest first unless asked. Unlike the moderation queues this is not a
   -- worklist, so what somebody wants is the one they just filed.
   --
   -- The id breaks the tie in the same direction as the sort. Three reports
   -- filed in one sitting share a second, and a trailing `id desc` on both
   -- orders means "oldest first" hands back the newest of them.
   order by case when p_sort = 'oldest' then m.created_at end asc,
            case when p_sort = 'oldest' then m.id end asc,
            m.created_at desc, m.id desc
   limit greatest(coalesce(p_limit, 20), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end $$;

/** The figures beside each tab, narrowing with the search and the kind. */
create or replace function public.my_report_counts(
  p_type text default '', p_query text default ''
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_all int; v_open int; v_answered int; v_withdrawn int;
begin
  if (select auth.uid()) is null then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  select count(*) into v_all
    from public.my_reports('any', p_type, p_query, 'recent', 100000, 0);
  select count(*) into v_open
    from public.my_reports('open', p_type, p_query, 'recent', 100000, 0);
  select count(*) into v_answered
    from public.my_reports('answered', p_type, p_query, 'recent', 100000, 0);
  v_withdrawn := v_all - v_open - v_answered;

  return jsonb_build_object('all', v_all, 'open', v_open,
                            'answered', v_answered, 'withdrawn', v_withdrawn);
end $$;

revoke all on function public.my_reports(text, text, text, text, integer, integer)
  from public, anon;
revoke all on function public.my_report_counts(text, text) from public, anon;
grant execute on function public.my_reports(text, text, text, text, integer, integer)
  to authenticated;
grant execute on function public.my_report_counts(text, text) to authenticated;
