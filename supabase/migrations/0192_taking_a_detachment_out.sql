-- 0192 · Taking a detachment out, and giving a faction its dispositions
--
-- Two items from the client, on the same screen.
--
-- 22a: "admin needs to have the option to delete detachments. As mentioned in
-- another point, any deletions like this should force the admin to create a
-- new version of the catalog, so it does not affect previous game results
-- under that version of the catalog and data is not lost."
--
-- 22b: "In the army builder, a detachment can be given multiple dispositions
-- which is correct. However, when adding a score and result for a game, you
-- can only see 1 disposition to select. This should show all disposition
-- options and allow you to select 1 from the list."
--
-- **22a is a capability with nothing on top of it, and the half the client
-- asks for is already enforced.** `delete_army_unit` has existed since 0133
-- and there has never been a `delete_army_detachment`, so a detachment typed
-- in by mistake could be renamed and never removed. Eleventh time this shape
-- has come up.
--
-- The "force a new version" half needs no new rule. `army_catalogue_writable`
-- refuses any write to a published version, and 0138's trigger refuses it
-- again at the table whatever the writer, so a delete is only possible on a
-- draft, and starting a draft is what mints a new `catalogue_version`. A
-- result pins `(edition_id, catalogue_version)` and so does an army list
-- version, so last April's game goes on reading the way it was played. What
-- this adds is the missing writer and the count that lets an admin see what
-- they are taking out before they take it out, which is the client's own
-- worry said in numbers on the screen where they have it.
--
-- **22b is not the picker.** Measured against the published snapshot the
-- result dialog actually reads, `warhammer-40k-11th / 11th-test-2026-07-27`:
-- 30 factions, 346 detachments, and every one of the 346 carries **exactly
-- one** disposition. `dispositionsFor` offers all of a detachment's, so it
-- offers one, correctly. The legacy file it was imported from is identical,
-- and legacy's own test pins it (`test_game_edition_foundation.py:297`,
-- `dispositions["Auric Champions"] == ["Priority Assets"]`).
--
-- So the thing to build is not a wider picker, it is a catalogue where a
-- detachment carries several. The editor could already do that and only one
-- dialog at a time, which is 346 of them. `add_faction_dispositions` is a
-- faction at a time: it adds and never removes, so a detachment keeps the one
-- it already names, and it folds on case so pressing it twice changes
-- nothing.
--
-- Checked on a throwaway Postgres built from every migration: a member is
-- refused both writers, an admin is allowed them on a draft and refused them
-- once the version is published, the usage count follows the detachment's
-- label rather than its id, and the bulk add neither duplicates nor removes.

-- ------------------------------------------------------------------ reads

/**
 * The dispositions this edition already uses, folded and sorted.
 *
 * 346 detachments, so one scalar rather than reading every one of them into
 * the browser to distinct it there. It seeds the bulk box, which is what makes
 * "give every detachment the five a rulebook names" one press rather than a
 * list somebody has to remember and retype per faction.
 *
 * `security invoker`: `army_detachments_select` is `using (true)` for anon and
 * authenticated already, so the rows say who may read them and a second guard
 * written by hand here would only be a second thing to get wrong.
 */
create or replace function public.army_edition_dispositions(p_edition text)
returns text[]
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(array_agg(s.d order by s.d), '{}'::text[])
    from (select distinct btrim(x) as d
            from public.army_detachments t,
                 lateral unnest(t.dispositions) as x
           where t.edition_id = p_edition
             and btrim(x) <> '') s;
$$;

/**
 * What names this detachment, before somebody deletes it.
 *
 * Counted on the LABEL rather than on the id, because that is what a recorded
 * game stores: `game_result_armies.detachment` is the catalogue's own spelling
 * written onto the row at the time (0135), and an army list version keeps the
 * same string inside `detachment_selections`. Neither carries a foreign key to
 * this table, deliberately, so nothing here cascades and nothing is lost by a
 * delete. The figures exist to say so out loud.
 *
 * Scoped to the edition. The same label under a different edition is a
 * different game's detachment and is nobody's business here.
 *
 * Admin only, and the guard is a raise in plpgsql rather than a `select` whose
 * result nothing reads: 0117 shipped a `stable` guard the planner was entitled
 * to drop, and dropped.
 */
