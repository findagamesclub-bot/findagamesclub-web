-- 0223 · a board report is the club's to answer, whoever wrote it
--
-- The client, item 14c: "ISSUE STILL PRESENT (STILL NOT FIXED) - we still have
-- an issue here. Board post replies are not going back to club owner when
-- reported ... We have failed to fix this multiple times now so please test
-- fully."
--
-- Read off the live data, their two reports of 5 Nov at Didcot:
--
--   "Lifts to the Reading event in October", a board POST by Joe Matthews,
--   a member            → reached the club's queue, as it always has.
--
--   "adding a reply to be reported :)", a board REPLY by sara khan,
--   who OWNS the club   → went to a site admin, by the rule in 0128.
--
-- So the routing has done exactly what it was built to do, for the fifth
-- time. 0206's answer was to show the club a count of what had gone
-- elsewhere, on the reasoning that the rule was right and only invisible.
--
-- THAT WAS THE WRONG CALL, and the client had already said so in item 14b:
--
--   "It states it goes to overall admin, however for board reports, I think
--    it should go to club owner, as will be hard to manage with lots of clubs
--    for admin. Admin should maybe still be able to see reported items but
--    isn't the only one that can deal with them."
--
-- That is a decision, with a reason, from the person whose product it is, and
-- it is the same shape as 0129: we argued for an anonymous reporter, the
-- client asked for the name twice having read the argument, and theirs is the
-- call. Explaining the rule a sixth time is not a fix.
--
-- WHAT CHANGES: board content is the club's to judge whoever wrote it, their
-- own team included. The admin keeps every one of these in their own queue and
-- can still overrule (0127), which is the half the client asked to keep.
--
-- WHAT DOES NOT: a REVIEW of the club still goes to a site admin. A club
-- deciding whether a bad review of itself stays up is the one conflict this
-- queue must not create, and the client has never asked for it. A reported
-- MESSAGE one of the team wrote also still goes to an admin: a message has no
-- other reader, so a club ruling on its own words there is checked by nobody,
-- and "board reports" is what was asked for.
--
-- `club_moderation_elsewhere`, `club_moderation_queue`, `club_moderation_counts`
-- and 0131's notify trigger all call this one function, so all five move
-- together and none of them needs touching. That is the whole reason it was
-- one function.
--
-- Checked on a throwaway Postgres built from every migration with
-- supabase/tests/stage13-a-board-report-is-the-clubs.sql.

begin;

create or replace function public.club_may_judge(
  p_club bigint, p_type text, p_target bigint
) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v_author uuid;
begin
  -- A review is about the club. A club deciding whether a bad review of itself
  -- stays up is the one conflict of interest this whole queue must not create.
  if p_type = 'review' then return false; end if;

  -- A board is the club's own room, so what is said in it is the club's to
  -- rule on, including when one of their team said it. A site admin still sees
  -- every one of these and can put back anything the club took down.
  if p_type in ('post', 'reply', 'event_post', 'event_reply') then
    return true;
  end if;

  v_author := public.flag_author(p_type, p_target);
  if v_author is null then return true; end if;

  -- What is left is a message, which only its two people ever see. Their own
  -- team's goes to the admin, including the owner's.
  return not exists (
    select 1 from public.club_team t
     where t.club_id = p_club and t.profile_id = v_author);
end $$;

commit;
