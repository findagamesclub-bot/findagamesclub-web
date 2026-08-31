-- 0029 · Fix ambiguous parameter names in notify_person
--
-- 0027 named the arguments after the columns they are written to, so inside
-- the INSERT every one of them was ambiguous: PL/pgSQL could not tell the
-- parameter `kind` from the column `kind`. Every trigger that calls it failed,
-- which meant sending a message raised rather than delivering.
--
-- Dropped rather than replaced: Postgres will not rename the parameters of an
-- existing function. The triggers resolve it by name at run time, so they need
-- no change.

drop function if exists public.notify_person(uuid, text, text, text, text, text, text);

create or replace function public.notify_person(
  p_target uuid,
  p_kind text,
  p_title text,
  p_body text default '',
  p_href text default '',
  p_entity_type text default '',
  p_entity_id text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_target is null then
    return;
  end if;

  insert into public.notifications
    (profile_id, kind, title, body, href, entity_type, entity_id)
  values
    (p_target, p_kind, p_title, coalesce(p_body, ''), coalesce(p_href, ''),
     coalesce(p_entity_type, ''), coalesce(p_entity_id, ''))
  on conflict (profile_id, kind, entity_type, entity_id)
    where read_at is null and entity_id <> ''
  do update set
    title = excluded.title,
    body = excluded.body,
    created_at = now();
end;
$$;

revoke all on function public.notify_person(uuid, text, text, text, text, text, text)
  from public, anon, authenticated;
