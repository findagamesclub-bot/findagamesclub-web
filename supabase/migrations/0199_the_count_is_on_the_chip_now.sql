-- The note names the newest win. The chip counts them.
--
-- 0182 wrote ", and 1 more." onto a podium badge's note because the badge had
-- no other way to admit it stood for more than one finish. 0198 gave it one:
-- the chip carries a count and opens the list. Keeping both says the same
-- thing twice, and the half it repeats is the exact phrase the client
-- objected to: *"the below first place badges which shows 'and 1 more'"*.
--
-- So the note goes back to naming the most recent finish and nothing else.
-- Which is 0182's first paragraph unchanged: a member who has won twice
-- should not read a badge that names only April.

create or replace function public.podium_finish_note(
  p_club bigint, p_profile uuid, p_place integer)
returns text language plpgsql stable security definer set search_path = public as $$
declare v_note text;
begin
  select f.note into v_note
    from public.podium_finishes(p_club, p_profile, p_place) f limit 1;
  return v_note;
end $$;

revoke all on function public.podium_finish_note(bigint, uuid, integer)
  from public, anon, authenticated;

-- And the notes already written are brought into line, quietly.
--
-- 0175's own sweep, which is the shape to copy rather than invent: every pair
-- that holds a system-given podium badge or has a finish that would earn one.
-- `app.badge_notify_quiet` is what stops forty members being told a badge
-- changed because a sentence got shorter.
do $$
declare r record; v_pairs integer := 0;
begin
  perform set_config('app.badge_notify_quiet', 'on', true);

  for r in
    select distinct club_id, profile_id from (
      select m.club_id, m.profile_id
        from public.member_badges m
        join public.club_badges b on b.id = m.badge_id
       where b.podium_rank is not null and m.revoked_at is null
         and m.awarded_by is null
      union
      select e.club_id, res.member_profile_id
        from public.club_event_results res
        join public.club_events e on e.id = res.event_id
       where res.member_profile_id is not null and res.rank between 1 and 3
      union
      select c.club_id, s.profile_id
        from public.club_competition_standings s
        join public.club_competitions c on c.id = s.competition_id
       where s.profile_id is not null and s.rank between 1 and 3
         and c.status = 'completed'
      union
      select e.club_id, tp.profile_id
        from public.club_event_teams t
        join public.club_event_team_players tp on tp.team_id = t.id
        join public.club_events e on e.id = t.event_id
       where tp.profile_id is not null and t.final_rank between 1 and 3
    ) pairs
   where profile_id is not null and club_id is not null
  loop
    perform public.sync_podium_badges(r.club_id, r.profile_id);
    v_pairs := v_pairs + 1;
  end loop;

  perform set_config('app.badge_notify_quiet', 'off', true);
  raise notice 'podium badge notes rewritten for % club and member pairs', v_pairs;
end $$;
