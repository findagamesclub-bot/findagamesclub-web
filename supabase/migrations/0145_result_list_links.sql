-- 0145 · Linking a saved list to a result
--
-- The client's words: "Army faction, list and disposition shown against an
-- event placing" and "against club competitions and leagues". Stage 8 gave a
-- result its faction, detachment and disposition. This gives it the list.
--
-- A result points at a VERSION, not at a list, and carries a frozen copy of
-- its units. Both matter: the list moves on and last April's game must not
-- move with it, and a list can be deleted while the game it was played in
-- cannot. The copy is what makes "what did she bring" answerable after either.
--
-- Checked on a throwaway Postgres built from every migration: a member can
-- link only their own list, only to their own side, only at the club the list
-- belongs to; the units are frozen at the moment of linking and do not follow
-- later edits; and deleting the list leaves the result readable.

alter table public.game_result_armies
  add column list_id bigint references public.army_lists (id) on delete set null,
  add column list_version_id bigint
      references public.army_list_versions (id) on delete set null,
  add column list_name text not null default '',
  add column list_version_number int;

-- What the tracker's list leaderboard groups on. Partial, like the two 0141
-- added, because most rows carry no list at all.
create index game_result_armies_list_idx
  on public.game_result_armies (list_version_id, played_on desc)
  where confirmed and list_version_id is not null;

/**
 * Attach one of your own lists to one side of a result.
 *
 * Its own function rather than another argument on `put_result_army`, because
 * the questions are different: that one is the club recording what happened,
 * this is a member saying which of their lists it was. The club may overrule a
 * score; it may not put words in somebody's mouth about what they brought.
 *
 * `p_list` null unlinks, which is how somebody corrects a mis-tap.
 */
create or replace function public.link_result_army_list(
  p_source text, p_source_id bigint, p_side text, p_list bigint
) returns void language plpgsql volatile security definer set search_path = public as $$
declare
  v_row public.game_result_armies%rowtype;
  v_list public.army_lists%rowtype;
  v_version public.army_list_versions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'ARMY_SIGN_IN' using errcode = 'insufficient_privilege';
  end if;

  select * into v_row from public.game_result_armies
   where source_type = p_source and source_id = p_source_id and side = p_side;
  if v_row.id is null then raise exception 'RESULT_NOT_FOUND'; end if;

  -- Only against your own side. A club recording a night should not be able to
  -- say which list somebody else brought.
  if v_row.profile_id is null or v_row.profile_id <> auth.uid() then
    raise exception 'ARMY_NOT_YOURS' using errcode = 'insufficient_privilege';
  end if;

  if p_list is null then
    update public.game_result_armies
       set list_id = null, list_version_id = null, list_name = '',
           list_version_number = null, snapshot = '{}'::jsonb
     where id = v_row.id;
    return;
  end if;

  select * into v_list from public.army_lists
   where id = p_list and deleted_at is null;
  if v_list.id is null then raise exception 'ARMY_LIST_NOT_FOUND'; end if;
  if v_list.profile_id <> auth.uid() then
    raise exception 'ARMY_NOT_YOURS' using errcode = 'insufficient_privilege';
  end if;
  -- A list belongs to the club it was priced at, and so does the game.
  if v_row.club_id is null or v_list.club_id <> v_row.club_id then
    raise exception 'ARMY_WRONG_CLUB';
  end if;

  select * into v_version from public.army_list_versions
   where id = v_list.current_version_id;
  if v_version.id is null then raise exception 'ARMY_LIST_NOT_FOUND'; end if;

  update public.game_result_armies
     set list_id = v_list.id,
         list_version_id = v_version.id,
         list_name = left(v_list.name, 200),
         list_version_number = v_version.version_number,
         -- Frozen here, so a later edit to the list does not rewrite history.
         snapshot = jsonb_build_object(
           'units', v_version.units,
           'detachments', v_version.detachment_selections,
           'totalPoints', v_version.total_points,
           'catalogueVersion', v_version.catalogue_version)
   where id = v_row.id;
end $$;

/**
 * Which lists are winning, for the tracker.
 *
 * A version rather than a list: "Custodes League List" that went 2 and 8 in
 * March and 8 and 2 in May after a rewrite is two answers, and averaging them
 * is the one answer that is wrong. Same measures and the same early-signal
 * threshold as every other rollup, so a section cannot quietly disagree with
 * the one above it.
 */
create or replace function public.meta_lists(
  p_club bigint default null, p_from date default null, p_to date default null
) returns table (
  list_version_id bigint, list_name text, version_number int,
  faction_id text, faction_label text,
  appearances bigint, games bigint, wins bigint,
  win_rate numeric, average_vp numeric, early_signal boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.meta_scope_allowed(p_club);

  return query
  select r.list_version_id,
         max(r.list_name),
         max(r.list_version_number),
         r.faction_id,
         max(r.faction_label),
         count(*),
         count(*) filter (where r.outcome <> ''),
         count(*) filter (where r.outcome = 'won'),
         case when count(*) filter (where r.outcome <> '') = 0 then 0
              else round(100.0 * count(*) filter (where r.outcome = 'won')
                         / count(*) filter (where r.outcome <> ''), 1) end,
         round(avg(r.total_vp) filter (where r.total_vp is not null), 1),
         count(*) filter (where r.outcome <> '') < 2
    from public.meta_rows(p_club, p_from, p_to) r
   where r.list_version_id is not null
   group by r.list_version_id, r.faction_id
   order by 9 desc, 7 desc, 2;
end $$;

revoke all on function public.link_result_army_list(text, bigint, text, bigint)
  from public, anon;
revoke all on function public.meta_lists(bigint, date, date) from public, anon;
grant execute on function public.link_result_army_list(text, bigint, text, bigint)
  to authenticated;
grant execute on function public.meta_lists(bigint, date, date) to authenticated;

-- The activity feed is NOT touched here, and DEFERRED.md says so. It is one
-- 363-line union in 0063, and adding "army list details were added" means
-- replacing the whole function to gain one line in a list. The feed already
-- announces the result itself; the army arriving a minute later is a smaller
-- moment than the cost of that replace. Worth doing the next time 0063 has to
-- be rewritten for another reason.
