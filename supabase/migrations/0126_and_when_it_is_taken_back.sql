/**
 * 0126 · Telling somebody a badge has been taken back
 *
 * 0124 deliberately said nothing on a revoke, on the grounds that being told is
 * unkind and legacy has no such message. The client asked for it anyway, in
 * their own words: "when badge remove then he should notify too, assign badge
 * and remove badge in both cases must be notify". Their call, and the argument
 * for it is better than the one against: a badge quietly vanishing from your
 * profile is worse than being told, because the first thing you assume is that
 * the site lost it.
 *
 * A trigger on the update, for the reason 0124 gives about the insert. Revoking
 * happens from the badge page today and will happen from a competition being
 * corrected later, and a notice that fires on one path is worse than none.
 *
 * Its own kind, not a second `badge-awarded`. `notify_person` de-duplicates on
 * (profile_id, kind, entity_type, entity_id) while a notice is unread, and both
 * halves are about the same `member_badges` row, so one kind would mean the
 * revoke quietly rewrote the award notice in place and the member would never
 * see that anything had changed. Same trap 0104 hit.
 *
 * Silent when somebody takes one off themselves, the same as awarding.
 */

create or replace function public.member_badge_taken_back() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_label text; v_club text;
begin
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

  perform public.notify_person(
    new.profile_id,
    'badge-taken-back',
    coalesce(v_club, 'A club') || ' took a badge back',
    -- Says which badge and gives somewhere to go with it, because the first
    -- thing anybody wants to know is whether it was meant.
    coalesce(v_label, 'A badge') || ' has come off your profile. '
      || 'Ask the club if that looks wrong.',
    '/account/profile',
    'member_badge', new.id::text, coalesce(v_label, ''));

  return new;
end $$;

drop trigger if exists member_badge_taken_back on public.member_badges;
create trigger member_badge_taken_back after update on public.member_badges
  for each row execute function public.member_badge_taken_back();
