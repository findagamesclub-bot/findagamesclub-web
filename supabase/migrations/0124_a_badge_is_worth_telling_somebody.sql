/**
 * 0124 · Telling somebody they have been given a badge
 *
 * A club handed one out and nothing said so. The member could find it on their
 * own profile if they thought to look, which is the same as nobody knowing: the
 * point of a badge is being told you have it.
 *
 * A trigger rather than a call inside `award_member_badge`, for the reason the
 * loyalty awards and the booking notices already give. Awarding happens from
 * the badge page today and will happen from a competition ending or an import
 * later, and a notice that fires on one path is worse than none.
 *
 * Nothing is sent when somebody awards themselves, which an owner doing the
 * rounds of their own club will do. And nothing is sent on a revoke: being told
 * a badge has been taken off you is unkind, the club may simply have picked the
 * wrong name, and legacy has no such message either. The row is kept, so the
 * club can still see what happened.
 */

create or replace function public.member_badge_told() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_label text; v_club text; v_slug text;
begin
  if new.profile_id is not distinct from (select auth.uid()) then
    return new;
  end if;

  select b.label into v_label from public.club_badges b where b.id = new.badge_id;
  select c.name, c.slug::text into v_club, v_slug
    from public.clubs c where c.id = new.club_id;

  perform public.notify_person(
    new.profile_id,
    'badge-awarded',
    coalesce(v_club, 'A club') || ' gave you a badge',
    -- The club's own words for why, when there are any. A badge with no note
    -- still says which badge and which club, which is the part that matters.
    coalesce(nullif(btrim(new.note), ''), 'You have been given ' || coalesce(v_label, 'a badge') || '.'),
    '/account/profile',
    'member_badge', new.id::text, coalesce(v_label, ''));

  return new;
end $$;

drop trigger if exists member_badge_told on public.member_badges;
create trigger member_badge_told after insert on public.member_badges
  for each row execute function public.member_badge_told();
