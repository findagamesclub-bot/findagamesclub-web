/**
 * The suspension that was already there.
 *
 * 0215 logs a take-down onto the listing's own history from the moment it
 * runs, which is right for everything that happens next and leaves the one
 * club the client was looking at reading "Nothing has been asked for yet"
 * over a listing a site admin had plainly taken down. Found by opening it:
 * the chips on the card were right and the timeline underneath was empty.
 *
 * `clubs` has carried the whole of it since 0188 and 0202, so this is a
 * transcription rather than a guess: when it was taken down, by whom, why,
 * and what the club said back.
 *
 * It is the end of the story and only the end, the same shape 0107's own
 * backfill records about itself. A club taken down twice before today writes
 * one row, because the column only ever kept the last one. That is the honest
 * limit and it is better than a blank panel: the alternative is a history
 * that says nothing happened above a banner saying something did.
 */

insert into public.club_submission_events (submission_id, kind, body, actor_id, created_at)
select s.id, 'suspended', coalesce(c.suspended_reason, ''), c.suspended_by,
       coalesce(c.suspended_at, now())
  from public.clubs c
  join lateral (
    select s2.id from public.club_submissions s2
     where s2.club_id = c.id and s2.status = 'approved'
     order by s2.id desc limit 1
  ) s on true
 where c.status = 'suspended'
   and not exists (
     select 1 from public.club_submission_events e
      where e.submission_id = s.id and e.kind = 'suspended'
   );

-- And whatever the club has already said about it, which 0202 stamped on the
-- row and nothing has ever read back. Only where it came after the
-- suspension, which it always does: the ask is cleared when a listing goes
-- back up, so one that is still there belongs to the take-down above it.
insert into public.club_submission_events (submission_id, kind, body, actor_id, created_at)
select s.id, 'review_asked', coalesce(c.review_asked_note, ''), c.owner_id,
       c.review_asked_at
  from public.clubs c
  join lateral (
    select s2.id from public.club_submissions s2
     where s2.club_id = c.id and s2.status = 'approved'
     order by s2.id desc limit 1
  ) s on true
 where c.status = 'suspended'
   and c.review_asked_at is not null
   and not exists (
     select 1 from public.club_submission_events e
      where e.submission_id = s.id and e.kind = 'review_asked'
   );
