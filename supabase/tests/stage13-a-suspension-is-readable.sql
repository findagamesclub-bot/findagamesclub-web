-- 0225 · a suspended member can read why, and answer it.
--
-- Section 1 is the break test: `my_suspensions` is `security invoker`, so the
-- membership's own select policy is the whole guard. If that ever widens, a
-- stranger reads what a club wrote about somebody in confidence.
--
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage7-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

-- A second club the member also belongs to, which is the half of item 26 that
-- was a crash: suspending them at one club took the whole list down.
insert into public.clubs (slug, name, city, status, owner_id)
values ('other-club', 'Other Club', 'York', 'active',
        'd0000000-0000-0000-0000-000000000002');

create temp table other as select id from public.clubs where slug = 'other-club';
grant select on other to authenticated;

insert into public.club_memberships (club_id, profile_id, status, tier_key, joined_at, created_at)
  select id, (select member from who), 'approved', 'basic', now(), now() from other;

create temp table mem as
  select m.id from public.club_memberships m, c
   where m.club_id = c.id and m.profile_id = 'd0000000-0000-0000-0000-000000000003';
grant select on mem to authenticated;

do $$
declare
  v_club   bigint;
  v_mem    bigint;
  v_n      int;
  v_reason text;
begin
  select id into v_club from c;
  select id into v_mem from mem;

  -- ====================================================================== 1
  -- The club suspends them, with a reason.
  -- ====================================================================== 1
  set local role authenticated;
  perform pg_temp.be((select owner from who));
  perform public.set_membership_suspended(v_mem, true, 'Repeatedly no-showed a booked table');
  reset role;

  set local role authenticated;
  perform pg_temp.be((select member from who));
  select reason into v_reason from public.my_suspensions() where membership_id = v_mem;
  reset role;

  if coalesce(v_reason, '') <> 'Repeatedly no-showed a booked table' then
    raise exception 'FAIL 1: the member read "%" as the reason', v_reason;
  end if;
  raise notice 'PASS 1: the member reads the club''s own words for why';

  -- ====================================================================== 2
  -- BREAK TEST. Nobody else does. The function is `security invoker` and the
  -- membership's select policy is the only thing standing between a club's
  -- private note about somebody and the rest of the site.
  -- ====================================================================== 2
  set local role authenticated;
  perform pg_temp.be((select stranger from who));
  select count(*) into v_n from public.my_suspensions();
  reset role;

  if v_n <> 0 then
    raise exception
      'FAIL 2: a stranger read % suspension rows — `my_suspensions` is not '
      'filtered to the caller any more', v_n;
  end if;
  raise notice 'PASS 2: break test — a stranger reads none of it';

  -- ====================================================================== 3
  -- Their OTHER club is untouched, which is the line the client drew and the
  -- half that crashed: "they then cannot see any of their memberships to
  -- other clubs".
  -- ====================================================================== 3
  select count(*) into v_n
    from public.club_memberships m, other o
   where m.club_id = o.id and m.profile_id = (select member from who)
     and m.status = 'approved';
  if v_n <> 1 then
    raise exception 'FAIL 3: suspending at one club changed the membership at another';
  end if;
  raise notice 'PASS 3: the other club''s membership is exactly as it was';

  -- ====================================================================== 4
  -- And the club's door really is shut, which is 0212 still doing its job.
  -- ====================================================================== 4
  set local role authenticated;
  perform pg_temp.be((select member from who));
  if public.is_club_member(v_club) then
    reset role;
    raise exception 'FAIL 4: a suspended member is still inside the club';
  end if;
  reset role;
  raise notice 'PASS 4: the club''s own door is still shut to them';

  -- ====================================================================== 5
  -- They may write to whoever runs the club, and to nobody else there. This
  -- is the "message club owner" button, and without it the screen tells
  -- somebody they are out and offers them nothing to do about it.
  -- ====================================================================== 5
  set local role authenticated;
  perform pg_temp.be((select member from who));
  if not public.can_message_member(v_club, (select owner from who)) then
    reset role;
    raise exception 'FAIL 5: a suspended member cannot answer the club that suspended them';
  end if;
  if public.can_message_member(v_club, (select stranger from who)) then
    reset role;
    raise exception 'FAIL 5: a suspended member can write to somebody who does not run the club';
  end if;
  reset role;
  raise notice 'PASS 5: they can write to the club, and to nobody else there';

  -- ====================================================================== 6
  -- And the club can answer. A club that can shut somebody out and then not
  -- reply to them is a conversation with one side.
  -- ====================================================================== 6
  set local role authenticated;
  perform pg_temp.be((select owner from who));
  if not public.can_message_member(v_club, (select member from who)) then
    reset role;
    raise exception 'FAIL 6: the club cannot answer somebody it suspended';
  end if;
  reset role;
  raise notice 'PASS 6: and the club can answer them';

  -- ====================================================================== 7
  -- Lifting it closes the door the other way: no reason left behind, and no
  -- standing to message the club out of the blue a year later.
  -- ====================================================================== 7
  set local role authenticated;
  perform pg_temp.be((select owner from who));
  perform public.set_membership_suspended(v_mem, false, '');
  reset role;

  set local role authenticated;
  perform pg_temp.be((select member from who));
  select count(*) into v_n from public.my_suspensions();
  reset role;

  if v_n <> 0 then
    raise exception 'FAIL 7: a lifted suspension is still being reported';
  end if;
  raise notice 'PASS 7: lifting it takes the reason with it';

  raise notice 'ALL PASS · 0225 a suspension is readable and answerable';
end $$;

rollback;
