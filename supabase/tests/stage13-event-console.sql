-- 0163 and 0164 · the draw's audience, editing a notice, the club naming a
-- list, and a removed placing taking its army with it.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

-- Read as postgres. An ordinary session cannot tell a row a policy is hiding
-- from a row that is not there, which this suite has got wrong three times.
create or replace function pg_temp.army_of(p_source text, p_id bigint, p_side text)
returns public.game_result_armies language sql security definer as $fn$
  select * from public.game_result_armies
   where source_type = p_source and source_id = p_id and side = p_side $fn$;

create or replace function pg_temp.placing_army(p_id bigint)
returns jsonb language sql security definer as $fn$
  select coalesce(army, '{}'::jsonb) from public.club_event_results where id = p_id $fn$;

create or replace function pg_temp.notice_text(p_id bigint)
returns text language sql security definer as $fn$
  select message from public.club_event_notices where id = p_id $fn$;

insert into public.club_membership_tiers (club_id, tier_key, label, benefits, is_basic)
  select id, 'basic', 'Basic Membership', '{"armyBuilderAccess": true}'::jsonb, true from c;

-- A second club, so "a list from somewhere else" is a real case rather than a
-- hypothetical one.
insert into public.clubs (slug, name, city, status, owner_id, tables_available)
values ('other-army-club', 'Other Army Club', 'Reading', 'active',
        'e0000000-0000-0000-0000-000000000001', 4);
create temp table c2 as select id from public.clubs where slug = 'other-army-club';
grant select on c2 to authenticated;
insert into public.club_memberships (club_id, profile_id, status, tier_key, joined_at, created_at)
  select id, 'e0000000-0000-0000-0000-000000000003', 'approved', 'basic', now(), now() from c2;
insert into public.club_membership_tiers (club_id, tier_key, label, benefits, is_basic)
  select id, 'basic', 'Basic Membership', '{"armyBuilderAccess": true}'::jsonb, true from c2;

set local role authenticated;

do $$
declare
  w record; v_club bigint; v_club2 bigint;
  v_event bigint; v_placing bigint; v_pairing bigint; v_match bigint;
  v_notice bigint; v_list bigint; v_other_list bigint; v_owner_list bigint;
  v_out jsonb; v_draft jsonb; v_row public.game_result_armies; v_army jsonb;
  v_bad boolean; v_n integer;
