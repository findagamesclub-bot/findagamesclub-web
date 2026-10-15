-- 0189 · newest first on two lists, and the way back to where it was said.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

-- An event the club put up LAST, with the start date FURTHEST away, so the two
-- orders cannot agree by accident. Without that the whole point of the item is
-- untested: "newest" and "soonest" would hand back the same list.
insert into public.club_events
  (club_id, legacy_id, title, start_date, status, created_at)
  select id, 'old-listed-soon', 'Listed Months Ago', current_date + 7, 'published',
         now() - interval '90 days' from c;
insert into public.club_events
  (club_id, legacy_id, title, start_date, status, created_at)
  select id, 'new-listed-later', 'Put Up This Morning', current_date + 300, 'published',
         now() - interval '1 hour' from c;

-- A third, and it is the one that makes the test mean anything. With only
-- the two above, "newest by when it was put up" and "newest by start date"
-- hand back the same event, so the mistake this item is actually about would
-- have passed. This one is the furthest away of all and was NOT put up last.
insert into public.club_events
  (club_id, legacy_id, title, start_date, status, created_at)
  select id, 'furthest-away', 'Furthest Away', current_date + 400, 'published',
         now() - interval '2 hours' from c;

create temp table ev as select
  (select id from public.club_events where legacy_id = 'old-listed-soon') as soon,
  (select id from public.club_events where legacy_id = 'new-listed-later') as fresh;

-- One of each reportable thing, so every branch of the context join is walked.
insert into public.club_discussion_categories (club_id, label, position)
  select id, 'General', 1 from c;
-- A decoy thread first, so the reply's own id and its parent's are DIFFERENT
-- numbers. Without it both are 1 and "a reply points at its thread" passes
-- just as happily when it points at itself, which is the one thing this is
-- testing. Found by breaking it.
insert into public.club_discussion_posts
  (club_id, author_profile_id, category, title, content)
  select id, 'e0000000-0000-0000-0000-000000000003', 'General', 'Decoy thread',
         'Nobody reported this one.' from c;
insert into public.club_discussion_posts
  (club_id, author_profile_id, category, title, content)
  select id, 'e0000000-0000-0000-0000-000000000003', 'General', 'Terrain night',
         'Bring your own hills.' from c;
insert into public.club_discussion_replies (post_id, author_profile_id, content)
  select id, 'e0000000-0000-0000-0000-000000000003', 'I have three.'
    from public.club_discussion_posts where title = 'Terrain night';

insert into public.club_event_board_posts (event_id, author_profile_id, title, content)
  select fresh, 'e0000000-0000-0000-0000-000000000003', 'Decoy event thread',
         'Nobody reported this either.' from ev;
insert into public.club_event_board_posts (event_id, author_profile_id, title, content)
  select fresh, 'e0000000-0000-0000-0000-000000000003', 'Rules pack?',
         'Where is it.' from ev;
insert into public.club_event_board_replies (post_id, author_profile_id, content)
  select id, 'e0000000-0000-0000-0000-000000000003', 'Pinned on the board.'
    from public.club_event_board_posts where title = 'Rules pack?';

insert into public.club_reviews (club_id, author_profile_id, author_name, rating, comment)
  select id, 'e0000000-0000-0000-0000-000000000003', 'Member Eight', 2,
         'The hall was cold.' from c;

insert into public.club_messages (club_id, sender_id, recipient_id, content)
  select id, 'e0000000-0000-0000-0000-000000000003',
         'e0000000-0000-0000-0000-000000000001', 'Private words.' from c;

-- Addressed by what they say, not by `limit 1`: the decoys above would win it.
create temp table thing as select
  (select id from public.club_discussion_posts where title = 'Terrain night') as post,
  (select id from public.club_discussion_replies
    where content = 'I have three.') as reply,
  (select id from public.club_event_board_posts where title = 'Rules pack?') as epost,
  (select id from public.club_event_board_replies
    where content = 'Pinned on the board.') as ereply,
  (select id from public.club_reviews limit 1) as review,
  (select id from public.club_messages limit 1) as message;

-- Flags, written straight in: `flag_content` is tested by its own suite and
-- what is under test here is what the queue hands back, not who may file one.
-- Dated apart so "longest waiting" and "newest first" are different answers.
insert into public.moderation_flags
  (target_type, target_id, club_id, flagged_by, reason, status, created_at)
  select 'post', thing.post, c.id, 'e0000000-0000-0000-0000-000000000004',
         'Oldest one.', 'open', now() - interval '10 days' from thing, c;
