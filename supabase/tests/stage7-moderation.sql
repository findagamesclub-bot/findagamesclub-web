-- 0122 · the moderation queue. scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage7-seed.sql

-- Something to report, one of each kind that matters.
insert into public.club_reviews (club_id, author_profile_id, author_name, rating, comment)
  select id, 'd0000000-0000-0000-0000-000000000003', 'Member Seven', 1,
         'This club is rubbish and here is a slur' from c;
insert into public.club_discussion_categories (club_id, label)
  select id, 'General' from c;
insert into public.club_discussion_posts (club_id, author_profile_id, category, title, content)
  select id, 'd0000000-0000-0000-0000-000000000003', 'General',
         'Read this', 'Abusive words in a board post' from c;
insert into public.club_messages (club_id, sender_id, recipient_id, content)
  select id, 'd0000000-0000-0000-0000-000000000003',
         'd0000000-0000-0000-0000-000000000001', 'A nasty private message' from c;

-- Captured as postgres, before the role switch. Read after it and RLS hides
-- the message and the post from a session with no `auth.uid()` yet, so every
-- id comes back null and the test reports TARGET_NOT_FOUND about its own
-- fixture rather than about the thing under test.
create temp table ids as
  select (select id from public.club_reviews limit 1) as review,
         (select id from public.club_discussion_posts limit 1) as post,
         (select id from public.club_messages limit 1) as message;
grant select on ids to authenticated;

-- Checking a removal from an ordinary session reads zero rows whether the row
-- was soft-deleted or hard-deleted, because the select policy hides
-- `removed_at is not null` either way. This is created by postgres and runs as
-- postgres, so it can tell the two apart, which is the whole assertion.
create or replace function pg_temp.state(p_table text, p_id bigint) returns text
language plpgsql security definer as $fn$
declare v_removed boolean;
begin
  execute format('select removed_at is not null from public.%I where id = $1', p_table)
    into v_removed using p_id;
  if v_removed is null then return 'gone'; end if;
  return case when v_removed then 'removed' else 'live' end;
end $fn$;

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

set local role authenticated;

do $$
declare w record; v_club bigint; v_review bigint; v_post bigint; v_msg bigint;
        v_flag bigint; n int; j jsonb; t text; v_gone boolean;
