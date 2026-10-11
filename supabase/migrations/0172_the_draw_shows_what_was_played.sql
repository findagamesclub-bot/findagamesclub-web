/**
 * The armies on a draw, readable by whoever may read the draw.
 *
 * 0163 gave a table of the draw an army and 0135 had already decided who may
 * read one: `authenticated` only, and for a pairing only the player, the
 * club's own members and its team. The tables themselves are anon-readable on
 * a published round (0091), and a podium's army has been public all along,
 * because a placing keeps its own copy in `club_event_results.army` rather
 * than reading this table.
 *
 * So the draw and the armies on it disagreed about their audience. A visitor
 * reading a published round saw the tables and no armies, which is exactly
 * what a tournament nobody filled the armies in on looks like: the
 * authenticated-only read degrading into a plausible lie rather than an
 * error, which is the trap 0116 already paid for once.
 *
 * This says the same thing the matches policy says, in the same words: a
 * published round is public. The ticket gate on an unpublished draw stays in
 * `eventDetail.service`, where 0163 and 0168 put it, because the policy knows
 * whether a round is on show and not whether the reader holds a ticket.
 */

-- Two policies, because `is_club_member` and `can_manage_club` are revoked
-- from anon: naming either in a policy anon is subject to fails every
-- signed-out visitor with "permission denied for function" rather than simply
-- hiding the row. Same split 0090 and 0091 made, for the same reason.
grant select on public.game_result_armies to anon;

create or replace function public.pairing_army_is_public(p_source bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.club_event_pairing_matches m
      join public.club_event_pairings p on p.id = m.pairing_id
     where m.id = p_source and p.published);
$$;

grant execute on function public.pairing_army_is_public(bigint) to anon, authenticated;

drop policy if exists game_result_armies_public_anon on public.game_result_armies;

create policy game_result_armies_public_anon on public.game_result_armies
  for select to anon
  using (
    source_type in ('event_podium', 'competition')
    or (source_type = 'event_pairing'
        and public.pairing_army_is_public(source_id)));

-- The signed-in half gains the same clause and keeps everything it had: a
-- club's own team still reads an unpublished round's armies, which is what
-- draws the console's own dialog.
drop policy if exists game_result_armies_select on public.game_result_armies;

create policy game_result_armies_select on public.game_result_armies
  for select to authenticated
  using (
    source_type in ('event_podium', 'competition')
    or profile_id = (select auth.uid())
    or (source_type = 'event_pairing'
        and public.pairing_army_is_public(source_id))
    or (club_id is not null
        and (public.is_club_member(club_id) or public.can_manage_club(club_id)))
  );

-- The grant above is a select, and Supabase hands out nothing else on an
-- existing table, so there is no whole-table write to revoke here. Asserted
-- rather than assumed, because 0149 found REFERENCES, TRIGGER and TRUNCATE
-- riding along with one.
do $$
declare v_bad text;
begin
  select string_agg(privilege_type, ', ') into v_bad
    from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'game_result_armies'
     and grantee = 'anon' and privilege_type <> 'SELECT';
  if v_bad is not null then
    raise exception 'anon holds % on game_result_armies', v_bad;
  end if;
end $$;
