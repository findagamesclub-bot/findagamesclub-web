-- 0127 · the reporter's own side of a report.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage7-seed.sql

insert into public.club_reviews (club_id, author_profile_id, author_name, rating, comment)
  select id, 'd0000000-0000-0000-0000-000000000001', 'Owner Seven', 1,
         'This club is rubbish' from c;
insert into public.club_discussion_categories (club_id, label)
  select id, 'General' from c;
insert into public.club_discussion_posts (club_id, author_profile_id, category, title, content)
  select id, 'd0000000-0000-0000-0000-000000000001', 'General',
         'Read this', 'Abusive words in a board post' from c;

-- Captured as postgres before the role switch: read afterwards and RLS hides
-- them from a session with no `auth.uid()` yet, so every id comes back null.
create temp table ids as
  select (select id from public.club_reviews limit 1) as review,
         (select id from public.club_discussion_posts limit 1) as post;
grant select on ids to authenticated;

create or replace function pg_temp.notices(p_who uuid, p_kind text)
returns int language sql security definer as $fn$
  select count(*)::int from public.notifications
   where profile_id = p_who and kind = p_kind $fn$;

create or replace function pg_temp.notice(p_who uuid, p_kind text)
returns text language sql security definer as $fn$
  select body from public.notifications
   where profile_id = p_who and kind = p_kind order by id desc limit 1 $fn$;

-- Read as postgres, because a review's mirrored flag is on a table whose
-- select policy is not what this is asserting about.
create or replace function pg_temp.review_flagged(p_id bigint) returns boolean
language sql security definer as $fn$
  select flagged_at is not null from public.club_reviews where id = p_id $fn$;

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

set local role authenticated;

