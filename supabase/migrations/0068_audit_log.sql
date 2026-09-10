-- 0068 · Recent changes at a club
--
-- Three people can now change a club's settings, and the first question an
-- owner asks when something looks wrong is "who did that". Nothing recorded
-- it. This does, and the Team page reads it back as a plain list.
--
-- Two ways in, because neither alone is enough:
--
--  1. A row trigger, so a write that goes through an ordinary grant is caught
--     whether or not anybody remembered to log it. It stores only the keys
--     that actually changed, so an update of one field is one short row.
--  2. log_club_audit(), called by hand inside the definer functions that save
--     a whole section, because a trigger cannot know that nine updates to
--     club_sessions were one person reordering the schedule. Those functions
--     set app.audit_quiet first, so the trigger stays out of their way.

create table if not exists public.club_audit_log (
  id           bigint generated always as identity primary key,
  club_id      bigint not null references public.clubs (id) on delete cascade,
  actor_id     uuid references public.profiles (id) on delete set null,
  -- Kept as text as well as an id: an account can be deleted, and "someone"
  -- is a worse answer than the name that was true at the time.
  actor_name   text not null default '',
  entity_type  text not null,
  entity_id    text not null default '',
  action       text not null,
  before       jsonb,
  after        jsonb,
  changed_keys text[] not null default '{}',
  created_at   timestamptz not null default now()
);

-- The only read there is: this club, newest first.
create index if not exists club_audit_log_club_idx
  on public.club_audit_log (club_id, created_at desc);

alter table public.club_audit_log enable row level security;

create policy club_audit_log_select on public.club_audit_log
  for select to authenticated
  using (public.club_can(club_id, 'audit.view'));

revoke insert, update, delete on public.club_audit_log from authenticated, anon;
grant select on public.club_audit_log to authenticated;

-- ---------------------------------------------------------------------------
-- Writing an entry
-- ---------------------------------------------------------------------------

create or replace function public.log_club_audit(
  p_club bigint,
  p_entity text,
  p_entity_id text,
  p_action text,
  p_before jsonb default null,
  p_after jsonb default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := (select auth.uid());
  who text := '';
  keys text[] := '{}';
  new_id bigint;
begin
  if p_club is null then
    return null;
  end if;

  select coalesce(nullif(btrim(p.full_name), ''), '') into who
    from public.profiles p where p.id = actor;

  if p_before is not null and p_after is not null then
    select coalesce(array_agg(k order by k), '{}') into keys
      from jsonb_object_keys(p_before || p_after) as k
     where p_before -> k is distinct from p_after -> k;
  end if;

  insert into public.club_audit_log
    (club_id, actor_id, actor_name, entity_type, entity_id, action, before, after, changed_keys)
  values
    (p_club, actor, coalesce(who, ''), p_entity, coalesce(p_entity_id, ''),
     p_action, p_before, p_after, keys)
  returning id into new_id;

  return new_id;
end;
$$;

-- The generic trigger. tg_argv[0] names the column holding the club id, which
-- is 'id' on clubs itself and 'club_id' on everything hanging off it.
create or replace function public.club_audit_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  club_col text := coalesce(tg_argv[0], 'club_id');
  row_json jsonb;
  old_json jsonb;
  target bigint;
  keys text[] := '{}';
begin
  -- A save-a-whole-section function has already said what it did in one
  -- sentence. Its own row writes would only bury that.
  if coalesce(current_setting('app.audit_quiet', true), '') = 'on' then
    return coalesce(new, old);
  end if;

  row_json := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  old_json := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  target := (coalesce(row_json, old_json) ->> club_col)::bigint;

  if tg_op = 'UPDATE' then
    select coalesce(array_agg(k order by k), '{}') into keys
      from jsonb_object_keys(old_json || row_json) as k
     -- updated_at moves on every write and says nothing about what changed.
     where k <> 'updated_at' and old_json -> k is distinct from row_json -> k;

    if array_length(keys, 1) is null then
      return new;
    end if;

    -- Only the keys that moved, so a row of forty columns does not store
    -- forty of them twice to record one edit.
    old_json := (select jsonb_object_agg(k, old_json -> k) from unnest(keys) as k);
    row_json := (select jsonb_object_agg(k, row_json -> k) from unnest(keys) as k);
  end if;

  perform public.log_club_audit(
    target, tg_table_name,
    coalesce(row_json ->> 'id', old_json ->> 'id', ''),
    lower(tg_op), old_json, row_json);

  return coalesce(new, old);
end;
$$;

-- Attached to what Stage 1 can change. Every later stage attaches the same
-- trigger to the tables it opens up.
drop trigger if exists clubs_audit on public.clubs;
create trigger clubs_audit
  after update on public.clubs
  for each row execute function public.club_audit_row('id');

drop trigger if exists club_team_audit on public.club_team;
create trigger club_team_audit
  after insert or update or delete on public.club_team
  for each row execute function public.club_audit_row('club_id');

-- ---------------------------------------------------------------------------
-- Keeping it from growing for ever
-- ---------------------------------------------------------------------------

create or replace function public.prune_club_audit_log()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare removed integer;
begin
  delete from public.club_audit_log where created_at < now() - interval '24 months';
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.log_club_audit(bigint, text, text, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.club_audit_row() from public, anon, authenticated;
revoke all on function public.prune_club_audit_log() from public, anon, authenticated;

-- Guarded, so this still applies on a project without pg_cron.
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron is not enabled; prune-club-audit created but not scheduled';
    return;
  end if;

  perform cron.unschedule('prune-club-audit')
    where exists (select 1 from cron.job where jobname = 'prune-club-audit');

  perform cron.schedule(
    'prune-club-audit', '45 3 * * 0',
    $job$ select public.prune_club_audit_log(); $job$
  );
end;
$$;

do $$
declare bad text;
begin
  select string_agg(table_name, ', ') into bad
    from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'club_audit_log'
     and grantee in ('authenticated', 'anon')
     and privilege_type in ('INSERT', 'UPDATE', 'DELETE');
  if bad is not null then
    raise exception 'whole-table grant still present on %', bad;
  end if;
end $$;
