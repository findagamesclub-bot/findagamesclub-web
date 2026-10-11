/**
 * A podium badge follows the placing it came from.
 *
 * The client's words: *"once a member is assigned a badge for 1st, 2nd or 3rd,
 * if the placing is then changed in future, the old badge is not removed. For
 * example, Joe is set to 2nd, and then changed to 3rd due to a score change,
 * it should then only keep the 3rd placed badge."*
 *
 * 0167 decided the opposite and wrote down why: "one badge can stand for
 * several finishes, so a single correction cannot know whether any are left."
 * That reason was real and the conclusion was wrong. A correction cannot know,
 * but a RECOUNT can: ask whether the member still has any finish at that place
 * at that club, and award or take back on the answer. Somebody who came second
 * at two events and has one of them corrected keeps the badge, because the
 * other second is still there.
 *
 * So nothing here revokes "because a placing changed". It recomputes.
 */

-- --------------------------------------------------------- who took it back

/**
 * A revoke with nobody's name on it is the system's.
 *
 * 0121 pinned `(revoked_at is null) = (revoked_by is null)`, so every revoke
 * had to name a person. That was right while an owner was the only thing that
 * could revoke. It is the same shape `awarded_by` already uses for the other
 * direction: `award_podium_badge` has always written a null there to mean
 * "nobody chose this, a placing did".
 *
 * The pair still holds in the direction that matters: naming a revoker without
 * a revoke is nonsense and stays refused.
 */
alter table public.member_badges
  drop constraint if exists member_badges_revoke_pair;

alter table public.member_badges
  add constraint member_badges_revoke_pair
  check (revoked_by is null or revoked_at is not null);

-- ------------------------------------------------------------- the recount

/**
 * Every podium finish this member has at this club, at this place.
 *
 * The three sources 0167 and 0168 award from, read back the same way: an event
 * placing, a standing on a COMPLETED competition, and a team placing. The note
 * comes back with it so an award made here reads like one made on the spot.
 *
 * `security definer`, because it is read from triggers on three tables whose
 * policies have nothing to do with each other.
 */
create or replace function public.podium_finish_note(
  p_club bigint, p_profile uuid, p_place integer)
returns text language sql stable security definer set search_path = public as $$
  select note from (
    select coalesce(nullif(btrim(res.placement), ''), 'Placed') || ' at ' ||
           coalesce(nullif(btrim(e.title), ''), 'one of our events') || '.' as note
      from public.club_event_results res
      join public.club_events e on e.id = res.event_id
     where e.club_id = p_club and res.member_profile_id = p_profile
       and res.rank = p_place
    union all
    select 'Finished ' || s.rank || ' in ' ||
           coalesce(nullif(btrim(c.title), ''), 'a competition') || '.'
      from public.club_competition_standings s
      join public.club_competitions c on c.id = s.competition_id
     where c.club_id = p_club and s.profile_id = p_profile and s.rank = p_place
       and c.status = 'completed'
    union all
    select coalesce(nullif(btrim(t.placement), ''), 'Placed') || ' with ' ||
           btrim(t.name) || ' at ' ||
           coalesce(nullif(btrim(e.title), ''), 'one of our events') || '.'
      from public.club_event_teams t
      join public.club_event_team_players tp on tp.team_id = t.id
      join public.club_events e on e.id = t.event_id
     where e.club_id = p_club and tp.profile_id = p_profile
       and t.final_rank = p_place
  ) f limit 1;
$$;

/**
 * The three podium badges, brought into line with what this member has won.
 *
 * Awards what they have earned and is not holding, takes back what they are
 * holding and no longer have. Idempotent: calling it twice changes nothing the
 * second time, which is what lets the triggers below fire more than once in a
 * transaction without anybody being told twice.
 *
 * **It only ever takes back a badge the system gave.** `awarded_by is null`
 * marks those. An owner who hands somebody First place by hand, for a reason
 * the results table does not know about, keeps it: that is their decision and
 * not something a recount gets to overrule.
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
    else
      update public.member_badges
         set revoked_at = now(), revoked_by = null
       where badge_id = v_badge and profile_id = p_profile
         and revoked_at is null and awarded_by is null;
    end if;
  end loop;
end $$;

/**
 * Re-awardable after the system took it back, never after a person did.
 *
 * 0167 refused to award where ANY row existed, revoked or not, so that an
 * owner's revoke stuck. That now also blocks the correction this whole
 * migration is about: Joe moved 2nd to 3rd and back to 2nd would never get the
 * second badge again. The test is who took it off.
 */
create or replace function public.award_podium_badge(
  p_club bigint, p_profile uuid, p_place integer, p_note text default '')
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_badge bigint;
begin
  if p_profile is null or p_place is null or p_place not between 1 and 3 then
    return false;
  end if;

  select id into v_badge from public.club_badges
   where club_id = p_club and podium_rank = p_place and active;
  if v_badge is null then return false; end if;

  insert into public.member_badges (club_id, badge_id, profile_id, note, awarded_by)
  select p_club, v_badge, p_profile, left(coalesce(p_note, ''), 200), null
   where not exists (
     select 1 from public.member_badges held
      where held.badge_id = v_badge and held.profile_id = p_profile
        -- Holding it, or a person deliberately took it off.
        and (held.revoked_at is null or held.revoked_by is not null))
  on conflict do nothing;

  return found;
end $$;

-- ------------------------------------------------------------- the triggers