do $$
declare i record; w record; f bigint; f2 bigint; n int; j jsonb; t text; s text;
begin
  select * into w from who;
  select * into i from ids;

  -- ---------------------------------------------------------- one person's
  perform pg_temp.be(w.member);
  f := public.flag_content('review', i.review, 'rude about the club');
  assert f is not null, 'the member could not report the review';
  f2 := public.flag_content('post', i.post, 'abusive');

  select count(*) into n from public.my_reports('any');
  assert n = 2, 'the member sees ' || n || ' of their own reports, expected two';

  -- And nobody else's. The helper has reported nothing.
  perform pg_temp.be(w.helper);
  select count(*) into n from public.my_reports('any');
  assert n = 0, 'somebody who reported nothing sees ' || n || ' reports';
  raise notice 'PASS mine: a reporter sees their own and nobody else''s';

  -- ------------------------------------------------------------- the tabs
  perform pg_temp.be(w.member);
  j := public.my_report_counts();
  assert (j->>'all')::int = 2 and (j->>'open')::int = 2
     and (j->>'answered')::int = 0 and (j->>'withdrawn')::int = 0,
    'counts are wrong to start: ' || j::text;
  raise notice 'PASS counts: two waiting, nothing answered';

  -- ------------------------------------------------------- withdrawing it
  -- Somebody else's is not theirs to take back.
  perform pg_temp.be(w.helper);
  begin
    perform public.withdraw_moderation_flag(f2);
    raise exception 'NOT_REACHED';
  exception
    when others then
      assert sqlerrm like '%FLAG_NOT_FOUND%',
        'wrong error withdrawing somebody else''s: ' || sqlerrm;
      raise notice 'PASS withdraw: not yours to take back';
  end;

  perform pg_temp.be(w.member);
  assert pg_temp.review_flagged(i.review), 'reporting a review did not mirror the flag';
  assert public.withdraw_moderation_flag(f), 'the reporter could not withdraw';
  select status into s from public.my_reports('withdrawn');
  assert s = 'withdrawn', 'the withdrawn tab shows ' || coalesce(s, 'nothing');
  assert not pg_temp.review_flagged(i.review),
    'withdrawing the only report left the review flagged';
  raise notice 'PASS withdraw: the reporter can, and the review is unflagged';

  -- Twice is refused rather than silently accepted.
  begin
    perform public.withdraw_moderation_flag(f);
    raise exception 'NOT_REACHED';
  exception
    when others then
      assert sqlerrm like '%FLAG_NOT_FOUND%', 'wrong error on a second withdraw: ' || sqlerrm;
      raise notice 'PASS withdraw: once, not twice';
  end;

  -- Nobody is told about their own withdrawal.
  assert pg_temp.notices(w.member, 'report-answered') = 0,
    'withdrawing sent the reporter a notice';
  raise notice 'PASS quiet: taking your own report back tells nobody';

  -- --------------------------------------------------- out of the admin queue
  perform pg_temp.be(w.admin);
  select count(*) into n from public.moderation_queue('', 'answered', '');
  assert n = 0, 'a withdrawn report reached the admin Answered tab';
  -- The All tab holds the one still open and not the withdrawn one, so this
  -- counts rather than asserting an empty queue.
  select count(*) into n from public.moderation_queue('', '', '');
  assert n = 1, 'the admin All tab holds ' || n || ', expected only the open one';
  select target_type into t from public.moderation_queue('', '', '');
  assert t = 'post', 'the withdrawn review reached the admin All tab';
  raise notice 'PASS queue: a withdrawal is not work and not a decision';

  -- ------------------------------------------------------ told the outcome
  assert public.resolve_moderation_flag(f2, 'remove', 'Over the line.'),
    'the admin could not answer the open report';
  assert pg_temp.notices(w.member, 'report-answered') = 1,
    'the reporter was not told the outcome';
  t := pg_temp.notice(w.member, 'report-answered');
  assert t like '%board post%' and t like '%taken down%' and t like '%Over the line.%',
    'the notice does not say what happened: ' || t;
  raise notice 'PASS told: the reporter hears the outcome and the reason';

  -- The admin who answered it is not told about their own doing.
  assert pg_temp.notices(w.admin, 'report-answered') = 0,
    'the admin was told about a report they answered themselves';
  raise notice 'PASS self: the admin who decided hears nothing';

  -- --------------------------------------------------------- what it reads
  perform pg_temp.be(w.member);
  j := public.my_report_counts();
  assert (j->>'open')::int = 0 and (j->>'answered')::int = 1
     and (j->>'withdrawn')::int = 1,
    'counts after answering are wrong: ' || j::text;

  -- The words have gone with the post, and the row says so rather than
  -- reading as an empty report.
  select target_gone, status into n, s from (
    select target_gone::int, status from public.my_reports('answered')) q;
  assert n = 1 and s = 'actioned',
    'an answered report does not read as removed: gone=' || n || ' status=' || s;
  raise notice 'PASS reads: answered, removed, and the words are marked gone';

  -- ------------------------------------------------------------ 0130 filters
  -- The search reaches the words, the reason, the answer and the club.
  select count(*) into n from public.my_reports('any', '', 'Abusive');
  assert n = 1, 'searching the words found ' || n;
  select count(*) into n from public.my_reports('any', '', 'rude about');
  assert n = 1, 'searching my own reason found ' || n;
  select count(*) into n from public.my_reports('any', '', 'Over the line');
  assert n = 1, 'searching the answer found ' || n;
  select count(*) into n from public.my_reports('any', '', 'Badge Club');
  assert n = 2, 'searching the club name found ' || n;
  select count(*) into n from public.my_reports('any', '', 'nothing like this');
  assert n = 0, 'a search matching nothing found ' || n;
  raise notice 'PASS search: words, reason, answer and club all match';

  select count(*) into n from public.my_reports('any', 'review');
  assert n = 1, 'the kind filter found ' || n || ' reviews';
  select count(*) into n from public.my_reports('any', 'message');
  assert n = 0, 'a kind nothing was reported under found ' || n;
  raise notice 'PASS kind: the filter narrows to one sort of thing';

  -- Oldest first is the review, which was reported before the post.
  select target_type into s from public.my_reports('any', '', '', 'oldest', 1, 0);
  assert s = 'review', 'oldest first came out as ' || s;
  select target_type into s from public.my_reports('any', '', '', 'recent', 1, 0);
  assert s = 'post', 'newest first came out as ' || s;
  raise notice 'PASS sort: both orders hold';

  -- And the counts narrow with the same two, or the tabs lie about the list.
  j := public.my_report_counts('', 'Abusive');
  assert (j->>'all')::int = 1, 'the search did not narrow the counts: ' || j::text;
  j := public.my_report_counts('review', '');
  assert (j->>'all')::int = 1 and (j->>'withdrawn')::int = 1,
    'the kind did not narrow the counts: ' || j::text;
  j := public.my_report_counts();
  assert (j->>'all')::int = (j->>'open')::int + (j->>'answered')::int
                          + (j->>'withdrawn')::int,
    'the tabs do not add up: ' || j::text;
  raise notice 'PASS counts: they narrow with the search and the kind';

  -- ------------------------------------------------------------- the guard
  -- A valid claims blob with nobody in it, not an empty string: `auth.uid()`
  -- parses this GUC and an empty string is not JSON.
  perform set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  begin
    perform public.my_reports('any');
    raise exception 'NOT_REACHED';
  exception
    when insufficient_privilege then
      raise notice 'PASS guard: a session with nobody in it is refused';
    when others then raise exception 'wrong error for no session: %', sqlerrm;
  end;

  raise notice 'ALL PASS · 0127 my reports';
end $$;

rollback;