insert into public.moderation_flags
  (target_type, target_id, club_id, flagged_by, reason, status, created_at)
  select 'reply', thing.reply, c.id, 'e0000000-0000-0000-0000-000000000004',
         'Middle one.', 'open', now() - interval '5 days' from thing, c;
insert into public.moderation_flags
  (target_type, target_id, club_id, flagged_by, reason, status, created_at)
  select 'event_reply', thing.ereply, c.id, 'e0000000-0000-0000-0000-000000000004',
         'Newest open one.', 'open', now() - interval '1 hour' from thing, c;
insert into public.moderation_flags
  (target_type, target_id, club_id, flagged_by, reason, status, created_at)
  select 'message', thing.message, c.id, 'e0000000-0000-0000-0000-000000000004',
         'A message.', 'open', now() - interval '2 days' from thing, c;
insert into public.moderation_flags
  (target_type, target_id, club_id, flagged_by, reason, status, created_at)
  select 'review', thing.review, c.id, 'e0000000-0000-0000-0000-000000000004',
         'A review.', 'open', now() - interval '3 days' from thing, c;
-- Answered, and the most recent thing that happened. "Newest first" has to
-- lead with it; "longest waiting" has to put it last.
insert into public.moderation_flags
  (target_type, target_id, club_id, flagged_by, reason, status, resolution,
   resolved_by, resolved_at, created_at)
  select 'event_post', thing.epost, c.id, 'e0000000-0000-0000-0000-000000000004',
         'Answered already.', 'dismissed', 'Fine as it is.',
         'e0000000-0000-0000-0000-000000000002', now(), now() - interval '1 minute'
    from thing, c;

do $$
declare
  w record; v_fresh bigint; v_soon bigint; t record;
  v_titles text[]; v_reasons text[]; v_ctx bigint; v_key text; v_to text;
