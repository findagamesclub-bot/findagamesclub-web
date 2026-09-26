-- 0114 · Somebody sees their own club in the directory and it is not theirs
--
-- Nothing like this exists in legacy. The directory was imported and only two
-- clubs have an owner; the rest are pages about real clubs that none of those
-- clubs can touch. Somebody in Leeds finding their club listed with the wrong
-- night on it has, today, no move at all.
--
-- `claimable` is the flag, and it is deliberately not "has no owner". An
-- unowned club is not automatically up for grabs: the client may be listing it
-- on a club's behalf, or an owner may have stood down while the club still
-- runs. An admin says which listings are open to claim.
--
-- A claim is a request, so it works like the other request in this app: one
-- open per person per club, an admin answers it with a reason, and approving
-- hands over the club and closes the rest. The wording and the shape follow
-- `club_submissions` on purpose, because an admin should not have to learn two
-- queues.
--
-- Checked on a throwaway Postgres: a member claims a claimable club; the same
-- person cannot claim it twice while one is open; a club that is not claimable
-- refuses; approving makes them the owner, clears the flag and declines every
-- other open claim on that club; declining keeps the club as it was; a stranger
-- reads nobody else's claim; and every admin is told when one arrives.

alter table public.clubs
  add column if not exists claimable boolean not null default false;

comment on column public.clubs.claimable is
  'An admin has opened this listing to being claimed. Not the same as having no owner.';

-- Admin-only, like `spotlight` and `status`. A club that could set its own
-- claimable flag could invite somebody to take it.
revoke update (claimable) on public.clubs from authenticated, anon;

create index if not exists clubs_claimable_idx
  on public.clubs (claimable) where claimable;

