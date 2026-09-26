-- 0121 · badges. Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage7-seed.sql

-- Notifications are readable only by the person they are for, so counting
-- somebody else's from an ordinary session reads zero whether one was written
-- or not. Created by postgres and running as postgres, so it can tell.
create or replace function pg_temp.notices(p_who uuid, p_kind text)
returns int language sql security definer as $fn$
  select count(*)::int from public.notifications
   where profile_id = p_who and kind = p_kind $fn$;

create or replace function pg_temp.notice_title(p_who uuid, p_kind text)
returns text language sql security definer as $fn$
  select title from public.notifications
   where profile_id = p_who and kind = p_kind limit 1 $fn$;

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

set local role authenticated;

do $$
declare v_club bigint; v_badge bigint; v_award bigint; w record; n int; m int; t text;
begin
  select * into w from who;
  select id into v_club from c;

  -- ---------------------------------------------------------------- owner
  perform pg_temp.be(w.owner);
  v_badge := public.save_club_badge(v_club, null, 'Terrain wizard',
    'Paints the scenery nobody else will', 'brush', 'service', true);
  assert v_badge is not null, 'the owner could not create a badge';
  raise notice 'PASS create: an owner makes a badge';

  -- A second badge of the same name, in any casing, is one badge.
  begin
    perform public.save_club_badge(v_club, null, 'terrain WIZARD', '', 'star', 'club', true);
    raise exception 'NOT_REACHED';
  exception
    when unique_violation then raise notice 'PASS unique: one badge of a name per club';
    when others then raise exception 'wrong error on a duplicate name: %', sqlerrm;
  end;

  -- An empty name is refused by name rather than saved as a blank chip.
  begin
    perform public.save_club_badge(v_club, null, '   ', '', 'star', 'club', true);
    raise exception 'NOT_REACHED';
  exception
    when others then
      assert sqlerrm like '%BADGE_NEEDS_NAME%', 'wrong error for a blank name: ' || sqlerrm;
      raise notice 'PASS blank: an unnamed badge is refused by name';
  end;

  -- The closed sets are enforced here as well as in TypeScript.
  begin
    perform public.save_club_badge(v_club, null, 'Dragon', '', 'dragon', 'club', true);
    raise exception 'NOT_REACHED';
  exception
    when check_violation then raise notice 'PASS icon: an invented icon is refused';
    when others then raise exception 'wrong error for a bad icon: %', sqlerrm;
  end;
  begin
    perform public.save_club_badge(v_club, null, 'Rainbow', '', 'star', 'rainbow', true);
    raise exception 'NOT_REACHED';
  exception
    when check_violation then raise notice 'PASS tone: an invented tone is refused';
    when others then raise exception 'wrong error for a bad tone: %', sqlerrm;
  end;

  -- ---------------------------------------------------------------- awards
  v_award := public.award_member_badge(v_badge, w.member, 'For the swamp table');
  assert v_award is not null, 'the award did not happen';

  -- Awarding it twice is a no-op, not a refusal: two managers working the same
  -- list must not see an error.
  assert public.award_member_badge(v_badge, w.member, '') is null,
    'a second award should be a no-op';
  select count(*) into n from public.member_badges
   where badge_id = v_badge and revoked_at is null;
  assert n = 1, 'a badge was awarded twice, got ' || n;
  raise notice 'PASS award: once, and awarding again changes nothing';

  -- A club may only speak about its own.
  begin
    perform public.award_member_badge(v_badge, w.stranger, '');
    raise exception 'NOT_REACHED';
  exception
    when others then
      assert sqlerrm like '%NOT_A_MEMBER%', 'wrong error for a stranger: ' || sqlerrm;
      raise notice 'PASS stranger: a badge cannot be pinned to somebody outside the club';
  end;

  -- The count rides on the definition rather than needing a second query.
  select awarded into n from public.club_badges_for(v_club) where id = v_badge;
  assert n = 1, 'the badge should read 1 awarded, got ' || n;
  select count(*) into n from public.member_badges_for(v_club, w.member);
  assert n = 1, 'the member should hold 1 badge, got ' || n;
  raise notice 'PASS counts: the definition and the member agree';

  -- Retiring keeps what was awarded and stops new ones.
  perform public.save_club_badge(v_club, v_badge, 'Terrain wizard',
    'Paints the scenery nobody else will', 'brush', 'service', false);
  select count(*) into n from public.member_badges_for(v_club, w.member);
  assert n = 1, 'retiring a badge took it off a member, got ' || n;
  begin
    perform public.award_member_badge(v_badge, w.member, '');
    raise exception 'NOT_REACHED';
  exception
    when others then
      assert sqlerrm like '%BADGE_RETIRED%', 'wrong error for a retired badge: ' || sqlerrm;
      raise notice 'PASS retire: keeps what was given, refuses anything new';
  end;
  perform public.save_club_badge(v_club, v_badge, 'Terrain wizard', '', 'brush', 'service', true);

  -- Revoking is a state, not a delete, and the same badge can be given again.
  assert public.revoke_member_badge(v_award);
  select count(*) into n from public.member_badges_for(v_club, w.member);
  assert n = 0, 'a revoked badge is still showing, got ' || n;
  select count(*) into n from public.member_badges where badge_id = v_badge;
  assert n = 1, 'revoking deleted the row instead of marking it, got ' || n;
  assert public.award_member_badge(v_badge, w.member, 'again') is not null,
    'could not award again after a revoke';
  raise notice 'PASS revoke: marked not deleted, and it can be given again';

  -- --------------------------------------------------------------- telling
  -- 0124. The point of a badge is being told you have it.
  n := pg_temp.notices(w.member, 'badge-awarded');
  assert n >= 1, 'the member was not told about their badge, got ' || n;

  t := pg_temp.notice_title(w.member, 'badge-awarded');
  assert t like '%gave you a badge%', 'the notice does not say what happened: ' || t;
  raise notice 'PASS told: the member hears about it, naming the club';

  -- Nobody is told about their own doing.
  perform pg_temp.be(w.owner);
  perform public.award_member_badge(v_badge, w.owner, 'mine');
  n := pg_temp.notices(w.owner, 'badge-awarded');
  assert n = 0, 'somebody was told about a badge they gave themselves';
  raise notice 'PASS self: nobody is told about their own doing';

  -- And a revoke is its own notice (0126), not a second award notice. Counted
  -- before and after rather than against a fixed number, because this member
  -- has been given the badge twice by now and both were worth telling them
  -- about. The award notice must survive: one kind for both halves would let
  -- the revoke rewrite it in place while it was still unread.
  n := pg_temp.notices(w.member, 'badge-awarded');
  m := pg_temp.notices(w.member, 'badge-taken-back');
  perform pg_temp.be(w.owner);
  select id into v_award from public.member_badges
   where profile_id = w.member and revoked_at is null limit 1;
  perform public.revoke_member_badge(v_award);
  assert pg_temp.notices(w.member, 'badge-awarded') = n,
    'taking a badge back rewrote the award notice';
  assert pg_temp.notices(w.member, 'badge-taken-back') = m + 1,
    'taking a badge back told nobody';
  raise notice 'PASS revoke: its own notice, and the award one survives';

  -- ---------------------------------------------------------------- guards
  perform pg_temp.be(w.helper);
  begin
    perform public.save_club_badge(v_club, null, 'Helper badge', '', 'star', 'club', true);
    raise exception 'NOT_REACHED';
  exception
    when insufficient_privilege then raise notice 'PASS helper: cannot create a badge';
    when others then raise exception 'wrong error for a helper: %', sqlerrm;
  end;
  begin
    perform public.award_member_badge(v_badge, w.member, '');
    raise exception 'NOT_REACHED';
  exception
    when insufficient_privilege then raise notice 'PASS helper: cannot award one either';
    when others then raise exception 'wrong error for a helper award: %', sqlerrm;
  end;

  -- A member reads, and cannot write.
  perform pg_temp.be(w.member);
  select count(*) into n from public.club_badges_for(v_club);
  assert n >= 1, 'a member cannot see the club badges';
  begin
    perform public.club_badge_awards(v_club, null);
    raise exception 'NOT_REACHED';
  exception
    when insufficient_privilege then raise notice 'PASS member: reads badges, not the award list';
    when others then raise exception 'wrong error for a member: %', sqlerrm;
  end;

  -- A stranger reads nothing.
  perform pg_temp.be(w.stranger);
  begin
    perform public.club_badges_for(v_club);
    raise exception 'NOT_REACHED';
  exception
    when insufficient_privilege then raise notice 'PASS stranger: sees no badges at all';
    when others then raise exception 'wrong error for a stranger read: %', sqlerrm;
  end;
end $$;
rollback;
