-- 0089 · A club can edit its own shop
--
-- The items have been read-only since Stage 7 imported them: there has never
-- been a way to add a shirt, change a price or retire something, only SQL.
-- 0088 gave them sizes; this gives somebody a way to set them.
--
-- `stock` is deliberately not writable. It is the sum of the item's sizes now,
-- kept by the trigger in 0088, and a club that could write it directly could
-- put the item and its sizes permanently out of step.

revoke insert, update, delete on public.club_merchandise_items from authenticated, anon;

drop policy if exists club_merchandise_items_write on public.club_merchandise_items;
create policy club_merchandise_items_write on public.club_merchandise_items
  for all to authenticated
  using (public.club_can(club_id, 'shop.manage'))
  with check (public.club_can(club_id, 'shop.manage'));

grant insert (club_id, legacy_id, name, category, description, image_src, image_alt,
              price, minimum_tier_key, active, position),
      update (name, category, description, image_src, image_alt,
              price, minimum_tier_key, active, position)
  on public.club_merchandise_items to authenticated;

grant delete on public.club_merchandise_items to authenticated;

do $$
declare bad boolean;
begin
  select bool_or(column_name is null) into bad from (
    select null::text as column_name from information_schema.role_table_grants
     where table_name = 'club_merchandise_items' and grantee = 'authenticated'
       and privilege_type in ('INSERT', 'UPDATE')
    union all
    select column_name from information_schema.role_column_grants
     where table_name = 'club_merchandise_items' and grantee = 'authenticated'
       and privilege_type in ('INSERT', 'UPDATE')
  ) g;
  if bad then
    raise exception 'club_merchandise_items carries a whole-table grant';
  end if;
end $$;
