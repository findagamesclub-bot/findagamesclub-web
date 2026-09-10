-- 0074 · Dropping the five-argument record_booking_result
--
-- 0030 created it, 0044 added the four match-context arguments, and Postgres
-- kept both because a different argument list is a different function rather
-- than a replacement. 0069 then rewrote the nine-argument one to let helpers
-- rule on a score, and left the old one behind still demanding a manager.
--
-- So the schema held two functions of the same name with two different
-- authorisation rules, both granted to authenticated. Nothing calls the short
-- one: the repository sends all nine. But a future caller passing five
-- arguments would silently get the stricter rule and a refusal nobody could
-- explain, which is exactly the shape of the bug that made "Match old results"
-- appear in a helper's console and then refuse on save.

drop function if exists public.record_booking_result(bigint, numeric, numeric, text, text);
