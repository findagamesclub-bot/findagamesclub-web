-- A report says who is looking at it.
--
-- Three times now the client has reported that board reply reports "are not
-- going back to the club owner", and three times the routing has been right.
-- The third time came with the evidence in it: two reports filed on 16 Oct,
-- one on a board POST which reached the club, one on a board REPLY which did
-- not. The reply was "hello from owner", written by sara khan, who owns the
-- club. 0128 sends a club's own team's words to a site admin, deliberately,
-- because a club ruling on whether a report about its owner stands is the
-- conflict of interest that queue exists to avoid.
--
-- So the rule is sound and invisible, which is the same thing as broken when
-- somebody is trying to check it. 14b put the rule in the report dialog, which
-- is seen once and then gone, and in the club queue's lede, which explains
-- what is ABSENT and so is read by nobody looking for something missing. The
-- one screen the client actually compared against is the member's own list of
-- what they reported, and it says nothing at all about where anything went.
--
-- `with_club` is that answer, per row. No routing changes.

-- The return type moves, which `create or replace` cannot do.
drop function if exists public.my_reports(text, text, text, text, integer, integer);

-- 0127's signatures, dead since 0130 replaced them with wider ones and left
-- these behind. A caller that forgets an argument resolves to the old function
-- and silently gets the old shape, which is this file's own trap one layer
-- down: without `with_club` the page would quietly draw nothing.
drop function if exists public.my_reports(text, integer, integer);
drop function if exists public.my_report_counts();

create function public.my_reports(
  p_status text default 'open', p_type text default '', p_query text default '',
  p_sort text default 'recent', p_limit integer default 20, p_offset integer default 0
) returns table (
  id bigint, target_type text, status text, reason text, resolution text,
  created_at timestamptz, resolved_at timestamptz,
  club_slug text, club_name text, body text, title text,
  target_gone boolean, with_club boolean, total_count bigint
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
         m.body, m.ttl, m.gone,
         -- The same function both queues ask, so the member's list and the
         -- club's list cannot disagree about who has something. A flag with no
         -- club on it belongs to a site admin by definition, and
         -- `club_may_judge` would answer true for it: `not exists` over a team
         -- nobody is on is true.
         case when m.club_id is null then false
              else public.club_may_judge(m.club_id, m.target_type, m.target_id)
         end,
         counted.n
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

revoke all on function public.my_reports(text, text, text, text, integer, integer)
  from public, anon;
grant execute on function public.my_reports(text, text, text, text, integer, integer)
  to authenticated;
