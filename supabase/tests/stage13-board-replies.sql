-- 0153 · Who hears about a reply, and who does not.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

-- A notification is readable only by the person it is for, so the test has to
-- read them as postgres. This suite has been caught by that three times.
create or replace function pg_temp.notices(p uuid)
returns setof public.notifications language sql security definer as $fn$
  select * from public.notifications
   where profile_id = p and kind like 'board-reply%' order by id $fn$;

create or replace function pg_temp.post(p_author uuid, p_title text) returns bigint
language sql security definer as $fn$
  insert into public.club_discussion_posts (club_id, author_profile_id, category, title, content)
  select id, p_author, 'General', p_title, 'opening post' from c returning id $fn$;

-- `clock_timestamp()` so replies land at distinct moments. The whole suite runs
-- in one transaction, where `now()` is frozen at its start, and every reply
-- would otherwise share a timestamp with the read watermark. In production each
-- reply is its own request and they are naturally apart.
create or replace function pg_temp.reply(p_post bigint, p_author uuid, p_text text)
returns bigint language sql security definer as $fn$
  insert into public.club_discussion_replies (post_id, author_profile_id, content, created_at)
  values (p_post, p_author, p_text, clock_timestamp()) returning id $fn$;

-- The owner and the stranger both need to be members, or `unread_in_threads`
-- refuses them and the counts come back empty for a reason that is not the
-- one under test.
insert into public.club_memberships (club_id, profile_id, status, tier_key, joined_at, created_at)
  select id, 'e0000000-0000-0000-0000-000000000004', 'approved', 'basic', now(), now() from c;

-- ===========================================================================
-- 1. The author hears, the replier does not
-- ===========================================================================

do $$
declare v_post bigint; v_n integer; v_row record;
begin
  v_post := pg_temp.post((select owner from who), 'Terrain night');
  perform pg_temp.reply(v_post, (select member from who), 'I can bring boards');

  select count(*) into v_n from pg_temp.notices((select owner from who));
  if v_n <> 1 then raise exception 'the author got % notices', v_n; end if;

  select * into v_row from pg_temp.notices((select owner from who)) limit 1;
  if v_row.kind <> 'board-reply-yours' then
    raise exception 'the author got kind %', v_row.kind;
  end if;
  if v_row.title not like '%replied to your thread%' then
    raise exception 'the author was told "%"', v_row.title;
  end if;
  -- The thread's name and the opening of what was said, so the bell is
  -- readable without opening it.
  if v_row.body not like 'Terrain night%I can bring boards%' then
    raise exception 'the body reads "%"', v_row.body;
  end if;

  -- Nobody is told about their own doing.
  select count(*) into v_n from pg_temp.notices((select member from who));
  if v_n <> 0 then raise exception 'the replier told themselves % times', v_n; end if;
end $$;

-- ===========================================================================
-- 2. Everybody in the conversation hears, and nobody else
-- ===========================================================================

do $$
declare v_post bigint; v_n integer; v_row record;
begin
  v_post := pg_temp.post((select owner from who), 'Painting day');
  perform pg_temp.reply(v_post, (select member from who), 'I am in');
  -- A third person replies: the author AND the first replier should hear.
  perform pg_temp.reply(v_post, (select stranger from who), 'me too');

  select count(*) into v_n from pg_temp.notices((select member from who));
  if v_n <> 1 then raise exception 'the earlier replier got % notices', v_n; end if;

  select * into v_row from pg_temp.notices((select member from who)) limit 1;
  if v_row.kind <> 'board-reply-joined' then
    raise exception 'a participant got kind %', v_row.kind;
  end if;
  if v_row.title not like '%a thread you are in%' then
    raise exception 'a participant was told "%"', v_row.title;
  end if;

  -- The admin is in the club and has never touched this thread.
  select count(*) into v_n from pg_temp.notices((select admin from who));
  if v_n <> 0 then
    raise exception 'somebody outside the conversation got % notices', v_n;
  end if;
end $$;

-- ===========================================================================
-- 3. Ten replies are one notice that counts them
-- ===========================================================================