begin
  select * into w from who;
  select id into v_club from c;
  select review, post, message into v_review, v_post, v_msg from ids;

  -- ------------------------------------------------------------- reporting
  perform pg_temp.be(w.owner);
  v_flag := public.flag_content('review', v_review, 'Contains a slur');
  assert v_flag is not null, 'the review could not be reported';

  -- Reporting the same thing twice is not two problems.
  assert public.flag_content('review', v_review, 'again') is null,
    'a second report should be a no-op';
  select count(*) into n from public.moderation_flags
   where target_type = 'review' and target_id = v_review;
  assert n = 1, 'one report became ' || n;
  raise notice 'PASS report: filed once, and reporting again changes nothing';

  -- The club is derived, never supplied.
  select club_id into n from public.moderation_flags where id = v_flag;
  assert n = v_club, 'the flag did not pick up the club';
  raise notice 'PASS club: derived from the target rather than supplied';

  -- The review columns stay in step, so the club page keeps working.
  select flagged_at is not null into t from public.club_reviews where id = v_review;
  assert t::boolean, 'the review was not mirrored as flagged';
  raise notice 'PASS mirror: the review flag columns stay in step';

  -- A target that does not exist, and a type that does not either.
  begin
    perform public.flag_content('review', 99999999, '');
    raise exception 'NOT_REACHED';
  exception
    when others then
      assert sqlerrm like '%TARGET_NOT_FOUND%', 'wrong error: ' || sqlerrm;
      raise notice 'PASS missing: reporting nothing is refused by name';
  end;
  begin
    perform public.flag_content('club', v_club, '');
    raise exception 'NOT_REACHED';
  exception
    when others then
      assert sqlerrm like '%UNKNOWN_TARGET%', 'wrong error: ' || sqlerrm;
      raise notice 'PASS type: a club is not a reportable thing';
  end;

  -- A message between two other people cannot be reported by a third, because
  -- flag_content runs as the caller and RLS has already hidden the row.
  perform pg_temp.be(w.stranger);
  begin
    perform public.flag_content('message', v_msg, 'nosy');
    raise exception 'NOT_REACHED';
  exception
    when others then
      assert sqlerrm like '%TARGET_NOT_FOUND%', 'wrong error: ' || sqlerrm;
      raise notice 'PASS privacy: a stranger cannot report a message they cannot see';
  end;

  -- But a party to it can.
  perform pg_temp.be(w.owner);
  assert public.flag_content('message', v_msg, 'Abusive') is not null,
    'the recipient could not report their own message';
  assert public.flag_content('post', v_post, 'Abusive') is not null,
    'the post could not be reported';
  raise notice 'PASS parties: the recipient can report their own message';

  -- ----------------------------------------------------------- the queue
  perform pg_temp.be(w.member);
  begin
    perform public.moderation_queue('', 'open', '', 25, 0);
    raise exception 'NOT_REACHED';
  exception
    when insufficient_privilege then raise notice 'PASS guard: a member cannot open the queue';
    when others then raise exception 'wrong error: %', sqlerrm;
  end;

  perform pg_temp.be(w.owner);
  begin
    perform public.moderation_queue('', 'open', '', 25, 0);
    raise exception 'NOT_REACHED';
  exception
    when insufficient_privilege then
      raise notice 'PASS guard: an owner cannot either, the queue is the admin''s';
    when others then raise exception 'wrong error: %', sqlerrm;
  end;

  perform pg_temp.be(w.admin);
  select count(*) into n from public.moderation_queue('', 'open', '', 25, 0);
  assert n = 3, 'the admin should see 3 waiting, got ' || n;
  select total_count into n from public.moderation_queue('', 'open', '', 25, 0) limit 1;
  assert n = 3, 'total_count is wrong before paging, got ' || n;

  -- The words that were reported come with it, or there is nothing to judge.
  select body into t from public.moderation_queue('review', 'open', '', 25, 0);
  assert t like '%slur%', 'the queue did not carry the review text';
  raise notice 'PASS queue: three waiting, with the words and a total that pages';

  -- Filtering by type and searching the words.
  select count(*) into n from public.moderation_queue('message', 'open', '', 25, 0);
  assert n = 1, 'the type filter is wrong, got ' || n;
  select count(*) into n from public.moderation_queue('', 'open', 'nasty', 25, 0);
  assert n = 1, 'the search should match the message body, got ' || n;
  select count(*) into n from public.moderation_queue('', 'open', 'zzzz', 25, 0);
  assert n = 0, 'a search matching nothing returned rows';
  raise notice 'PASS filters: type and search both narrow';

  j := public.moderation_queue_counts('', '');
  assert (j->>'open')::int = 3 and (j->>'answered')::int = 0
     and (j->>'all')::int = 3, 'tab counts are wrong: ' || j::text;
  j := public.moderation_queue_counts('', 'nasty');
  assert (j->>'all')::int = 1, 'the counts do not narrow with the search: ' || j::text;
  raise notice 'PASS counts: they narrow with the search like every other list';

  -- ----------------------------------------------------------- resolving
  -- Keeping leaves the words and clears the review''s mirrored flag.
  perform public.resolve_moderation_flag(v_flag, 'keep', 'Reads as fair comment');
  assert pg_temp.state('club_reviews', v_review) = 'live',
    'keeping removed the review anyway';
  select flagged_at is null into t from public.club_reviews where id = v_review;
  assert t::boolean, 'keeping left the review looking reported';
  select status into t from public.moderation_flags where id = v_flag;
  assert t = 'dismissed', 'the flag should be dismissed, is ' || t;
  raise notice 'PASS keep: words stay, and the club page stops saying reported';

  -- Removing soft-deletes through the same column every other path uses.
  select id into v_flag from public.moderation_flags
   where target_type = 'post' and status = 'open';
  perform public.resolve_moderation_flag(v_flag, 'remove', 'Abuse');
  -- Soft deleted, not hard: the thread has to survive without the post, which
  -- is why 0019 exists at all.
  assert pg_temp.state('club_discussion_posts', v_post) = 'removed',
    'the post is ' || pg_temp.state('club_discussion_posts', v_post) || ', not removed';
  select status into t from public.moderation_flags where id = v_flag;
  assert t = 'actioned', 'the flag should be actioned, is ' || t;
  raise notice 'PASS remove: soft deleted, and the row survives for the thread';

  -- A removed thing leaves the queue, because there is nothing left to judge.
  select count(*) into n from public.moderation_queue('', 'open', '', 25, 0);
  assert n = 1, 'the queue should hold 1 after two were answered, got ' || n;
  select count(*) into n from public.moderation_queue('', 'answered', '', 25, 0);
  assert n = 2, 'both answered flags should still be findable, got ' || n;

  -- The removed one keeps its record and loses its words, so an admin can find
  -- what they took down without the queue showing it to them again.
  select target_gone into v_gone from public.moderation_queue('post', 'answered', '', 25, 0);
  assert v_gone, 'a removed post should be marked gone in the record';
  select body into t from public.moderation_queue('post', 'answered', '', 25, 0);
  assert coalesce(t, '') = '', 'a removed post should show no words, shows: ' || t;
  raise notice 'PASS record: a removal stays findable, with its words gone';

  -- An action nobody defined, and a flag already answered.
  begin
    perform public.resolve_moderation_flag(v_flag, 'delete', '');
    raise exception 'NOT_REACHED';
  exception
    when others then
      assert sqlerrm like '%UNKNOWN_ACTION%' or sqlerrm like '%FLAG_NOT_FOUND%',
        'wrong error: ' || sqlerrm;
      raise notice 'PASS action: an invented action is refused';
  end;

  perform pg_temp.be(w.member);
  begin
    perform public.resolve_moderation_flag(v_flag, 'keep', '');
    raise exception 'NOT_REACHED';
  exception
    when insufficient_privilege then raise notice 'PASS resolve: only an admin answers one';
    when others then raise exception 'wrong error: %', sqlerrm;
  end;

  -- A removed message is gone from the two people who could see it.
  perform pg_temp.be(w.admin);
  select id into v_flag from public.moderation_flags
   where target_type = 'message' and status = 'open';
  perform public.resolve_moderation_flag(v_flag, 'remove', 'Abuse');
  assert pg_temp.state('club_messages', v_msg) = 'removed',
    'the message was not removed';
  perform pg_temp.be(w.owner);
  select count(*) into n from public.club_messages where id = v_msg;
  assert n = 0, 'a removed message is still readable by its recipient, got ' || n;
  raise notice 'PASS messages: soft deleted, and hidden from both sides';
end $$;
rollback;
