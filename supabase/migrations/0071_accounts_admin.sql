-- 0071 · Suspending an account, and making the flag mean something
--
-- profiles.is_active has existed since 0001 and nothing has ever read it. No
-- policy mentions it and getCurrentProfile does not even select it, so an
-- admin ticking it off changed nothing at all.
--
-- Two halves make a suspension real. Supabase Auth refuses the sign-in and
-- revokes the sessions, which the server action does with the admin client.
-- This half stops the writes: a session that is still inside its access
-- token's lifetime carries a valid JWT, and without a check here it keeps
-- working until the token expires.
--
-- The gate goes into club_role_of() and is_club_member() rather than onto
-- thirty policies. Everything that asks "does this person run this club" or
-- "is this person in this club" is downstream of those two, so one check
-- closes the roster, the board, the bookings, the console and every guarded
-- write behind them. The four inserts that judge by row rather than by
-- function are named individually below.

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
     where p.id = (select auth.uid()) and p.is_active
  );
$$;

-- Suspended, you hold no role anywhere. An admin included: an admin account
-- that has been suspended is a suspended account.
create or replace function public.club_role_of(target_club bigint)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not public.is_active_user() then null
    when public.is_admin() then 'admin'
    else public.club_role_for(target_club, (select auth.uid()))
  end;
$$;

create or replace function public.is_club_member(target_club bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.club_role_of(target_club) is not null
      or (public.is_active_user() and exists (
        select 1 from public.club_memberships m
        where m.club_id = target_club
          and m.profile_id = (select auth.uid())
          and m.status = 'approved'
      ));
$$;

-- The writes that check a row rather than a club.
drop policy if exists club_memberships_apply on public.club_memberships;
create policy club_memberships_apply
  on public.club_memberships for insert to authenticated
  with check (profile_id = (select auth.uid()) and status = 'pending'
              and public.is_active_user());

drop policy if exists club_reviews_insert on public.club_reviews;
create policy club_reviews_insert on public.club_reviews
  for insert to authenticated
  with check (author_profile_id = (select auth.uid()) and public.is_active_user());

drop policy if exists club_reviews_update_own on public.club_reviews;
create policy club_reviews_update_own on public.club_reviews
  for update to authenticated
  using (author_profile_id = (select auth.uid()) and removed_at is null
         and public.is_active_user())
  with check (author_profile_id = (select auth.uid()));

drop policy if exists club_messages_insert on public.club_messages;
create policy club_messages_insert on public.club_messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.is_active_user()
    and public.can_message_member(club_id, recipient_id)
  );

-- ---------------------------------------------------------------------------
-- What an admin did, and why
-- ---------------------------------------------------------------------------