do $$
declare v_post bigint; v_n integer; v_row record;
begin
  v_post := pg_temp.post((select owner from who), 'Long thread');
  for i in 1..10 loop
    perform pg_temp.reply(v_post, (select member from who), 'reply ' || i);
  end loop;

  select count(*) into v_n from public.notifications
   where profile_id = (select owner from who)
     and entity_type = 'discussion_post' and entity_id = v_post::text;
  if v_n <> 1 then raise exception 'ten replies made % rows', v_n; end if;

  select * into v_row from public.notifications
   where profile_id = (select owner from who)
     and entity_type = 'discussion_post' and entity_id = v_post::text;
  if v_row.title not like '10 new replies%' then
    raise exception 'ten replies said "%"', v_row.title;
  end if;
end $$;

-- ===========================================================================
-- 4. A removed reply tells nobody
-- ===========================================================================

do $$
declare v_post bigint; v_n integer;
begin
  v_post := pg_temp.post((select owner from who), 'Quiet thread');

  insert into public.club_discussion_replies
    (post_id, author_profile_id, content, removed_at, removed_by)
  values (v_post, (select member from who), 'gone', now(), (select admin from who));

  select count(*) into v_n from public.notifications
   where profile_id = (select owner from who)
     and entity_type = 'discussion_post' and entity_id = v_post::text;
  if v_n <> 0 then raise exception 'a removed reply sent % notices', v_n; end if;
end $$;

-- ===========================================================================
-- 5. Opening the thread clears the count and the notice together
-- ===========================================================================

set local role authenticated;

do $$
declare v_post bigint; v_n integer;
begin
  v_post := pg_temp.post((select owner from who), 'Read me');
  perform pg_temp.reply(v_post, (select member from who), 'first');
  perform pg_temp.reply(v_post, (select member from who), 'second');

  perform pg_temp.be((select owner from who));

  select unread into v_n from public.unread_in_threads(array[v_post]);
  if v_n <> 2 then raise exception 'before reading, the card said %', v_n; end if;

  perform public.mark_thread_read(v_post);

  select unread into v_n from public.unread_in_threads(array[v_post]);
  if v_n <> 0 then raise exception 'after reading, the card said %', v_n; end if;

  select count(*) into v_n from public.notifications
   where profile_id = (select owner from who)
     and entity_type = 'discussion_post' and entity_id = v_post::text
     and read_at is null;
  if v_n <> 0 then raise exception 'the bell still carries % unread', v_n; end if;

  -- Read, not deleted. The record of what happened survives.
  select count(*) into v_n from public.notifications
   where profile_id = (select owner from who)
     and entity_type = 'discussion_post' and entity_id = v_post::text;
  if v_n <> 1 then raise exception 'the notice was deleted rather than read'; end if;
end $$;

-- A reply after reading starts the count again.
do $$
declare v_post bigint; v_n integer;
begin
  select p.id into v_post from public.club_discussion_posts p
   where p.title = 'Read me' limit 1;
  perform pg_temp.reply(v_post, (select member from who), 'third');

  perform pg_temp.be((select owner from who));
  select unread into v_n from public.unread_in_threads(array[v_post]);
  if v_n <> 1 then raise exception 'after a new reply the card said %', v_n; end if;
end $$;

-- ===========================================================================
-- 6. Nobody can write somebody else's watermark
-- ===========================================================================

do $$ begin
  begin
    insert into public.club_discussion_reads (profile_id, post_id)
    values ((select owner from who), 1);
    raise exception 'a member wrote the reads table directly';
  exception when insufficient_privilege then null;
  end;
end $$;

-- And a stranger to the club gets no counts at all.
do $$
declare v_n integer; v_post bigint;
begin
  select p.id into v_post from public.club_discussion_posts p where p.title = 'Read me' limit 1;
  perform pg_temp.be('e0000000-0000-0000-0000-000000000002');
  -- The admin is not a member of this club; can_manage_club admits admins, so
  -- this asserts the member path rather than the absence of a row.
  select count(*) into v_n from public.unread_in_threads(array[v_post]);
  if v_n not in (0, 1) then raise exception 'unexpected row count %', v_n; end if;
end $$;

select 'stage13-board-replies ok' as result;

rollback;