create table if not exists public.club_claims (
  id            bigint generated always as identity primary key,

  club_id       bigint not null references public.clubs (id) on delete cascade,
  claimant_id   uuid not null default auth.uid()
                  references public.profiles (id) on delete cascade,

  status        text not null default 'open'
                  check (status in ('open', 'approved', 'declined', 'withdrawn')),

  -- Why it is theirs, and anything that shows it. Free text: a club secretary
  -- proving they run a club does it in sentences, not in fields.
  message       text not null default '',
  evidence      text not null default '',

  decided_at    timestamptz,
  decided_by    uuid references public.profiles (id) on delete set null,
  decision_note text not null default '',

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- One open claim per person per club. Somebody pressing the button twice is
-- not two claims, and an admin should not have to answer the same request
-- twice.
create unique index if not exists club_claims_one_open
  on public.club_claims (club_id, claimant_id) where status = 'open';

create index if not exists club_claims_queue_idx
  on public.club_claims (status, created_at);

alter table public.club_claims enable row level security;
revoke insert, update, delete on public.club_claims from authenticated, anon;
grant select on public.club_claims to authenticated;
grant insert (club_id, message, evidence) on public.club_claims to authenticated;

-- Their own, or an admin's. Not the club's: a claim is about whether the
-- current listing is in the right hands, and showing it to whoever holds them
-- is how a claim gets answered before it is read.
drop policy if exists club_claims_read on public.club_claims;
create policy club_claims_read on public.club_claims
  for select to authenticated
  using (claimant_id = (select auth.uid()) or public.is_admin());

-- Claiming a club that is not open to claims is refused by the policy rather
-- than by a screen, because the screen is not what an attacker uses.
drop policy if exists club_claims_open on public.club_claims;
create policy club_claims_open on public.club_claims
  for insert to authenticated
  with check (
    claimant_id = (select auth.uid())
    and status = 'open'
    and exists (select 1 from public.clubs
                 where id = club_id and claimable and status = 'active')
  );

-- Withdrawing is the one move a claimant has, and only on their own open one.
drop policy if exists club_claims_withdraw on public.club_claims;
create policy club_claims_withdraw on public.club_claims
  for update to authenticated
  using (claimant_id = (select auth.uid()) and status = 'open')
  with check (claimant_id = (select auth.uid()) and status in ('open', 'withdrawn'));

grant update (status) on public.club_claims to authenticated;

create or replace function public.club_claims_stamp()
returns trigger language plpgsql security definer set search_path = public as $$
begin new.updated_at := now(); return new; end $$;

revoke all on function public.club_claims_stamp() from public, anon, authenticated;

drop trigger if exists club_claims_stamped on public.club_claims;
create trigger club_claims_stamped
  before update on public.club_claims
  for each row execute function public.club_claims_stamp();

/**
 * Hand the club over.
 *
 * Admin only. Clears `claimable`, because a club with an owner is not up for
 * grabs, and declines every other open claim on it: leaving them open would
 * have an admin answering requests about a club that now belongs to somebody.
 */
create or replace function public.approve_club_claim(p_claim bigint, p_note text default '')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_claim public.club_claims%rowtype;
  v_club  public.clubs%rowtype;
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  select * into v_claim from public.club_claims where id = p_claim for update;
  if v_claim.id is null then
    raise exception 'CLAIM_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  if v_claim.status <> 'open' then
    raise exception 'CLAIM_ALREADY_ANSWERED' using errcode = 'check_violation';
  end if;

  select * into v_club from public.clubs where id = v_claim.club_id for update;
  if v_club.id is null then
    raise exception 'CLUB_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  update public.clubs
     set owner_id = v_claim.claimant_id, claimable = false, updated_at = now()
   where id = v_claim.club_id;

  -- 0067 mirrors `owner_id` into `club_team`, so the team follows without this
  -- function knowing how. Kept as an upsert anyway for a database where the
  -- mirror has not run.
  insert into public.club_team (club_id, profile_id, role)
  values (v_claim.club_id, v_claim.claimant_id, 'owner')
  on conflict (club_id, profile_id) do update set role = 'owner';

  update public.club_claims
     set status = 'approved', decided_at = now(),
         decided_by = (select auth.uid()), decision_note = coalesce(p_note, '')
   where id = p_claim;

  -- Everybody else who asked for this club. Left open they would be an admin
  -- answering about a club that now has an owner.
  update public.club_claims
     set status = 'declined', decided_at = now(),
         decided_by = (select auth.uid()),
         decision_note = 'Somebody else claimed this club.'
   where club_id = v_claim.club_id and status = 'open' and id <> p_claim;

  return jsonb_build_object('club_id', v_club.id, 'slug', v_club.slug, 'name', v_club.name);
end $$;

revoke all on function public.approve_club_claim(bigint, text) from public, anon;
grant execute on function public.approve_club_claim(bigint, text) to authenticated;

create or replace function public.decline_club_claim(p_claim bigint, p_note text)
returns text
language plpgsql security definer set search_path = public as $$
declare v_claim public.club_claims%rowtype;
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  if btrim(coalesce(p_note, '')) = '' then
    raise exception 'CLAIM_NEEDS_REASON' using errcode = 'check_violation';
  end if;

  select * into v_claim from public.club_claims where id = p_claim for update;
  if v_claim.id is null then
    raise exception 'CLAIM_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  if v_claim.status <> 'open' then
    raise exception 'CLAIM_ALREADY_ANSWERED' using errcode = 'check_violation';
  end if;

  update public.club_claims
     set status = 'declined', decided_at = now(),
         decided_by = (select auth.uid()), decision_note = p_note
   where id = p_claim;

  return 'declined';
end $$;

revoke all on function public.decline_club_claim(bigint, text) from public, anon;
grant execute on function public.decline_club_claim(bigint, text) to authenticated;

/**
 * Tell the admins one arrived, and the claimant what was decided.
 *
 * A trigger, like every other notice in this app, so a claim made from a screen
 * nobody has built yet still reaches somebody.
 */
create or replace function public.club_claims_told()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_admin record;
  v_name  text;
begin
  select name into v_name from public.clubs where id = new.club_id;

  if tg_op = 'INSERT' then
    for v_admin in
      select id from public.profiles
       where role = 'admin' and coalesce(is_active, true)
         and id is distinct from new.claimant_id
    loop
      perform public.notify_person(
        v_admin.id, 'club-claim',
        'Somebody says ' || coalesce(v_name, 'a club') || ' is theirs',
        'Read what they sent and hand the club over, or turn it down.',
        '/admin/claims/' || new.id::text, 'club_claim', new.id::text);
    end loop;
    return new;
  end if;

  if new.status is not distinct from old.status then return new; end if;

  -- The ask is answered, so it stops asking. Same reasoning as 0105.
  update public.notifications
     set read_at = now()
   where kind = 'club-claim' and entity_type = 'club_claim'
     and entity_id = new.id::text and read_at is null;

  if new.status = 'approved' then
    perform public.notify_person(
      new.claimant_id, 'claim-approved',
      coalesce(v_name, 'The club') || ' is yours',
      'You can run it from the console now: your nights, your members, your events.',
      '/clubs/' || (select slug from public.clubs where id = new.club_id) || '/manage',
      'club_claim', new.id::text);
  elsif new.status = 'declined' and new.claimant_id is distinct from (select auth.uid()) then
    perform public.notify_person(
      new.claimant_id, 'claim-declined',
      'About your claim for ' || coalesce(v_name, 'that club'),
      coalesce(nullif(btrim(new.decision_note), ''), 'We could not hand this one over.'),
      '/clubs/' || (select slug from public.clubs where id = new.club_id),
      'club_claim', new.id::text);
  end if;

  return new;
end $$;

revoke all on function public.club_claims_told() from public, anon, authenticated;

drop trigger if exists club_claims_told on public.club_claims;
create trigger club_claims_told
  after insert or update of status on public.club_claims
  for each row execute function public.club_claims_told();

/**
 * An admin listing a club on its behalf.
 *
 * The other half of claiming: somebody has to put the unclaimed listing there
 * in the first place. Claimable by default, because a club the platform typed
 * in is exactly the kind a real organiser should be able to take over.
 */
create or replace function public.admin_create_club(
  p_name text, p_city text, p_claimable boolean default true
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_slug text;
  v_id   bigint;
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'CLUB_NEEDS_NAME' using errcode = 'check_violation';
  end if;
  if btrim(coalesce(p_city, '')) = '' then
    raise exception 'CLUB_NEEDS_CITY' using errcode = 'check_violation';
  end if;

  v_slug := public.generate_unique_club_slug(btrim(p_name), btrim(p_city));

  insert into public.clubs (slug, name, city, status, claimable)
  values (v_slug, btrim(p_name), btrim(p_city), 'active', coalesce(p_claimable, true))
  returning id into v_id;

  return jsonb_build_object('club_id', v_id, 'slug', v_slug, 'name', btrim(p_name));
end $$;

revoke all on function public.admin_create_club(text, text, boolean) from public, anon;
grant execute on function public.admin_create_club(text, text, boolean) to authenticated;

/**
 * Open an existing listing to being claimed, or close it again.
 *
 * `admin_create_club` sets the flag on a listing an admin types in, and for a
 * while that was the only way it could ever be set: the column is admin-only
 * and admin-only means nobody, since not even an admin holds a column grant on
 * it. Found by the behaviour test, which could not open an imported club.
 *
 * Closing it is the same function, because an admin who opens one by mistake
 * should not need a second thing to undo it.
 */
create or replace function public.admin_set_club_claimable(
  p_club bigint, p_claimable boolean
) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  select owner_id into v_owner from public.clubs where id = p_club;
  if not found then
    raise exception 'CLUB_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  -- A club with an owner is somebody's. Opening it to claims would be inviting
  -- a stranger to ask for a club that is already run, and the answer to a
  -- change of hands is `transfer_club_ownership`, not a claim.
  if coalesce(p_claimable, false) and v_owner is not null then
    raise exception 'CLUB_HAS_OWNER' using errcode = 'check_violation';
  end if;

  update public.clubs
     set claimable = coalesce(p_claimable, false), updated_at = now()
   where id = p_club;

  return coalesce(p_claimable, false);
end $$;

revoke all on function public.admin_set_club_claimable(bigint, boolean) from public, anon;
grant execute on function public.admin_set_club_claimable(bigint, boolean) to authenticated;

do $$
begin
  if exists (select 1 from information_schema.role_column_grants
              where table_name = 'clubs' and grantee = 'authenticated'
                and column_name = 'claimable'
                and privilege_type in ('INSERT', 'UPDATE')) then
    raise exception 'claimable must not be writable by a club';
  end if;

  if exists (select 1 from information_schema.role_table_grants
              where table_name = 'club_claims' and grantee = 'authenticated'
                and privilege_type = 'DELETE') then
    raise exception 'club_claims must not be deletable by a client';
  end if;
end $$;