begin
  select * into w from who;
  select id into v_club from c;
  select id into v_club2 from c2;

  -- ------------------------------------------------------------- catalogue
  perform pg_temp.be(w.admin);
  perform public.save_army_edition('warhammer-40k', 'Warhammer 40,000',
    array['2000'], 'warhammer-40k-11th', '11th', 'v1');
  perform public.save_army_faction('warhammer-40k-11th', 'adeptus-custodes',
    'Adeptus Custodes', 0);
  perform public.save_army_detachment('warhammer-40k-11th', 'adeptus-custodes',
    'shield-host', 'Shield Host', array['Auric Champions', 'Lions of the Emperor'], 0);
  perform public.save_army_unit('warhammer-40k-11th', 'adeptus-custodes',
    'Castigator', 165,
    '[{"label":"Default","modelCount":1,"points":"165"}]'::jsonb, '[]'::jsonb, 0);
  perform public.publish_army_catalogue('warhammer-40k-11th', '');

  perform pg_temp.be(w.owner);
  perform public.save_army_builder_settings(v_club, true, 'warhammer-40k-11th');
  perform public.save_army_builder_settings(v_club2, true, 'warhammer-40k-11th');

  -- ---------------------------------------------------------- an event
  v_event := public.create_club_event(v_club, 'Autumn Open', current_date - 7);
  update public.club_events set status = 'published', round_count = 3
   where id = v_event;

  -- 1 · The draw is for the people coming until the club says otherwise.
  if public.event_draw_public(v_event) then
    raise exception 'FAIL 1: a new event opened its draw to the street';
  end if;
  if public.event_has_draw(v_event) then
    raise exception 'FAIL 2: an event with no rounds says it has a draw';
  end if;

  update public.club_events set draw_public = true where id = v_event;
  if not public.event_draw_public(v_event) then
    raise exception 'FAIL 3: the club turned the draw on and it did not take';
  end if;

  -- An event nobody has heard of answers false rather than nothing, so a
  -- caller cannot tell a missing event from a closed draw.
  if public.event_draw_public(0) then
    raise exception 'FAIL 4: an event that does not exist opened its draw';
  end if;

  -- 2 · A stranger cannot flip it.
  perform pg_temp.be(w.stranger);
  begin
    update public.club_events set draw_public = false where id = v_event;
    v_bad := found;
  exception when insufficient_privilege or others then v_bad := false;
  end;
  if v_bad then raise exception 'FAIL 5: a stranger opened somebody''s draw'; end if;

  -- ------------------------------------------------- 11a · editing a notice
  perform pg_temp.be(w.owner);
  insert into public.club_event_notices (event_id, message)
  values (v_event, 'Doors at nine.') returning id into v_notice;

  update public.club_event_notices set message = 'Doors at half eight.'
   where id = v_notice;
  if pg_temp.notice_text(v_notice) <> 'Doors at half eight.' then
    raise exception 'FAIL 6: the club could not correct its own notice';
  end if;

  perform pg_temp.be(w.stranger);
  update public.club_event_notices set message = 'Cancelled, go home.'
   where id = v_notice;
  if pg_temp.notice_text(v_notice) <> 'Doors at half eight.' then
    raise exception 'FAIL 7: a stranger rewrote a club''s notice';
  end if;

  -- ------------------------------------------------------------ the lists
  perform pg_temp.be(w.member);
  v_draft := jsonb_build_object(
    'name', 'League list', 'listType', 'army-list', 'pointsLimit', '2000',
    'factionId', 'adeptus-custodes',
    'detachments', '[{"detachment":"Shield Host","disposition":"Auric Champions"}]'::jsonb,
    'units', '[{"unitName":"Castigator","optionLabel":"Default","quantity":2}]'::jsonb);
  v_out := public.save_army_list(null, v_club, v_draft, '');
  v_list := (v_out ->> 'listId')::bigint;

  -- The same member's list at the other club, which must not be offerable here.
  v_out := public.save_army_list(null, v_club2, v_draft, '');
  v_other_list := (v_out ->> 'listId')::bigint;

  perform pg_temp.be(w.owner);
  v_out := public.save_army_list(null, v_club, v_draft || '{"name":"Owner list"}'::jsonb, '');
  v_owner_list := (v_out ->> 'listId')::bigint;

  -- ------------------------------------------- 10a · a list against a podium
  perform pg_temp.be(w.owner);
  v_placing := public.save_event_placing(v_event, null, 1, 'Member Eight',
    w.member, 'Adeptus Custodes', 'Shield Host', 'Auric Champions');

  perform public.club_set_result_list('event_podium', v_placing, 'one', v_list);

  v_row := pg_temp.army_of('event_podium', v_placing, 'one');
  if v_row.list_id is distinct from v_list then
    raise exception 'FAIL 8: the list did not reach the result row';
  end if;
  if v_row.list_name <> 'League list' then
    raise exception 'FAIL 9: the list name did not travel, got %', v_row.list_name;
  end if;
  if jsonb_array_length(coalesce(v_row.snapshot -> 'units', '[]'::jsonb)) <> 1 then
    raise exception 'FAIL 10: the frozen units did not travel';
  end if;

  -- And into the jsonb the event page has read since Milestone 2.
  v_army := pg_temp.placing_army(v_placing);
  if v_army ->> 'armyListName' <> 'League list' then
    raise exception 'FAIL 11: the podium card has no list name to draw';
  end if;
  if (v_army -> 'armyListVersionSnapshot' -> 'units' -> 0 ->> 'unitName') <> 'Castigator' then
    raise exception 'FAIL 12: the podium snapshot is the wrong shape: %',
      v_army -> 'armyListVersionSnapshot';
  end if;
  if (v_army -> 'armyListVersionSnapshot' ->> 'totalPoints')::int <> 330 then
    raise exception 'FAIL 13: the snapshot lost its points, got %',
      v_army -> 'armyListVersionSnapshot' ->> 'totalPoints';
  end if;

  -- 3 · Whose list, not just which. The club says which of THEIR lists.
  begin
    perform public.club_set_result_list('event_podium', v_placing, 'one', v_owner_list);
    v_bad := true;
  exception when others then v_bad := position('ARMY_NOT_THEIRS' in sqlerrm) = 0;
  end;
  if v_bad then raise exception 'FAIL 14: somebody else''s list went onto a placing'; end if;

  begin
    perform public.club_set_result_list('event_podium', v_placing, 'one', v_other_list);
    v_bad := true;
  exception when others then v_bad := position('ARMY_WRONG_CLUB' in sqlerrm) = 0;
  end;
  if v_bad then raise exception 'FAIL 15: a list from another club went on'; end if;

  -- 4 · A club night is still the member's own business.
  begin
    perform public.club_set_result_list('booking', (select id from bk), 'one', v_list);
    v_bad := true;
  exception when others then v_bad := position('RESULT_NOT_FOUND' in sqlerrm) = 0;
  end;
  if v_bad then raise exception 'FAIL 16: a booking was reachable from the club''s door'; end if;

  -- 5 · A stranger cannot, and neither can an ordinary member of the club.
  perform pg_temp.be(w.stranger);
  begin
    perform public.club_set_result_list('event_podium', v_placing, 'one', v_list);
    v_bad := true;
  exception when others then v_bad := position('NOT_PERMITTED' in sqlerrm) = 0;
  end;
  if v_bad then raise exception 'FAIL 17: a stranger named a list on a podium'; end if;

  perform pg_temp.be(w.member);
  begin
    perform public.club_set_result_list('event_podium', v_placing, 'one', v_list);
    v_bad := true;
  exception when others then v_bad := position('NOT_PERMITTED' in sqlerrm) = 0;
  end;
  if v_bad then raise exception 'FAIL 18: a member reached the club''s own writer'; end if;

  -- 6 · Taking it off empties both halves.
  perform pg_temp.be(w.owner);
  perform public.club_set_result_list('event_podium', v_placing, 'one', null);
  v_row := pg_temp.army_of('event_podium', v_placing, 'one');
  if v_row.list_id is not null or v_row.list_name <> '' then
    raise exception 'FAIL 19: the list stayed on the result row';
  end if;
  if pg_temp.placing_army(v_placing) ? 'armyListVersionSnapshot' then
    raise exception 'FAIL 20: the podium card still has a list to draw';
  end if;

  -- 7 · The faction the club recorded survives all of that.
  v_army := pg_temp.placing_army(v_placing);
  if v_army ->> 'factionLabel' <> 'Adeptus Custodes' then
    raise exception 'FAIL 21: clearing the list took the faction with it';
  end if;

  -- 7a · 0164. Removing the placing takes its army with it, or a club fixing a
  -- typo leaves a phantom army in the site-wide tracker for ever.
  v_row := pg_temp.army_of('event_podium', v_placing, 'one');
  if v_row.id is null then
    raise exception 'FAIL 21a: the placing had no army row to lose';
  end if;
  perform public.delete_event_placing(v_event, v_placing);
  v_row := pg_temp.army_of('event_podium', v_placing, 'one');
  if v_row.id is not null then
    raise exception 'FAIL 21b: a removed placing left its army behind';
  end if;

  -- And a placing that never had one is not an error.
  v_placing := public.save_event_placing(v_event, null, 9, 'Nobody In Particular',
    null, '', '', '');
  perform public.delete_event_placing(v_event, v_placing);

  raise notice 'sections 1 to 7 pass';
