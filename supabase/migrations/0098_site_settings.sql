-- 0098 · The settings the site itself has
--
-- Legacy keeps three values in `app-settings.json`: a contact email, the terms
-- of use and the privacy policy, with an `updatedAt` beside them. That is the
-- whole file. This is the same three, as a one-row table an admin can edit.
--
-- The cookie text gets a column here even though nothing renders it yet. The
-- banner that needs it is Stage 12 work, and adding a column to a singleton
-- later is the same work as adding it now, while a second settings table when
-- the banner arrives would be a second place to look.
--
-- **Terms and privacy are seeded empty on purpose.** Legacy's stored value for
-- both is the literal string "this is sample text this is sample text ...".
-- Publishing that as a live Terms page is worse than the placeholder page the
-- site has today, so the mechanism is legacy's and the words are the client's
-- to write. Both pages fall back to their current placeholder while the
-- setting is empty.
--
-- Checked on a throwaway Postgres: a signed-out visitor reads the row; an
-- ordinary member's update affects zero rows; an admin's update lands and
-- stamps who did it; nobody can insert a second row or delete the first.

create table if not exists public.site_settings (
  -- One row, forever. The check is what makes that true rather than hoped for.
  id            smallint primary key default 1 check (id = 1),

  contact_email text not null default '',
  terms_md      text not null default '',
  privacy_md    text not null default '',
  cookies_md    text not null default '',

  updated_at    timestamptz not null default now(),
  updated_by    uuid references public.profiles (id) on delete set null
);

comment on table public.site_settings is
  'One row. Legacy app-settings.json: contact email, terms, privacy.';

insert into public.site_settings (id, contact_email)
values (1, 'hello@findagamesclub.co.uk')
on conflict (id) do nothing;

-- ------------------------------------------------------------------ stamping

-- `updated_at` and `updated_by` are not granted to anybody, so they cannot be
-- named by a caller and have to be set here.
create or replace function public.site_settings_stamp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.id         := 1;
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

revoke all on function public.site_settings_stamp() from public, anon, authenticated;

drop trigger if exists site_settings_stamped on public.site_settings;
create trigger site_settings_stamped
  before update on public.site_settings
  for each row execute function public.site_settings_stamp();

-- ------------------------------------------------------------------- access

alter table public.site_settings enable row level security;

-- Supabase grants `authenticated` the whole table on create. Revoke before
-- granting columns, or the column list is inert.
revoke insert, update, delete on public.site_settings from authenticated, anon;

-- The contact address and the legal text are on public pages, so the row is
-- readable by everybody including a signed-out visitor.
grant select on public.site_settings to anon, authenticated;
grant update (contact_email, terms_md, privacy_md, cookies_md)
  on public.site_settings to authenticated;

drop policy if exists site_settings_read on public.site_settings;
create policy site_settings_read on public.site_settings
  for select to anon, authenticated
  using (true);

-- No insert and no delete policy at all: one row exists and nothing may make a
-- second or remove it.
drop policy if exists site_settings_write on public.site_settings;
create policy site_settings_write on public.site_settings
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

do $$
declare bad boolean;
begin
  select bool_or(column_name is null) into bad from (
    select null::text as column_name from information_schema.role_table_grants
     where table_name = 'site_settings'
       and grantee = 'authenticated' and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
    union all
    select column_name from information_schema.role_column_grants
     where table_name = 'site_settings'
       and grantee = 'authenticated' and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
  ) g;
  if bad then
    raise exception 'site_settings carries a whole-table grant';
  end if;
end $$;
