-- 0160 · A listing being written has somewhere to put its photos, and only
-- while it is the owner's to edit.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

insert into public.club_submissions (owner_id, club_name, city, status, payload)
  select owner, 'Harness Wargames', 'Didcot', 'draft', '{}'::jsonb from who;

create temp table sub as
  select id from public.club_submissions where club_name = 'Harness Wargames';
grant select on sub to authenticated;

/*
 * Everything below runs as `authenticated`. The session is postgres until this
 * line and postgres bypasses row security, so a block testing that a stranger
 * is refused would pass whatever the policy said.
 */
do $$
declare
  v_sub bigint := (select id from sub);
  v_owner uuid := (select owner from who);
  v_member uuid := (select member from who);
  v_ok boolean;
begin
  set local role authenticated;

  -- 1 · The owner of a draft may write against it.
  perform pg_temp.be(v_owner);
  select public.submission_media_writable('submissions/' || v_sub || '/photos/a.webp')
    into v_ok;
  if not v_ok then
    raise exception 'FAIL 1: the owner of a draft cannot upload to it';
  end if;

  -- 2 · Somebody else may not, which is the whole point of folder 2.
  perform pg_temp.be(v_member);
  select public.submission_media_writable('submissions/' || v_sub || '/photos/a.webp')
    into v_ok;
  if v_ok then
    raise exception 'FAIL 2: a stranger can upload against somebody elses listing';
  end if;

  -- 3 · A path that is not shaped like a submission is nobody's.
  perform pg_temp.be(v_owner);
  select public.submission_media_writable('submissions/notanumber/photos/a.webp')
    into v_ok;
  if v_ok then
    raise exception 'FAIL 3: a malformed path was accepted';
  end if;

  select public.submission_media_writable('clubs/1/photos/a.webp') into v_ok;
  if v_ok then
    raise exception 'FAIL 4: a club path was accepted by the submission policy';
  end if;

  raise notice 'sections 1-3 pass';
end $$;

-- Frozen once it is in the queue. Moved as postgres because the owner's own
-- update policy deliberately refuses to set this status by hand.
reset role;
update public.club_submissions set status = 'review_pending'
 where id = (select id from sub);

do $$
declare
  v_sub bigint := (select id from sub);
  v_owner uuid := (select owner from who);
  v_ok boolean;
begin
  set local role authenticated;

  -- 4 · Not while somebody is reviewing it. Photos that change under the
  -- person reading them are a review of something else.
  perform pg_temp.be(v_owner);
  select public.submission_media_writable('submissions/' || v_sub || '/photos/a.webp')
    into v_ok;
  if v_ok then
    raise exception 'FAIL 5: photos can still be swapped while it is in the queue';
  end if;

  raise notice 'section 4 passes';
end $$;

-- 5 · And again once an admin has sent it back.
reset role;
update public.club_submissions set status = 'changes_requested'
 where id = (select id from sub);

do $$
declare
  v_sub bigint := (select id from sub);
  v_owner uuid := (select owner from who);
  v_ok boolean;
begin
  set local role authenticated;

  perform pg_temp.be(v_owner);
  select public.submission_media_writable('submissions/' || v_sub || '/photos/a.webp')
    into v_ok;
  if not v_ok then
    raise exception 'FAIL 6: a listing sent back cannot have its photos fixed';
  end if;

  raise notice 'section 5 passes';
end $$;

-- 6 · The logo: an owner sets it, a stranger cannot, and clearing it retires
-- the legacy URL so an imported logo does not come straight back.
reset role;
update public.clubs set logo_url = '/clubs/assets/imported.jpg'
 where id = (select id from c);

do $$
declare
  v_club bigint := (select id from c);
  v_owner uuid := (select owner from who);
  v_member uuid := (select member from who);
  v_path text;
  v_url text;
begin
  set local role authenticated;

  perform pg_temp.be(v_member);
  begin
    perform public.set_club_logo(v_club, 'clubs/1/logo/a.webp');
    raise exception 'FAIL 7: a stranger set somebody elses logo';
  exception when insufficient_privilege then null;
  end;

  perform pg_temp.be(v_owner);
  perform public.set_club_logo(v_club, 'clubs/' || v_club || '/logo/a.webp');

  select logo_path, logo_url into v_path, v_url
    from public.clubs where id = v_club;
  if v_path is distinct from 'clubs/' || v_club || '/logo/a.webp' then
    raise exception 'FAIL 8: the logo did not save, got %', v_path;
  end if;
  if v_url is not null then
    raise exception 'FAIL 9: the imported URL survived, so both would be live';
  end if;

  -- Clearing it leaves nothing behind for the mapper to fall back to.
  perform public.set_club_logo(v_club, '');
  select logo_path, logo_url into v_path, v_url
    from public.clubs where id = v_club;
  if v_path is not null or v_url is not null then
    raise exception 'FAIL 10: a cleared logo left something behind';
  end if;

  raise notice 'section 6 passes';
end $$;

\echo 'stage12-submission-media: all pass'
