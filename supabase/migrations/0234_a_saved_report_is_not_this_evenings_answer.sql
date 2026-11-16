-- 0234 · a saved report is not this evening's answer
--
-- The client, by email: "AI features are also still not working... Please can
-- you test the AI features and ensure it runs new analysis, as currently it
-- does not run new analysis and only shows old analysis from October."
--
-- There is no fault in the provider call and nothing wrong with the key. What
-- happens is this. 0147 caches a run on the list's signature, which is right
-- and is legacy's own behaviour (club_store.py:7261): pressing Coach twice on
-- a list nobody has touched hands back the first report and consumes nothing.
--
-- The coaching screen opens on that saved report, says when it was written and
-- offers "Run it again", so a reader can see what they are looking at. The
-- match-up and scouting screens cannot: the question is the list AND the
-- opponent, and the opponent is not known until somebody picks one, so both
-- pages pass `initial={null}` and the button reads "Plan this match-up". Press
-- it, and `start_ai_job` quietly answers with a report from 17 October.
--
-- From the client's side that is a feature that does not work. They asked a
-- question tonight and were handed last month's answer with nothing on the
-- screen saying so.
--
-- Two things are wrong and this is the first: the cache has no age. A cache
-- exists so that pressing a button twice is not charged twice, and that is a
-- question of minutes and hours. A month later the model has moved, the
-- member's own record has moved, and the meta they are being read against has
-- moved. The window is a day, which is deliberately the same rolling window
-- `ai_usage_window` counts the allowance over: inside it you cannot be charged
-- twice for the same question, and when the allowance comes back so does the
-- question.
--
-- The second half is on the screen and is in `AiPanel`: a cached answer now
-- says it is one.
--
-- Checked on a throwaway Postgres built from every migration with
-- supabase/tests/stage13-a-saved-report-has-an-age.sql.

begin;

create or replace function public.start_ai_job(
  p_club bigint, p_feature text, p_signature text default '',
  p_source jsonb default '{}', p_payload jsonb default '{}',
  p_force boolean default false
) returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_cached public.army_ai_jobs%rowtype;
  v_window record; v_cap numeric; v_spent numeric; v_id bigint;
begin
  perform public.ai_feature_allowed(p_club, p_feature);

  if not p_force and btrim(coalesce(p_signature, '')) <> '' then
    select * into v_cached from public.army_ai_jobs j
     where j.club_id = p_club and j.profile_id = auth.uid()
       and j.feature = p_feature and j.status = 'succeeded'
       and j.source_signature = p_signature
       -- The age. Without it a press tonight is answered with last month's
       -- report and nothing says so.
       and j.created_at >= now() - interval '1 day'
     order by j.created_at desc limit 1;
    if v_cached.id is not null then
      return jsonb_build_object('jobId', v_cached.id, 'cached', true,
                                'status', 'succeeded');
    end if;
  end if;

  select * into v_window from public.ai_usage_window(p_club, p_feature);
  if v_window.allowed > 0 and coalesce(v_window.remaining, 0) <= 0 then
    raise exception 'AI_LIMIT' using errcode = 'insufficient_privilege',
      hint = coalesce(v_window.next_available_at::text, '');
  end if;

  select coalesce(s.monthly_ai_cap_pence, 0) into v_cap
    from public.club_army_builder_settings s where s.club_id = p_club;
  if coalesce(v_cap, 0) > 0 then
    v_spent := public.ai_month_spend(p_club);
    if v_spent >= v_cap then
      raise exception 'AI_CLUB_CAP' using errcode = 'insufficient_privilege',
        hint = v_spent::text;
    end if;
  end if;

  -- The unique index refuses a second run while one is in flight; this turns
  -- that into a code the screen can say something useful about.
  begin
    insert into public.army_ai_jobs (
      club_id, profile_id, feature, source_signature, source, request_payload)
    values (p_club, auth.uid(), p_feature, coalesce(p_signature, ''),
            coalesce(p_source, '{}'::jsonb), coalesce(p_payload, '{}'::jsonb))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'AI_IN_FLIGHT' using errcode = 'insufficient_privilege';
  end;

  return jsonb_build_object('jobId', v_id, 'cached', false, 'status', 'queued');
end $$;

/**
 * The last report for a question, however old.
 *
 * `start_ai_job` no longer hands one back after a day, and a screen still
 * wants to open on it: a report somebody spent a run on should be there the
 * next time they look rather than needing to be paid for again. That is a
 * different question from "does this answer a press", so it is a different
 * function, and the match-up and scouting screens are what need it — they
 * could never look it up, because the opponent is not known until it is
 * picked.
 */
create or replace function public.latest_ai_job(
  p_club bigint, p_feature text, p_signature text
) returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select j.id from public.army_ai_jobs j
   where j.club_id = p_club and j.profile_id = auth.uid()
     and j.feature = p_feature and j.status = 'succeeded'
     and j.source_signature = coalesce(p_signature, '')
   -- The id breaks the tie in the same direction the sort runs. Two runs
   -- inside one transaction share a timestamp, and "the latest" has to be one
   -- of them rather than whichever the planner reaches first; 0130 learned
   -- this the same way, from a test whose fixtures were written in one go.
   order by j.created_at desc, j.id desc
   limit 1
$$;

revoke all on function public.latest_ai_job(bigint, text, text)
  from public, anon;
grant execute on function public.latest_ai_job(bigint, text, text)
  to authenticated;

commit;
