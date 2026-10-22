-- 0218 · an event's analytics are as public as its results
--
-- 0209 and 0210 replaced the event's own analytics panel and granted the two
-- new reads to `authenticated` only. The one they replaced, `meta_event`
-- (0142), has been granted to `anon` since stage 9, and 0209's own header says
-- the panel is "readable by anybody who can see the event, which for a
-- published event is anybody".
--
-- So a signed-out visitor on a published event got "permission denied for
-- function meta_event_breakdown", `getEventMeta` caught it, and the whole
-- panel drew nothing: an authenticated-only read from a page that has no
-- session, degrading into a plausible lie rather than an error. That is the
-- trap 0116 paid for once and the cron settings paid for again, and it was
-- invisible while testing because every run of it was signed in as an admin.
--
-- The grant is the whole fix. All three are `security definer` and all three
-- are the same read `meta_event` already exposes, scoped to one event id.
--
-- THREE, not the two the dev log named. `meta_event_matchups` is the same
-- panel and had the same grant, and it was found by auditing every function
-- the repositories call against what `anon` may execute rather than by
-- reading the error twice. A panel is one audience, so the sweep is what
-- proves it rather than the first failure to be logged.

begin;

grant execute on function public.meta_event_breakdown(bigint) to anon;
grant execute on function public.meta_event_players(bigint) to anon;
grant execute on function public.meta_event_matchups(bigint) to anon;

commit;
