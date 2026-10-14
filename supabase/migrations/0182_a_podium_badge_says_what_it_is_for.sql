-- 0182 · a podium badge says what it is for, and keeps saying it.
--
-- The client, on 20b: "still looks to be an issue, 2nd and 3rd place badges
-- show, but 1st place badge does now not show or update."
--
-- THE BADGE AWARDS AND SHOWS. Driven before writing a line of this: a first
-- place recorded against an account that did not hold the badge put
-- "gul-admin · First place · 1st place at Oxford Onslaught 5." into the club's
-- awarded list within a second, and it draws on the profile. The three badges
-- are seeded, active, and `sync_podium_badges` walks 1 to 3 with no place
-- treated differently.
--
-- WHAT DOES NOT HAPPEN IS THE UPDATE, and that is the second half of the
-- client's sentence. `award_podium_badge` inserts `where not exists` a row the
-- member already holds, which is 0167's "one badge per rank per club, not one
-- per finish" and is right. Nothing then revisits the NOTE, so a member who
-- wins again keeps a badge describing the win before it. At Didcot both
-- accounts that can hold First place already did, from April and from a
-- campaign, so every new first place the client recorded looked like nothing
-- happening at all.
--
-- AND THE NOTE WAS ARBITRARY TO BEGIN WITH. `podium_finish_note` is a
-- `union all` of three sources under a bare `limit 1` with no `order by`, so
-- somebody with two firsts got whichever row the planner handed back. It reads
-- as stable only because small tables come back in insertion order.
--
-- So: order the finishes, newest first, name that one, and say how many more
-- there are. Then refresh the note whenever a recount runs. Updating `note`
-- notifies nobody: 0124 fires on insert, and 0126 returns early unless
-- `revoked_at` moves from null, which this never touches.

/**
 * The finishes behind one podium badge, newest first.
 *
 * Its own function because the note and the count both need the same list,
 * and two queries that have to agree about "which finishes count" are two
 * queries that will not.
 */
create or replace function public.podium_finishes(
  p_club bigint, p_profile uuid, p_place integer)
returns table (note text, on_date date)
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(btrim(res.placement), ''), 'Placed') || ' at ' ||
         coalesce(nullif(btrim(e.title), ''), 'one of our events') || '.',
         e.start_date
    from public.club_event_results res
    join public.club_events e on e.id = res.event_id
   where e.club_id = p_club and res.member_profile_id = p_profile
     and res.rank = p_place
  union all
  select 'Finished ' || s.rank || ' in ' ||
         coalesce(nullif(btrim(c.title), ''), 'a competition') || '.',
         coalesce(c.end_date, c.start_date)
    from public.club_competition_standings s
    join public.club_competitions c on c.id = s.competition_id
   where c.club_id = p_club and s.profile_id = p_profile and s.rank = p_place
     and c.status = 'completed'
  union all
  select coalesce(nullif(btrim(t.placement), ''), 'Placed') || ' with ' ||
         btrim(t.name) || ' at ' ||
         coalesce(nullif(btrim(e.title), ''), 'one of our events') || '.',
         e.start_date
    from public.club_event_teams t
    join public.club_event_team_players tp on tp.team_id = t.id
    join public.club_events e on e.id = t.event_id
   where e.club_id = p_club and tp.profile_id = p_profile
     and t.final_rank = p_place
  -- Nulls last, so a finish with no date on it never outranks a dated one.
  order by 2 desc nulls last, 1;
$$;

/**
 * What the badge is for, as one line.
 *
 * The most recent finish, and how many others there are. A member who has won
 * twice should not read a badge that names only April, and a club that has
 * just recorded a second win should see the badge move.
 */
create or replace function public.podium_finish_note(
  p_club bigint, p_profile uuid, p_place integer)
returns text language plpgsql stable security definer set search_path = public as $$
declare v_note text; v_count integer;
begin
  select count(*) into v_count
    from public.podium_finishes(p_club, p_profile, p_place);
  if v_count = 0 then return null; end if;

  select f.note into v_note
    from public.podium_finishes(p_club, p_profile, p_place) f limit 1;

  if v_count > 1 then
    -- "and 1 more", never "and 1 mores". The stage 5 singular lesson.
    v_note := rtrim(v_note, '.') || ', and ' || (v_count - 1) || ' more.';
  end if;
  return v_note;
end $$;

/**
 * The three podium badges, brought into line with what this member has won.
 *
 * 0174's own body with one paragraph added: where the badge is already held,
 * the note is brought up to date. Without it the badge is correct and silent,
 * which is what the client read as "does not show or update".
 */
create or replace function public.sync_podium_badges(
  p_club bigint, p_profile uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_place integer; v_badge bigint; v_note text;
begin
  if p_club is null or p_profile is null then return; end if;

  for v_place in 1..3 loop
    select id into v_badge from public.club_badges
     where club_id = p_club and podium_rank = v_place and active;
    -- Retired, or a club made by hand before the seed. Nothing to give and
    -- nothing to take, which is not an error.
    if v_badge is null then continue; end if;

    v_note := public.podium_finish_note(p_club, p_profile, v_place);

    if v_note is not null then
      perform public.award_podium_badge(p_club, p_profile, v_place, v_note);

      -- Already held, so the insert above wrote nothing. The finishes behind
      -- it have moved, so what it says about itself has to move with them.
      -- Only a badge the system gave: an owner who typed their own reason for
      -- handing somebody First place keeps their words.
      update public.member_badges
         set note = left(coalesce(v_note, ''), 200)
       where badge_id = v_badge and profile_id = p_profile
         and revoked_at is null and awarded_by is null
         and note is distinct from left(coalesce(v_note, ''), 200);
    else
      update public.member_badges
         set revoked_at = now(), revoked_by = null
       where badge_id = v_badge and profile_id = p_profile
         and revoked_at is null and awarded_by is null;
    end if;
  end loop;
end $$;

revoke all on function public.podium_finishes(bigint, uuid, integer)
  from public, anon, authenticated;
revoke all on function public.podium_finish_note(bigint, uuid, integer)
  from public, anon, authenticated;
revoke all on function public.sync_podium_badges(bigint, uuid)
  from public, anon, authenticated;

-- Every podium badge already out there is describing whichever finish the
-- planner happened to hand back. One sweep brings them all into line, quietly:
-- 0124 fires on insert and this writes none, and 0126 only speaks when a badge
-- goes, which this never does.
do $$
declare r record;
begin
  perform set_config('app.badge_notify_quiet', 'on', true);
  for r in
    select distinct m.club_id, m.profile_id
      from public.member_badges m
      join public.club_badges b on b.id = m.badge_id
     where b.podium_rank is not null and m.revoked_at is null
       and m.awarded_by is null
  loop
    perform public.sync_podium_badges(r.club_id, r.profile_id);
  end loop;
end $$;
