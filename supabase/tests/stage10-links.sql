-- 0145 · linking a saved list to a result, and the list rollup.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

-- The seed books the next club night, which is in the future, and the rollups
-- deliberately exclude a game nobody has played yet. Backdated here rather
-- than seeded in the past, because the booking guard refuses a past date on
-- insert and that guard is worth keeping.
create or replace function pg_temp.backdate(p_id bigint) returns void
language sql security definer as $fn$
  update public.game_result_armies set played_on = public.london_today() - 7
   where source_id = p_id $fn$;

create or replace function pg_temp.army(p_id bigint)
returns public.game_result_armies language sql security definer as $fn$
  select * from public.game_result_armies where source_id = p_id and side = 'one' $fn$;

insert into public.club_membership_tiers (club_id, tier_key, label, benefits, is_basic)
  select id, 'basic', 'Basic Membership', '{"armyBuilderAccess": true}'::jsonb, true from c;

set local role authenticated;

do $$
declare
  w record; v_club bigint; v_book bigint; v_list bigint; v_out jsonb;
  a public.game_result_armies; v_rows int;
begin
  select * into w from who;
  select id into v_club from c;
  select id into v_book from bk;

  perform pg_temp.be(w.admin);
  perform public.save_army_edition('warhammer-40k', 'Warhammer 40,000',
    array['2000'], 'warhammer-40k-11th', '11th', 'v1');
  perform public.save_army_faction('warhammer-40k-11th', 'adeptus-custodes',
    'Adeptus Custodes', 0);
  perform public.save_army_detachment('warhammer-40k-11th', 'adeptus-custodes',
    'shield-host', 'Shield Host', array['Auric Champions'], 0);
  perform public.save_army_unit('warhammer-40k-11th', 'adeptus-custodes',
    'Castigator', 165, '[{"label":"Default","modelCount":1,"points":"165"}]'::jsonb,
    '[]'::jsonb, 0);
  perform public.publish_army_catalogue('warhammer-40k-11th', '');

  perform pg_temp.be(w.owner);
  perform public.save_army_builder_settings(v_club, true, 'warhammer-40k-11th');

  -- A list, and a result with an army on the member's side.
  perform pg_temp.be(w.member);
  v_out := public.save_army_list(null, v_club, jsonb_build_object(
    'name', 'League list', 'listType', 'army-list', 'pointsLimit', '2000',
    'factionId', 'adeptus-custodes',
    'detachments', '[{"detachment":"Shield Host","disposition":"Auric Champions"}]'::jsonb,
    'units', '[{"unitName":"Castigator","optionLabel":"Default","quantity":2}]'::jsonb), '');
  v_list := (v_out ->> 'listId')::bigint;

  perform public.record_booking_result(v_book, 85, 62, '', '', '', '', '', '',
    jsonb_build_object(
      'one', jsonb_build_object('factionId', 'adeptus-custodes',
        'detachment', 'Shield Host', 'disposition', 'Auric Champions',
        'primaryScore', 45, 'secondaryScore', 30, 'painted', true),
      'two', jsonb_build_object('factionId', 'adeptus-custodes',
        'detachment', 'Shield Host', 'disposition', 'Auric Champions')));

  a := pg_temp.army(v_book);
  if a.id is null then raise exception 'the result should carry an army'; end if;
  if a.profile_id <> w.member then
    raise exception 'side one should be filed under the member';
  end if;

  -- ------------------------------------------------------------ the link
  perform public.link_result_army_list('booking', v_book, 'one', v_list);
  a := pg_temp.army(v_book);
  if a.list_id <> v_list then raise exception 'the list should be linked'; end if;
  if a.list_name <> 'League list' then raise exception 'the name should be copied'; end if;
  if (a.snapshot -> 'units' -> 0 ->> 'quantity')::int <> 2 then
    raise exception 'the units should be frozen onto the result';
  end if;

  -- Editing the list afterwards must not rewrite what was played.
  v_out := public.save_army_list(v_list, v_club, jsonb_build_object(
    'name', 'League list', 'listType', 'army-list', 'pointsLimit', '2000',
    'factionId', 'adeptus-custodes',
    'detachments', '[{"detachment":"Shield Host","disposition":"Auric Champions"}]'::jsonb,
    'units', '[{"unitName":"Castigator","optionLabel":"Default","quantity":3}]'::jsonb),
    'Adjusted Castigator');
  if not (v_out ->> 'createdVersion')::boolean then
    raise exception 'that edit should have made a version';
  end if;
  a := pg_temp.army(v_book);
  if (a.snapshot -> 'units' -> 0 ->> 'quantity')::int <> 2 then
    raise exception 'history moved when the list did';
  end if;

  -- ---------------------------------------------------------- the refusals
  perform pg_temp.be(w.owner);
  begin
    perform public.link_result_army_list('booking', v_book, 'one', v_list);
    raise exception 'the club must not say what somebody else brought';
  exception when others then
    if sqlerrm <> 'ARMY_NOT_YOURS' then raise; end if;
  end;

  perform pg_temp.be(w.member);
  begin
    perform public.link_result_army_list('booking', v_book, 'two', v_list);
    raise exception 'a member must not link onto the other side';
  exception when others then
    if sqlerrm <> 'ARMY_NOT_YOURS' then raise; end if;
  end;

  -- ---------------------------------------------------------- the rollup
  -- The club settles it, which is what makes it count anywhere (0141).
  perform pg_temp.be(w.owner);
  perform public.record_booking_result(v_book, 85, 62, '', '', '', '', '',
    'admin-confirmed',
    jsonb_build_object(
      'one', jsonb_build_object('factionId', 'adeptus-custodes',
        'detachment', 'Shield Host', 'disposition', 'Auric Champions',
        'primaryScore', 45, 'secondaryScore', 30, 'painted', true),
      'two', jsonb_build_object('factionId', 'adeptus-custodes',
        'detachment', 'Shield Host', 'disposition', 'Auric Champions')));
  perform pg_temp.be(w.member);
  perform pg_temp.backdate(v_book);
  select count(*) into v_rows from public.meta_lists(v_club, null, null);
  if v_rows <> 1 then
    raise exception 'the list leaderboard should have one row, got %', v_rows;
  end if;
  if (select version_number from public.meta_lists(v_club, null, null))
     is distinct from 1 then
    raise exception 'the rollup should name the version played, not the latest';
  end if;

  -- Unlinking takes the frozen copy with it, which is how a mis-tap is undone.
  perform public.link_result_army_list('booking', v_book, 'one', null);
  a := pg_temp.army(v_book);
  if a.list_id is not null or a.snapshot <> '{}'::jsonb then
    raise exception 'unlinking should clear the link and the copy';
  end if;

  raise notice 'stage10-links: all pass';
end $$;
