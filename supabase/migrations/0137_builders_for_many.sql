-- 0137 · Which of these clubs run the army builder
--
-- `/account/games` is one member's games across every club they play at, so it
-- needs the answer for a handful of clubs at once. `army_builder_for` answers
-- for one, and asking it per club is one round trip per club on a page that
-- already reads in two waves.
--
-- It is a function rather than two selects resolved in TypeScript because the
-- fallback rule -- a club with no row runs whichever edition is active -- is
-- one rule, and a second copy of it in the browser layer would drift the first
-- time either moved. Same reasoning as `event_tickets_taken_many`.
--
-- Checked on a throwaway Postgres built from every migration: a club with a
-- row and a club without both come back, a club that is off comes back off
-- rather than missing, and the edition and version always belong to each other.

create or replace function public.army_builders_for(p_clubs bigint[])
returns table (club_id bigint, enabled boolean, edition_id text,
               catalogue_version text)
language sql stable security definer set search_path = public as $$
  select c.id,
         coalesce(s.enabled, false),
         ed.id,
         ed.catalogue_version
    from unnest(coalesce(p_clubs, '{}'::bigint[])) as c(id)
    left join public.club_army_builder_settings s on s.club_id = c.id
    left join public.army_editions ed
      on ed.id = coalesce(s.edition_id,
                          (select id from public.army_editions
                            where status = 'active' limit 1))
$$;

revoke all on function public.army_builders_for(bigint[]) from public, anon;
grant execute on function public.army_builders_for(bigint[]) to authenticated;
