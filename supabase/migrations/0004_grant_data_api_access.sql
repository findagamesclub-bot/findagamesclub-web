-- 0004 · Data API grants
--
-- RLS decides which ROWS a role may see. It does not grant access to the table
-- in the first place. Tables created through SQL are not automatically exposed
-- to the Data API, so without these grants every policy returns nothing and the
-- directory renders empty. This was caught by testing with the anon key rather
-- than by reading the policies.

grant select on public.clubs to anon, authenticated;
grant select on public.profiles to authenticated;