begin
  select * into w from who;
  select soon, fresh into v_soon, v_fresh from ev;
  select * into t from thing;

  -- ------------------------------------------------ the events list

  perform set_config('request.jwt.claims',
    json_build_object('sub', w.admin, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 1 · Newest first means most recently put up, not the latest start date.
  --     The fixture is built so the two disagree.
  select array_agg(title order by ord) into v_titles from (
    select title, row_number() over () as ord
      from public.admin_events('', '', 'upcoming', 'newest', 25, 0)) q;
  reset role;
  if v_titles[1] <> 'Put Up This Morning' then
    raise exception 'FAIL 1: newest first led with % (%)', v_titles[1], v_titles;
  end if;

  -- 2 · And by date still counts forwards on Upcoming, so this Saturday leads
  --     and the one in ten months does not.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select array_agg(title order by ord) into v_titles from (
    select title, row_number() over () as ord
      from public.admin_events('', '', 'upcoming', 'date', 25, 0)) q;
  reset role;
  if v_titles[1] <> 'Listed Months Ago' then
    raise exception 'FAIL 2: by date led with % (%)', v_titles[1], v_titles;
  end if;
  if v_titles[array_length(v_titles, 1)] <> 'Furthest Away' then
    raise exception 'FAIL 3: the furthest event is not last by date (%)', v_titles;
  end if;

  -- 3 · The five-argument version is gone, so nothing can quietly keep
  --     ordering by date after forgetting to pass the sort.
  if to_regprocedure('public.admin_events(text, text, text, integer, integer)')
     is not null then
    raise exception 'FAIL 4: the old admin_events signature is still callable';
  end if;

  -- -------------------------------------------- the moderation queue

  -- 4 · Longest waiting is unchanged: open first, oldest of them leading, and
  --     the answered one last however recently it was answered.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select array_agg(reason order by ord) into v_reasons from (
    select reason, row_number() over () as ord
      from public.moderation_queue('', '', '', 'waiting', 25, 0)) q;
  reset role;
  if v_reasons[1] <> 'Oldest one.' then
    raise exception 'FAIL 5: longest waiting led with % (%)', v_reasons[1], v_reasons;
  end if;
  if v_reasons[array_length(v_reasons, 1)] <> 'Answered already.' then
    raise exception 'FAIL 6: the answered report is not last (%)', v_reasons;
  end if;

  -- 5 · Newest first leads with what came in last, answered included: the
  --     question it answers is "what has happened", not "what is owed".
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select array_agg(reason order by ord) into v_reasons from (
    select reason, row_number() over () as ord
      from public.moderation_queue('', '', '', 'newest', 25, 0)) q;
  reset role;
  if v_reasons[1] <> 'Answered already.' then
    raise exception 'FAIL 7: newest first led with % (%)', v_reasons[1], v_reasons;
  end if;
  if v_reasons[array_length(v_reasons, 1)] <> 'Oldest one.' then
    raise exception 'FAIL 8: the ten-day-old report is not last (%)', v_reasons;
  end if;

  -- 6 · A board post opens its own thread.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select context_id, event_key into v_ctx, v_key
    from public.moderation_queue('post', '', '', 'waiting', 25, 0);
  reset role;
  if v_ctx is distinct from t.post then
    raise exception 'FAIL 9: a post points at % rather than itself (%)', v_ctx, t.post;
  end if;
  if coalesce(v_key, 'x') <> '' then
    raise exception 'FAIL 10: a club board post carries an event key (%)', v_key;
  end if;

  -- 7 · A reply opens its PARENT, which is the whole point: a reply has no
  --     page of its own and the thread is the context.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select context_id into v_ctx
    from public.moderation_queue('reply', '', '', 'waiting', 25, 0);
  reset role;
  if v_ctx is distinct from t.post then
    raise exception 'FAIL 11: a reply points at % rather than its thread (%)',
      v_ctx, t.post;
  end if;

  -- 8 · An event reply carries its thread AND the event's own URL key, which
  --     is the half a club board item does not need.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select context_id, event_key into v_ctx, v_key
    from public.moderation_queue('event_reply', '', '', 'waiting', 25, 0);
  reset role;
  if v_ctx is distinct from t.epost then
    raise exception 'FAIL 12: an event reply points at % rather than % ', v_ctx, t.epost;
  end if;
  if v_key <> 'new-listed-later' then
    raise exception 'FAIL 13: the event key is % rather than its legacy id', v_key;
  end if;

  -- 9 · A review has no thread. The club page is where it is read and the
  --     caller builds that from the slug it already has.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select context_id, sent_to into v_ctx, v_to
    from public.moderation_queue('review', '', '', 'waiting', 25, 0);
  reset role;
  if v_ctx is not null then
    raise exception 'FAIL 14: a review carries a thread id (%)', v_ctx;
  end if;
  if coalesce(v_to, 'x') <> '' then
    raise exception 'FAIL 15: a review carries a recipient (%)', v_to;
  end if;

  -- 10 · A message has no thread either, and gets the recipient instead. There
  --      is no screen that shows somebody else's conversation, so a link would
  --      have to point at something this site does not have.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select context_id, sent_to into v_ctx, v_to
    from public.moderation_queue('message', '', '', 'waiting', 25, 0);
  reset role;
  if v_ctx is not null then
    raise exception 'FAIL 16: a message carries a thread id (%)', v_ctx;
  end if;
  if v_to <> 'Owner Eight' then
    raise exception 'FAIL 17: the message recipient reads % rather than the name', v_to;
  end if;

  -- 11 · The club's own queue answers the same way, because one component
  --      draws both and a context link that worked on one screen and not the
  --      other is the drift these two functions exist to avoid.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select context_id, event_key into v_ctx, v_key
    from public.club_moderation_queue(
      (select id from c), 'event_reply', '', '', 'waiting', 25, 0);
  reset role;
  if v_ctx is distinct from t.epost or v_key <> 'new-listed-later' then
    raise exception 'FAIL 18: the club queue gives % / % ', v_ctx, v_key;
  end if;

  -- 12 · And it sorts both ways too.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select array_agg(reason order by ord) into v_reasons from (
    select reason, row_number() over () as ord
      from public.club_moderation_queue((select id from c), '', '', '', 'newest', 25, 0)) q;
  reset role;
  if v_reasons[1] <> 'Answered already.' then
    raise exception 'FAIL 19: the club queue newest led with % (%)',
      v_reasons[1], v_reasons;
  end if;

  -- 13 · A review never reaches the club's queue, which 0128 decided and this
  --      had better not have changed: a club ruling on a bad review of itself
  --      is the conflict of interest the split exists for.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if exists (select 1 from public.club_moderation_queue(
               (select id from c), 'review', '', '', 'waiting', 25, 0)) then
    reset role;
    raise exception 'FAIL 20: a review reached the club''s own queue';
  end if;
  reset role;

  -- 14 · Both old signatures are gone.
  if to_regprocedure('public.moderation_queue(text, text, text, integer, integer)')
     is not null then
    raise exception 'FAIL 21: the old moderation_queue signature is still callable';
  end if;
  if to_regprocedure(
       'public.club_moderation_queue(bigint, text, text, text, integer, integer)')
     is not null then
    raise exception 'FAIL 22: the old club_moderation_queue signature is still callable';
  end if;
end $$;

rollback;
\echo '0189 newest and context: all pass'
