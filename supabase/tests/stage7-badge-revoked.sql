-- 0126 · a member is told when a badge comes off.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage7-seed.sql

-- A notification is readable only by the person it is for, so counting
-- somebody else's from an ordinary session reads zero whether one was written
-- or not. This runs as postgres and can tell.
create or replace function pg_temp.notices(p_who uuid, p_kind text)
returns int language sql security definer as $fn$
  select count(*)::int from public.notifications
   where profile_id = p_who and kind = p_kind $fn$;

create or replace function pg_temp.notice(p_who uuid, p_kind text)
returns text language sql security definer as $fn$
  select title || ' · ' || body from public.notifications
   where profile_id = p_who and kind = p_kind order by id desc limit 1 $fn$;

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

set local role authenticated;

do $$
declare v_club bigint; v_badge bigint; v_award bigint; w record; n int; t text;
begin
  select * into w from who;
  select id into v_club from c;

  perform pg_temp.be(w.owner);
  v_badge := public.save_club_badge(v_club, null, 'Terrain wizard',
    'Paints the scenery nobody else will', 'brush', 'service', true);

  -- ------------------------------------------------------- told on a revoke
  v_award := public.award_member_badge(v_badge, w.member, 'For the swamp table');
  assert pg_temp.notices(w.member, 'badge-taken-back') = 0,
    'told it was taken back before it was';

  assert public.revoke_member_badge(v_award), 'the revoke did not happen';
  assert pg_temp.notices(w.member, 'badge-taken-back') = 1,
    'nobody was told the badge came off';
  t := pg_temp.notice(w.member, 'badge-taken-back');
  assert t like '%took a badge back%' and t like '%Terrain wizard%',
    'the notice does not name the club and the badge: ' || t;
  raise notice 'PASS revoke: the member is told, by club and by badge';

  -- The award notice is its own row and survives, so the two do not overwrite
  -- each other while both are unread.
  assert pg_temp.notices(w.member, 'badge-awarded') = 1,
    'the revoke wrote over the award notice';
  raise notice 'PASS kinds: giving and taking back are two notices, not one';

  -- ------------------------------------------------------------- self, quiet
  v_award := public.award_member_badge(v_badge, w.owner, '');
  assert public.revoke_member_badge(v_award), 'the owner could not revoke their own';
  assert pg_temp.notices(w.owner, 'badge-taken-back') = 0,
    'an owner was told about taking a badge off themselves';
  raise notice 'PASS self: taking one off yourself says nothing';

  -- --------------------------------------------------- once, not every update
  n := pg_temp.notices(w.member, 'badge-taken-back');
  v_award := public.award_member_badge(v_badge, w.member, 'again');
  perform public.revoke_member_badge(v_award);
  assert pg_temp.notices(w.member, 'badge-taken-back') = n + 1,
    'a second badge did not produce a second notice';
  raise notice 'PASS again: giving it back and taking it off tells them again';

  raise notice 'ALL PASS · 0126 badge taken back';
end $$;

rollback;
