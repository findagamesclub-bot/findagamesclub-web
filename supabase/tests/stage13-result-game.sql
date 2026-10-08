-- 0165 · the game a result was played with.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

-- As postgres: the booking's own select policy is not what is under test here.
create or replace function pg_temp.booking(p_id bigint)
returns public.club_bookings language sql security definer as $fn$
  select * from public.club_bookings where id = p_id $fn$;

create or replace function pg_temp.army(p_id bigint, p_side text)
returns public.game_result_armies language sql security definer as $fn$
  select * from public.game_result_armies
   where source_type = 'booking' and source_id = p_id and side = p_side $fn$;

insert into public.club_membership_tiers (club_id, tier_key, label, benefits, is_basic)
  select id, 'basic', 'Basic Membership', '{}'::jsonb, true from c;

set local role authenticated;

do $$
declare
  w record; v_club bigint; v_booking bigint;
  v_row public.club_bookings; v_army public.game_result_armies; v_bad boolean;
begin
  select * into w from who;
  select id into v_club from c;
  select id into v_booking from bk;

  -- A catalogue, so the armies below are real ones.
  perform pg_temp.be(w.admin);
  perform public.save_army_edition('warhammer-40k', 'Warhammer 40,000',
    array['2000'], 'warhammer-40k-11th', '11th', 'v1');
  perform public.save_army_faction('warhammer-40k-11th', 'adeptus-custodes',
    'Adeptus Custodes', 0);
  perform public.save_army_detachment('warhammer-40k-11th', 'adeptus-custodes',
    'shield-host', 'Shield Host', array['Auric Champions'], 0);
  perform public.publish_army_catalogue('warhammer-40k-11th', '');

  perform pg_temp.be(w.owner);
  perform public.save_army_builder_settings(v_club, true, 'warhammer-40k-11th');

  -- 1 · A player records a result and names the game. It saves.
  perform pg_temp.be(w.member);
  perform public.record_booking_result(
    p_booking => v_booking, p_booked_by_score => 80, p_opponent_score => 60,
    p_game => 'Warhammer 40,000',
    p_armies => jsonb_build_object(
      'one', jsonb_build_object('factionId', 'adeptus-custodes',
                                'detachment', 'Shield Host',
                                'disposition', 'Auric Champions')));

  v_row := pg_temp.booking(v_booking);
  if v_row.game_title <> 'Warhammer 40,000' then
    raise exception 'FAIL 1: the game did not save, got "%"', v_row.game_title;
  end if;
  v_army := pg_temp.army(v_booking, 'one');
  if v_army.faction_label <> 'Adeptus Custodes' then
    raise exception 'FAIL 2: the army did not save with it';
  end if;

  -- 2 · Saving again without naming a game leaves the booking's own alone.
  -- Every caller that has not been updated takes this path.
  perform public.record_booking_result(
    p_booking => v_booking, p_booked_by_score => 70, p_opponent_score => 65);
  v_row := pg_temp.booking(v_booking);
  if v_row.game_title <> 'Warhammer 40,000' then
    raise exception 'FAIL 3: an absent game overwrote the one that was there';
  end if;

  -- 3 · Changing to another game clears the armies. The service sends an empty
  -- army per side for exactly this; `put_result_army` deletes the row.
  perform public.record_booking_result(
    p_booking => v_booking, p_booked_by_score => 2, p_opponent_score => 1,
    p_game => 'Blood Bowl',
    p_armies => jsonb_build_object('one', '{}'::jsonb, 'two', '{}'::jsonb));

  v_row := pg_temp.booking(v_booking);
  if v_row.game_title <> 'Blood Bowl' then
    raise exception 'FAIL 4: the game did not change, got "%"', v_row.game_title;
  end if;
  v_army := pg_temp.army(v_booking, 'one');
  if v_army.id is not null then
    raise exception 'FAIL 5: a Blood Bowl game kept its Custodes army';
  end if;
  if v_row.booked_by_army <> '' then
    raise exception 'FAIL 6: the free-text army column kept the faction too';
  end if;

  -- 4 · The scores are unaffected by any of it.
  if v_row.booked_by_score <> 2 or v_row.opponent_score <> 1 then
    raise exception 'FAIL 7: the scores did not save alongside the game';
  end if;

  -- 5 · A name nobody could type by hand is refused rather than truncated.
  begin
    perform public.record_booking_result(
      p_booking => v_booking, p_booked_by_score => 1, p_opponent_score => 0,
      p_game => repeat('x', 200));
    v_bad := true;
  exception when others then v_bad := position('RESULT_GAME_TOO_LONG' in sqlerrm) = 0;
  end;
  if v_bad then raise exception 'FAIL 8: a 200 character game name was accepted'; end if;

  -- 6 · And none of it is reachable by somebody who did not play.
  perform pg_temp.be(w.stranger);
  begin
    perform public.record_booking_result(
      p_booking => v_booking, p_booked_by_score => 99, p_opponent_score => 0,
      p_game => 'Kill Team');
    v_bad := true;
  exception when others then v_bad := position('RESULT_NOT_YOURS' in sqlerrm) = 0;
  end;
  if v_bad then raise exception 'FAIL 9: a stranger rewrote a result'; end if;

  v_row := pg_temp.booking(v_booking);
  if v_row.game_title <> 'Blood Bowl' then
    raise exception 'FAIL 10: the refused call changed the game anyway';
  end if;

  raise notice 'sections 1 to 6 pass';
end $$;

rollback;
\echo '0165 result game: all pass'