/**
 * Deferred to the end of the transaction, every one of them.
 *
 * `replaceStandings` deletes a competition's rows and inserts them again on
 * every save, so a row-level trigger firing as it goes sees "no finish" on the
 * delete and revokes, then sees the finish on the insert and awards it back:
 * two notifications and a new row, every save, for a table nobody changed.
 *
 * A constraint trigger deferred to commit still fires once per changed row,
 * but by then every statement has landed, so each call recounts the SAME final
 * state and the second one finds nothing to do. That is what makes the recount
 * safe to run as often as it likes.
 */
create or replace function public.event_placing_badge() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_club bigint;
begin
  -- Only a podium row is worth a recount, on either side of the change.
  if coalesce(new.rank, 0) not between 1 and 3
     and coalesce(old.rank, 0) not between 1 and 3 then
    return null;
  end if;

  select e.club_id into v_club from public.club_events e
   where e.id = coalesce(new.event_id, old.event_id);
  if v_club is null then return null; end if;

  -- Both sides: linking a placing to a different account has to put the one it
  -- left back in order as well.
  perform public.sync_podium_badges(v_club, new.member_profile_id);
  if old.member_profile_id is distinct from new.member_profile_id then
    perform public.sync_podium_badges(v_club, old.member_profile_id);
  end if;

  return null;
end $$;

drop trigger if exists club_event_results_badge on public.club_event_results;
create constraint trigger club_event_results_badge
  after insert or update or delete on public.club_event_results
  deferrable initially deferred
  for each row execute function public.event_placing_badge();

/** A standing, on a competition that is over. */
create or replace function public.standing_podium_badge() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_club bigint;
begin
  if coalesce(new.rank, 0) not between 1 and 3
     and coalesce(old.rank, 0) not between 1 and 3 then
    return null;
  end if;

  select c.club_id into v_club from public.club_competitions c
   where c.id = coalesce(new.competition_id, old.competition_id);
  if v_club is null then return null; end if;

  perform public.sync_podium_badges(v_club, new.profile_id);
  if old.profile_id is distinct from new.profile_id then
    perform public.sync_podium_badges(v_club, old.profile_id);
  end if;

  return null;
end $$;

drop trigger if exists club_competition_standings_badge on public.club_competition_standings;
create constraint trigger club_competition_standings_badge
  after insert or update or delete on public.club_competition_standings
  deferrable initially deferred
  for each row execute function public.standing_podium_badge();

/**
 * A competition finishing, or being reopened.
 *
 * Only a completed one counts (0167's rule, unchanged), so reopening one takes
 * its podium badges back: there is no final placing any more. Completing it
 * again hands them out again, because the system is what took them off.
 */
create or replace function public.competition_completed_badges() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if old.status is not distinct from new.status then return null; end if;
  if old.status <> 'completed' and new.status <> 'completed' then return null; end if;

  for r in select distinct profile_id from public.club_competition_standings
            where competition_id = new.id and profile_id is not null
              and rank between 1 and 3
  loop
    perform public.sync_podium_badges(new.club_id, r.profile_id);
  end loop;

  return null;
end $$;

drop trigger if exists club_competitions_podium_badge on public.club_competitions;
create constraint trigger club_competitions_podium_badge
  after update on public.club_competitions
  deferrable initially deferred
  for each row execute function public.competition_completed_badges();

/** A team's final place, and everybody who played for it. */
create or replace function public.team_placing_badges() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_club bigint; r record;
begin
  if coalesce(new.final_rank, 0) not between 1 and 3
     and coalesce(old.final_rank, 0) not between 1 and 3 then
    return null;
  end if;

  select e.club_id into v_club from public.club_events e
   where e.id = coalesce(new.event_id, old.event_id);
  if v_club is null then return null; end if;

  for r in select profile_id from public.club_event_team_players
            where team_id = coalesce(new.id, old.id) and profile_id is not null
  loop
    perform public.sync_podium_badges(v_club, r.profile_id);
  end loop;

  return null;
end $$;

drop trigger if exists club_event_teams_podium on public.club_event_teams;
create constraint trigger club_event_teams_podium
  after insert or update or delete on public.club_event_teams
  deferrable initially deferred
  for each row execute function public.team_placing_badges();

/**
 * Somebody joining or leaving a team after it was placed.
 *
 * 0168 awarded on the team's own placing and never looked at the players
 * again, so a player added to a placed team got nothing and one taken out of
 * it kept the badge. The recount answers both.
 */
create or replace function public.team_player_podium_badges() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_club bigint;
begin
  select e.club_id into v_club from public.club_events e
   where e.id = coalesce(new.event_id, old.event_id);
  if v_club is null then return null; end if;

  perform public.sync_podium_badges(v_club, new.profile_id);
  if old.profile_id is distinct from new.profile_id then
    perform public.sync_podium_badges(v_club, old.profile_id);
  end if;

  return null;
end $$;

drop trigger if exists club_event_team_players_podium on public.club_event_team_players;
create constraint trigger club_event_team_players_podium
  after insert or update or delete on public.club_event_team_players
  deferrable initially deferred
  for each row execute function public.team_player_podium_badges();

revoke all on function public.podium_finish_note(bigint, uuid, integer)
  from public, anon, authenticated;
revoke all on function public.sync_podium_badges(bigint, uuid)
  from public, anon, authenticated;
revoke all on function public.team_player_podium_badges()
  from public, anon, authenticated;
