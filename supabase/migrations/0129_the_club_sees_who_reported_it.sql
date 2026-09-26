-- 0129 · The club is told who reported it
--
-- 0128 returned the reporter as 'Somebody' to a club, on the reasoning that
-- Facebook Groups, Reddit and Discord all keep a reporter anonymous from a
-- community's own moderators, and that on a roster of forty a name on the
-- screen is how a report becomes a falling out.
--
-- The client asked for the name, twice, having seen that reasoning. Theirs to
-- decide: it is their community and they know their clubs. The argument for it
-- is real too. A club that cannot see who raised something cannot tell one
-- member with a grudge from four people independently agreeing, and "somebody
-- reported you" with no way to weigh it is its own kind of unfair.
--
-- This is the only change: the same `left join public.profiles rp` the admin's
-- queue already has. Everything else about who may see and answer what is
-- unchanged.
--
-- If members ever go quiet about reporting, this function is where to look.
--
-- Checked on a throwaway Postgres built from every migration: the club now
-- reads the reporter's real name, a report from a deleted account still reads
-- 'Somebody' rather than blank, and every other rule in 0128 still holds.

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
         m.body, m.ttl, m.gone, counted.n
    from matching m
    left join public.profiles rp on rp.id = m.flagged_by
    left join public.profiles au on au.id = m.author
    left join public.clubs c on c.id = m.club_id
    cross join counted
   order by case when m.status = 'open' then 0 else 1 end,
            case when m.status = 'open' then m.created_at end asc,
            m.created_at desc
   limit greatest(coalesce(p_limit, 25), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end $$;
