-- 0131 · Telling whoever is going to answer it
--
-- 0122's trigger told every site admin and nobody else, which was right when
-- the admin was the only one who could answer. 0128 moved most reports to the
-- club, and the notice did not move with it: the people who now do the work
-- were told nothing and found out by noticing a badge in their own rail, while
-- the admins were told about work that is no longer theirs.
--
-- It follows the same rule the queues do, through the same function, so the
-- notice and the queue can never disagree about who is dealing with something:
--   · the club may judge it  -> its team is told, and linked to their queue
--   · it is a review, or its own team's words -> the admins are told
--
-- Nobody is told about their own report, on either side.
--
-- Checked on a throwaway Postgres built from every migration: a report on a
-- member's post tells the owner, the manager and the helper and no admin; a
-- report on a review tells the admins and nobody at the club; an owner
-- reporting something at their own club is not told about it; and the notice
-- names the thing in words rather than printing `event_post`.

create or replace function public.moderation_flag_told() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_person record;
  v_thing text;
  v_club text;
  v_slug text;
begin
  v_thing := case new.target_type
    when 'review' then 'a review'
    when 'post' then 'a board post'
    when 'reply' then 'a board reply'
    when 'event_post' then 'an event post'
    when 'event_reply' then 'an event reply'
    when 'message' then 'a message'
    else 'something' end;

  if new.club_id is not null
     and public.club_may_judge(new.club_id, new.target_type, new.target_id)
  then
    select c.name, c.slug::text into v_club, v_slug
      from public.clubs c where c.id = new.club_id;

    -- Whoever at this club may answer it, read off the same capability matrix
    -- the console nav and the queue use rather than a second list of roles.
    for v_person in
      select t.profile_id as id from public.club_team t
       where t.club_id = new.club_id
         and 'board.moderate' = any (public.club_role_capabilities(t.role))
         and t.profile_id is distinct from new.flagged_by
    loop
      perform public.notify_person(
        v_person.id, 'content-reported',
        'Something has been reported at ' || coalesce(v_club, 'your club'),
        'A member reported ' || v_thing || ' for a look.',
        '/clubs/' || coalesce(v_slug, '') || '/manage/moderation',
        'moderation_flag', new.id::text, '');
    end loop;

    return new;
  end if;

  -- A review, or the club's own team's words: nobody at the club may rule on
  -- it, so telling them would be telling them about somebody else's job.
  for v_person in
    select id from public.profiles
     where role = 'admin' and coalesce(is_active, true)
       and id is distinct from new.flagged_by
  loop
    perform public.notify_person(
      v_person.id, 'content-reported',
      'Something has been reported',
      'A member reported ' || v_thing || ' for a look.',
      '/admin/moderation', 'moderation_flag', new.id::text, '');
  end loop;

  return new;
end $$;