end $$;

-- ------------------------------------------- 9a · armies on a table of a draw
do $$
declare
  w record; v_club bigint; v_event bigint; v_pairing bigint; v_match bigint;
  v_row public.game_result_armies; v_n integer; v_bad boolean;
  v_label text; v_faction text;
begin
  select * into w from who;
  select id into v_club from c;
  select id into v_event from public.club_events order by id desc limit 1;

  perform pg_temp.be(w.owner);
  insert into public.club_event_pairings (event_id, round, label, published)
  values (v_event, 1, 'Round 1', false) returning id into v_pairing;
  insert into public.club_event_pairing_matches
    (pairing_id, event_id, table_label, player_one, player_one_id,
     player_two, player_two_id, score_one, score_two, position)
  values (v_pairing, v_event, '1', 'Member Eight', w.member,
          'Owner Eight', w.owner, 80, 60, 0)
  returning id into v_match;

  -- 8 · An unpublished round is nobody's, whatever the event's switch says.
  if public.event_has_draw(v_event) then
    raise exception 'FAIL 22: an unpublished round counts as a draw';
  end if;
  update public.club_event_pairings set published = true where id = v_pairing;
  if not public.event_has_draw(v_event) then
    raise exception 'FAIL 23: a published round does not count as a draw';
  end if;

  -- 9 · Both sides of a table, through the writer 0136 built and nothing
  -- called.
  perform public.save_pairing_armies(v_match, jsonb_build_object(
    'one', jsonb_build_object('factionId', 'adeptus-custodes',
                              'detachment', 'Shield Host',
                              'disposition', 'Auric Champions',
                              'primaryScore', '45', 'secondaryScore', '30',
                              'painted', true),
    'two', jsonb_build_object('factionId', 'Adeptus Custodes',
                              'detachment', 'Shield Host',
                              'disposition', 'Lions of the Emperor')));

  v_row := pg_temp.army_of('event_pairing', v_match, 'one');
  if v_row.id is null then raise exception 'FAIL 24: side one was not recorded'; end if;
  if v_row.total_vp is distinct from 85 then
    raise exception 'FAIL 25: 45 + 30 + painted should be 85, got %', v_row.total_vp;
  end if;
  if v_row.profile_id is distinct from w.member then
    raise exception 'FAIL 26: the table''s own player did not come across';
  end if;

  -- A faction typed rather than keyed still lands as the catalogue spells it,
  -- which is what stops two spellings reading as two factions.
  v_row := pg_temp.army_of('event_pairing', v_match, 'two');
  if v_row.faction_label <> 'Adeptus Custodes' then
    raise exception 'FAIL 27: the catalogue spelling did not win, got %', v_row.faction_label;
  end if;

  -- The outcome 0141 only ever wired for a booking. Armies typed after the
  -- scores: 80 to 60 is a win for side one.
  v_row := pg_temp.army_of('event_pairing', v_match, 'one');
  if v_row.outcome <> 'won' then
    raise exception 'FAIL 27a: a table scored 80 to 60 did not read as a win, got "%"',
      v_row.outcome;
  end if;
  v_row := pg_temp.army_of('event_pairing', v_match, 'two');
  if v_row.outcome <> 'lost' then
    raise exception 'FAIL 27b: the other side of a win is not a loss';
  end if;

  -- And the other order: a score corrected after the armies were typed.
  update public.club_event_pairing_matches set score_one = 50, score_two = 90
   where id = v_match;
  v_row := pg_temp.army_of('event_pairing', v_match, 'one');
  if v_row.outcome <> 'lost' then
    raise exception 'FAIL 27c: correcting the score did not move the outcome';
  end if;

  update public.club_event_pairing_matches set score_one = 70, score_two = 70
   where id = v_match;
  v_row := pg_temp.army_of('event_pairing', v_match, 'one');
  if v_row.outcome <> 'drew' then
    raise exception 'FAIL 27d: a tie did not read as a draw';
  end if;

  -- Both boxes empty is a table nobody has finished, not a nil-nil.
  update public.club_event_pairing_matches set score_one = null, score_two = null
   where id = v_match;
  v_row := pg_temp.army_of('event_pairing', v_match, 'one');
  if v_row.outcome <> '' then
    raise exception 'FAIL 27e: taking a score back left an outcome behind';
  end if;

  update public.club_event_pairing_matches set score_one = 80, score_two = 60
   where id = v_match;

  -- 10 · A list against one side of a table.
  perform public.club_set_result_list('event_pairing', v_match, 'one',
    (select id from public.army_lists
      where club_id = v_club and name = 'League list' limit 1));
  v_row := pg_temp.army_of('event_pairing', v_match, 'one');
  if v_row.list_name <> 'League list' then
    raise exception 'FAIL 28: a table''s list did not save';
  end if;

  -- 11 · 14a. The faction has always been in the data; only the card dropped
  -- it. If this ever stops returning a label the display cannot be the bug.
  select faction_label into v_faction from public.meta_event(v_event) limit 1;
  if coalesce(v_faction, '') = '' then
    raise exception 'FAIL 29: event analytics has no faction to show';
  end if;

  -- And a rate, which is the half 9a was really asked for: before the outcome
  -- above, a scored tournament reported "no rate yet" on every army in it.
  select count(*) into v_n from public.meta_event(v_event) where win_rate is not null;
  if v_n < 1 then
    raise exception 'FAIL 29a: a scored table produced no win rate';
  end if;
  select count(*) into v_n from public.meta_event(v_event);
  if v_n < 1 then raise exception 'FAIL 30: event analytics found nothing'; end if;

  -- 12 · The picker only offers lists belonging to the people on the sheet.
  select count(*) into v_n
    from public.club_member_lists(v_club, array[w.member]::uuid[]);
  if v_n <> 1 then
    raise exception 'FAIL 31: the picker offered % lists for one member, not 1', v_n;
  end if;
  select detachment into v_label
    from public.club_member_lists(v_club, array[w.member]::uuid[]) limit 1;
  if v_label <> 'Shield Host' then
    raise exception 'FAIL 32: the picker cannot fill the form in, got %', v_label;
  end if;

  perform pg_temp.be(w.stranger);
  select count(*) into v_n
    from public.club_member_lists(v_club, array[w.member]::uuid[]);
  if v_n <> 0 then
    raise exception 'FAIL 33: a stranger read a club''s army lists';
  end if;

  raise notice 'sections 8 to 12 pass';
end $$;

rollback;
\echo '0163 + 0164 event console: all pass'
