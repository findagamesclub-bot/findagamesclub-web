-- 0193 · The same dispositions across a whole edition
--
-- 0192 gave the admin a faction at a time, which is the right unit for a
-- catalogue where dispositions differ between factions. The one in front of us
-- is not that catalogue: the five it names ("Take and Hold", "Purge the Foe",
-- "Priority Assets", "Reconnaissance", "Disruption") are the game's own
-- primary missions, and any army can play any of them. So the real answer to
-- the client's 22b is the whole edition at once, and a faction at a time is
-- thirty pages, thirty presses, and one faction quietly missed.
--
-- One missed faction is not a small thing here. It reads as exactly the bug
-- that was reported: a player of that faction opens a result and is offered
-- one disposition, and nobody can tell from the screen that twenty-nine other
-- factions are fine.
--
-- No new signature, so no drop: the arguments and the return type are 0192's
-- and only the body moves. A blank faction now means every detachment in the
-- edition. Blank rather than null, because a form posts "" for a field nobody
-- filled in and a caller that means "all of them" should not have to know
-- which of the two the layer underneath prefers.
--
-- Everything else 0192 settled still holds and is still asserted: it is an
-- admin on a draft, it adds and never removes, it folds on case, and it
-- returns how many detachments actually changed.

create or replace function public.add_faction_dispositions(
  p_edition text, p_faction text, p_dispositions text[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_faction text := lower(btrim(coalesce(p_faction, '')));
  v_wanted text[];
  v_touched integer := 0;
begin
  perform public.army_catalogue_writable(p_edition);

  -- Blank lines drop out rather than becoming a disposition called nothing,
  -- the same way the detachment dialog's own box reads.
  select coalesce(array_agg(distinct btrim(x)), '{}'::text[]) into v_wanted
    from unnest(coalesce(p_dispositions, '{}'::text[])) as x
   where btrim(x) <> '';

  if array_length(v_wanted, 1) is null then
    raise exception 'DISPOSITIONS_NEEDED';
  end if;

  with add as (
    select d.id,
           d.dispositions || coalesce((
             select array_agg(w order by w)
               from unnest(v_wanted) as w
              where not exists (
                select 1 from unnest(d.dispositions) as held
                 where lower(btrim(held)) = lower(w))), '{}'::text[]) as next
      from public.army_detachments d
     where d.edition_id = p_edition
       -- A blank faction is every faction. Narrowing on an empty string
       -- instead would match nothing and report "0 detachments updated",
       -- which looks like a quiet success and is the worst of the three
       -- possible answers.
       and (v_faction = '' or d.faction_id = v_faction)
  )
  update public.army_detachments d
     set dispositions = add.next
    from add
   where d.id = add.id
     and cardinality(add.next) > cardinality(d.dispositions);

  get diagnostics v_touched = row_count;
  return v_touched;
end $$;