create table if not exists public.account_actions (
  id         bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  action     text not null check (action in ('suspended', 'restored', 'made_admin', 'removed_admin')),
  reason     text not null default '',
  actor_id   uuid references public.profiles (id) on delete set null,
  actor_name text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists account_actions_profile_idx
  on public.account_actions (profile_id, created_at desc);

alter table public.account_actions enable row level security;

-- Admins, and the person it happened to. Being told why you were suspended is
-- the difference between a decision and a disappearance.
create policy account_actions_select on public.account_actions
  for select to authenticated
  using (public.is_admin() or profile_id = (select auth.uid()));

revoke insert, update, delete on public.account_actions from authenticated, anon;
grant select on public.account_actions to authenticated;

create or replace function public.admin_set_account_active(
  p_profile uuid, p_active boolean, p_reason text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := (select auth.uid());
  who text := '';
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;
  -- Locking yourself out of the admin console is not a thing to make easy.
  if p_profile = actor then
    raise exception 'ACCOUNT_SELF' using errcode = 'check_violation';
  end if;

  select coalesce(nullif(btrim(p.full_name), ''), '') into who
    from public.profiles p where p.id = actor;

  update public.profiles set is_active = p_active where id = p_profile;
  if not found then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  insert into public.account_actions (profile_id, action, reason, actor_id, actor_name)
  values (p_profile,
          case when p_active then 'restored' else 'suspended' end,
          coalesce(btrim(p_reason), ''), actor, coalesce(who, ''));

  -- Clubs they own stay theirs. Ownership is a property question and this is a
  -- conduct one; taking the club away as a side effect of a suspension would
  -- strand its members.
  return p_profile;
end;
$$;

create or replace function public.admin_set_account_role(p_profile uuid, p_role text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := (select auth.uid());
  who text := '';
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;
  if p_profile = actor then
    raise exception 'ACCOUNT_SELF' using errcode = 'check_violation';
  end if;
  if p_role not in ('member', 'admin') then
    raise exception 'ACCOUNT_BAD_ROLE' using errcode = 'check_violation';
  end if;

  select coalesce(nullif(btrim(p.full_name), ''), '') into who
    from public.profiles p where p.id = actor;

  update public.profiles set role = p_role where id = p_profile;
  if not found then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  insert into public.account_actions (profile_id, action, reason, actor_id, actor_name)
  values (p_profile,
          case when p_role = 'admin' then 'made_admin' else 'removed_admin' end,
          '', actor, coalesce(who, ''));

  return p_profile;
end;
$$;

-- ---------------------------------------------------------------------------
-- Finding an account
-- ---------------------------------------------------------------------------

-- Email lives in auth.users, which no policy can reach, so the search has to
-- be a definer function rather than a query. It returns the page and the exact
-- total in one call: a table that cannot say how many rows it is showing you
-- part of is a table you cannot page through.
create or replace function public.admin_find_accounts(
  p_query text default '',
  p_status text default 'all',
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  full_name text,
  email text,
  role text,
  is_active boolean,
  created_at timestamptz,
  clubs_owned integer,
  memberships integer,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with allowed as (select public.is_admin() as ok),
  wanted as (select nullif(btrim(lower(coalesce(p_query, ''))), '') as q),
  matched as (
    select p.id, p.full_name, u.email::text as email, p.role, p.is_active, p.created_at
      from public.profiles p
      join auth.users u on u.id = p.id, allowed a, wanted w
     where a.ok
       and (w.q is null
            or lower(coalesce(p.full_name, '')) like '%' || w.q || '%'
            or lower(coalesce(u.email, '')) like '%' || w.q || '%')
       and (coalesce(p_status, 'all') = 'all'
            or (p_status = 'active' and p.is_active)
            or (p_status = 'suspended' and not p.is_active)
            or (p_status = 'admin' and p.role = 'admin'))
  ),
  counted as (select count(*) as n from matched)
  select m.id, m.full_name, m.email, m.role, m.is_active, m.created_at,
         (select count(*)::integer from public.clubs c where c.owner_id = m.id),
         (select count(*)::integer from public.club_memberships cm
           where cm.profile_id = m.id and cm.status = 'approved'),
         c.n
    from matched m, counted c
   order by m.created_at desc
   limit greatest(1, least(100, coalesce(p_limit, 25)))
  offset greatest(0, coalesce(p_offset, 0));
$$;

-- One account, with what it is attached to. Same admin gate.
create or replace function public.admin_account_detail(p_profile uuid)
returns table (
  id uuid, full_name text, email text, role text, is_active boolean,
  created_at timestamptz, last_sign_in_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, u.email::text, p.role, p.is_active, p.created_at, u.last_sign_in_at
    from public.profiles p
    join auth.users u on u.id = p.id
   where p.id = p_profile and public.is_admin();
$$;

revoke all on function public.is_active_user() from public, anon;
revoke all on function public.admin_set_account_active(uuid, boolean, text) from public, anon;
revoke all on function public.admin_set_account_role(uuid, text) from public, anon;
revoke all on function public.admin_find_accounts(text, text, integer, integer) from public, anon;
revoke all on function public.admin_account_detail(uuid) from public, anon;

grant execute on function public.is_active_user() to authenticated;
grant execute on function public.admin_set_account_active(uuid, boolean, text) to authenticated;
grant execute on function public.admin_set_account_role(uuid, text) to authenticated;
grant execute on function public.admin_find_accounts(text, text, integer, integer) to authenticated;
grant execute on function public.admin_account_detail(uuid) to authenticated;

do $$
declare bad text;
begin
  select string_agg(table_name, ', ') into bad
    from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'account_actions'
     and grantee in ('authenticated', 'anon')
     and privilege_type in ('INSERT', 'UPDATE', 'DELETE');
  if bad is not null then
    raise exception 'whole-table grant still present on %', bad;
  end if;
end $$;
