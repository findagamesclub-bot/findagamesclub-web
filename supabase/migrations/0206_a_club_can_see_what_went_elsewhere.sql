/**
 * The club is told that a report exists, without being shown it.
 *
 * The client has now reported this three times, in the same words each time:
 * *"replies/comments on a board post are not going back to club owner"*. The
 * routing has been right every time, and the measurement is always the same:
 * the reply they reported was written by somebody on their own team, so
 * `club_may_judge` sent it to a site admin, which is 0128's whole point.
 *
 * Their evidence this round, read off the live data: four reports, two pairs.
 * The board POSTS they reported were written by Joe Matthews, a member, and
 * both reached the club. The board REPLIES were written by sara khan, who owns
 * the club, and both went to an admin. They are testing by replying to their
 * own threads as the owner, so every reply they report is the one case the
 * rule excludes.
 *
 * **Explaining it a fourth time is not a fix.** What is actually wrong is that
 * from the club's side the report is not merely unanswerable, it is invisible:
 * nothing on their screen says it arrived, so "it never came back to me" is a
 * reasonable thing to conclude. 0128 says the rule under the filter bar and
 * that is a general statement with nothing to attach it to.
 *
 * So the club gets a COUNT and never a row. No content, no reporter, no
 * author, no kind: just how many reports at this club a site admin is holding
 * because they are about a review or about something the team wrote. That is
 * enough to close "where did it go" and keeps everything 0128 was protecting,
 * which is the reporter's safety, not the number.
 */
create or replace function public.club_moderation_elsewhere(p_club bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_waiting int; v_answered int;
begin
  if not (public.club_can(p_club, 'board.moderate') or public.is_admin()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  -- The same `club_may_judge` the queue, the counts and the answer all call,
  -- negated. Writing the rule out a second time here is how this number ends
  -- up disagreeing with the list beside it.
  select count(*) filter (where f.status = 'open'),
         count(*) filter (where f.status <> 'open')
    into v_waiting, v_answered
    from public.moderation_flags f
   where f.club_id = p_club
     and not public.club_may_judge(p_club, f.target_type, f.target_id);

  return jsonb_build_object(
    'waiting', coalesce(v_waiting, 0),
    'answered', coalesce(v_answered, 0));
end $$;

revoke all on function public.club_moderation_elsewhere(bigint) from public, anon;
grant execute on function public.club_moderation_elsewhere(bigint) to authenticated;
