/**
 * The podium badges that were already wrong, put right once.
 *
 * 0174 makes a badge follow its placing from now on, and only recounts when
 * something touches a placing. Everything corrected before it existed is still
 * sitting there: Didcot had a member holding both Second place and Third place
 * from the same event, because a placing was changed while 0167's rule was
 * "nothing is taken back automatically". The client's sentence is about those
 * too, so this recounts every podium holder once.
 */

-- ------------------------------------------------------- the quiet half

/**
 * A revoke can be quiet, which until now only an award could be.
 *
 * 0162 gave `member_badge_told` the switch for its tenure backfill and did not
 * give `member_badge_taken_back` the same, because a backfill only ever
 * inserted. A recount takes badges back as well, and telling forty members
 * that a badge went because of a sweep nobody asked for is the noise the
 * switch exists to stop. The sweep below is the first thing that needs it;
 * everyday corrections still tell the member, which is 0126's rule and the
 * client's own "notify both ways".
 */
create or replace function public.member_badge_taken_back() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_label text; v_club text;
begin
  if coalesce(current_setting('app.badge_notify_quiet', true), '') = 'on' then
    return new;
  end if;

  -- Only the moment it goes. An update that touches anything else, or a second
  -- revoke of an already revoked row, says nothing.
  if old.revoked_at is not null or new.revoked_at is null then
    return new;
  end if;

  if new.profile_id is not distinct from (select auth.uid()) then
    return new;
  end if;

  select b.label into v_label from public.club_badges b where b.id = new.badge_id;
  select c.name into v_club from public.clubs c where c.id = new.club_id;

  -- Copied from 0126 unchanged, so the words a member reads do not move just
  -- because the switch above was added.
  perform public.notify_person(
    new.profile_id,
    'badge-taken-back',
    coalesce(v_club, 'A club') || ' took a badge back',
    coalesce(v_label, 'A badge') || ' has come off your profile. '
      || 'Ask the club if that looks wrong.',
    '/account/profile',
    'member_badge', new.id::text, coalesce(v_label, ''));

  return new;
end $$;

-- ---------------------------------------------------------- the sweep

/**
 * Every podium holder, and everybody with a podium finish, recounted once.
 *
 * Both halves of that are needed. The holders catch a badge that should go;
 * the finishes catch one that should have arrived and did not, which is the
 * same gap 0168 left when a player was added to a team that had already been
 * placed.
 *
 * Quiet, because nothing happened to these members today: the data was already
 * like this and this is the site catching up with itself.
 */
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
         -- Only the ones the system gave. An owner's own award is theirs.
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
  raise notice 'podium badges recounted for % club and member pairs', v_pairs;
end $$;