create or replace function public.army_detachment_usage(
  p_edition text, p_detachment bigint
)
returns table (label text, results bigint, lists bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_label text;
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  select d.label into v_label
    from public.army_detachments d
   where d.id = p_detachment and d.edition_id = p_edition;

  if v_label is null then
    raise exception 'DETACHMENT_NOT_FOUND';
  end if;

  return query
  select v_label,
         (select count(*) from public.game_result_armies a
           where a.edition_id = p_edition
             and lower(btrim(a.detachment)) = lower(btrim(v_label))),
         (select count(*) from public.army_list_versions v
           where v.edition_id = p_edition
             and exists (
               select 1 from jsonb_array_elements(v.detachment_selections) one
                where lower(btrim(coalesce(one ->> 'detachment', '')))
                      = lower(btrim(v_label))));
end $$;

-- ----------------------------------------------------------------- writes

/**
 * Take a detachment off a draft.
 *
 * `delete_army_unit`'s shape, for the reason that one gives: the guard is
 * shared rather than retyped, so an admin and a draft are one question asked
 * in one place. The 0138 trigger refuses it a second time at the table, which
 * is what makes the freeze true for a hand-rolled delete as postgres as well
 * as for this.
 *
 * Nothing recorded is touched, and nothing can be: a result and an army list
 * version each keep the detachment's name as a string beside the catalogue
 * version they were written against, so there is no row for a cascade to
 * reach. `army_detachment_usage` is how the screen says that in figures
 * before the press.
 */
create or replace function public.delete_army_detachment(
  p_edition text, p_detachment bigint
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.army_catalogue_writable(p_edition);
  delete from public.army_detachments
   where id = p_detachment and edition_id = p_edition;
  return true;
end $$;

/**
 * Give every detachment in one faction the same dispositions.
 *
 * Additive, and that is the whole of it. A detachment that already names
 * "Take and Hold" keeps it and gains the rest, so this cannot quietly rewrite
 * a list an admin typed by hand, and running it twice is a no-op rather than a
 * doubling. Removing one is still the detachment's own dialog, because taking
 * something away from 24 detachments at once is a different act from offering
 * them one more and should not wear the same button.
 *
 * Folded on case for the comparison and stored in the spelling that was typed,
 * which is the rule `resolve_result_army` already matches by: a picker holding
 * "take and hold" against a catalogue holding "Take and Hold" is two
 * dispositions that never add up.
 *
 * Returns how many detachments actually changed, so the toast can say
 * "8 detachments" rather than "Saved" over a faction where nothing moved.
 */
create or replace function public.add_faction_dispositions(
  p_edition text, p_faction text, p_dispositions text[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
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
       and d.faction_id = lower(btrim(p_faction))
  )
  update public.army_detachments d
     set dispositions = add.next
    from add
   where d.id = add.id
     and cardinality(add.next) > cardinality(d.dispositions);

  get diagnostics v_touched = row_count;
  return v_touched;
end $$;

revoke all on function public.army_edition_dispositions(text) from public, anon;
revoke all on function public.army_detachment_usage(text, bigint) from public, anon;
revoke all on function public.delete_army_detachment(text, bigint) from public, anon;
revoke all on function public.add_faction_dispositions(text, text, text[])
  from public, anon;

grant execute on function public.army_edition_dispositions(text) to authenticated;
grant execute on function public.army_detachment_usage(text, bigint) to authenticated;
grant execute on function public.delete_army_detachment(text, bigint) to authenticated;
grant execute on function public.add_faction_dispositions(text, text, text[])
  to authenticated;
