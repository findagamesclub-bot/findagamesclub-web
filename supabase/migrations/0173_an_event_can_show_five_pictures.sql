/**
 * An event's pictures, as a list.
 *
 * 0009 gave `club_events` one picture: `logo_src`, `logo_alt`, and `logo_path`
 * after 0087. A club running a weekender has a poster, a shot of the hall and
 * three of last year's tables, and could show exactly one of them. The client
 * asked for five.
 *
 * It is one list where the first is the hero, which is how `club_images`
 * already works for the club itself ("the first one becomes your header and
 * the picture on your card"). A club does not have to learn a second model,
 * and there is no second concept of "the main one" to keep in step with the
 * rest.
 *
 * `club_events.logo_src` / `logo_alt` / `logo_path` stay canonical and a
 * trigger mirrors position 0 onto them, so `eventArt`, the directory cards,
 * the console and anything in an email keep reading the column they always
 * read. Same move 0069 made with `clubs.owner_id` against `club_team`: nothing
 * that reads the old shape had to change.
 */

create table if not exists public.club_event_images (
  id bigint generated always as identity primary key,
  event_id bigint not null references public.club_events (id) on delete cascade,
  -- Beside `storage_path`, not instead of it, for the reason 0087 gives: an
  -- imported picture is an absolute URL to a file nobody here owns.
  src text not null default '',
  storage_path text,
  alt text not null default '',
  position smallint not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists club_event_images_event_idx
  on public.club_event_images (event_id, position);

-- ------------------------------------------------------------------ reading

alter table public.club_event_images enable row level security;

-- Two policies, because `club_can` is revoked from anon (0067): a single one
-- naming it fails every signed-out visitor with "permission denied for
-- function" rather than hiding a draft. Same split 0090 and 0091 made.
drop policy if exists club_event_images_public_anon on public.club_event_images;
create policy club_event_images_public_anon on public.club_event_images
  for select to anon
  using (exists (select 1 from public.club_events e
                  where e.id = event_id and e.status <> 'draft'));

drop policy if exists club_event_images_public on public.club_event_images;
create policy club_event_images_public on public.club_event_images
  for select to authenticated
  using (exists (select 1 from public.club_events e
                  where e.id = event_id
                    and (e.status <> 'draft'
                         or public.club_can(e.club_id, 'events.manage'))));

-- ------------------------------------------------------------------ writing

-- `create table` hands `authenticated` the whole table (0149 found REFERENCES,
-- TRIGGER and TRUNCATE riding along with it, and TRUNCATE ignores row
-- security). Everything off, then back only what a club may name.
revoke all on public.club_event_images from anon, authenticated;
grant select on public.club_event_images to anon, authenticated;
grant insert (event_id, src, storage_path, alt, "position")
  on public.club_event_images to authenticated;
grant update (src, storage_path, alt, "position")
  on public.club_event_images to authenticated;
grant delete on public.club_event_images to authenticated;

drop policy if exists club_event_images_write on public.club_event_images;
create policy club_event_images_write on public.club_event_images
  for all to authenticated
  using (exists (select 1 from public.club_events e
                  where e.id = event_id
                    and public.club_can(e.club_id, 'events.manage')))
  with check (exists (select 1 from public.club_events e
                       where e.id = event_id
                         and public.club_can(e.club_id, 'events.manage')));

-- Five, counted here rather than in the form. The form is where somebody is
-- told; this is what makes it true, which is what 0087 says about ten.
create or replace function public.club_event_images_cap()
returns trigger language plpgsql as $$
declare held integer;
begin
  select count(*) into held from public.club_event_images
   where event_id = new.event_id;
  if held >= 5 then raise exception 'TOO_MANY_EVENT_IMAGES'; end if;
  return new;
end $$;

drop trigger if exists club_event_images_cap on public.club_event_images;
create trigger club_event_images_cap
  before insert on public.club_event_images
  for each row execute function public.club_event_images_cap();

-- --------------------------------------------------------------- the mirror

/**
 * Position 0 onto the event's own columns.
 *
 * Every existing reader goes through `logo_src` / `logo_alt` / `logo_path`,
 * and there are a lot of them: `eventArt`, the directory card, the console
 * tile and the editor. Rewriting all of those to read a list would be a much
 * larger change than this feature deserves and would be the thing that broke.
 *
 * Fires on anything that can move which row is first, deletes included, so an
 * event whose only picture is taken off goes back to borrowing the club's.
 */
create or replace function public.club_event_images_mirror()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_event bigint; v_first record;
begin
  v_event := coalesce(new.event_id, old.event_id);

  select src, alt, storage_path into v_first
    from public.club_event_images
   where event_id = v_event
   order by "position", id
   limit 1;

  update public.club_events
     set logo_src = coalesce(v_first.src, ''),
         logo_alt = coalesce(v_first.alt, ''),
         logo_path = v_first.storage_path
   where id = v_event;

  return null;
end $$;

drop trigger if exists club_event_images_mirror on public.club_event_images;
create trigger club_event_images_mirror
  after insert or update or delete on public.club_event_images
  for each row execute function public.club_event_images_mirror();

-- ------------------------------------------------------------- the backfill

-- Whatever each event already had becomes its first picture, so nothing moves
-- on any page the day this runs. Quiet by nature: the mirror writes the same
-- values straight back.
insert into public.club_event_images (event_id, src, storage_path, alt, "position")
select e.id, coalesce(e.logo_src, ''), e.logo_path, coalesce(e.logo_alt, ''), 0
  from public.club_events e
 where (coalesce(e.logo_src, '') <> '' or coalesce(e.logo_path, '') <> '')
   and not exists (select 1 from public.club_event_images i where i.event_id = e.id);

do $$
declare v_bad boolean;
begin
  select bool_or(column_name is null) into v_bad from (
    select null::text as column_name from information_schema.role_table_grants
     where table_name = 'club_event_images' and grantee = 'authenticated'
       and privilege_type = 'INSERT'
    union all
    select column_name from information_schema.role_column_grants
     where table_name = 'club_event_images' and grantee = 'authenticated'
       and privilege_type = 'INSERT') g;
  if v_bad then
    raise exception 'club_event_images still carries a whole-table insert grant';
  end if;
end $$;

-- ---------------------------------------------------------------- the saver

/**
 * The whole list, replaced in one statement.
 *
 * Delete then insert, which cannot be two round trips from a service: the cap
 * refuses the re-insert if the delete has not landed, and a failure between
 * the two leaves an event with no pictures at all. 0168 paid for exactly this
 * with `save_event_team`.
 *
 * `or public.is_admin()`, because a site admin holds no `club_team` row and
 * `club_can` is false for them. Every new guard in this codebase needs it and
 * this is the third time it has been written down.
 */
create or replace function public.save_event_images(
  p_event bigint, p_images jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare v_club bigint; v_made integer;
begin
  select club_id into v_club from public.club_events where id = p_event;
  if v_club is null then raise exception 'EVENT_NOT_FOUND'; end if;

  if not (public.club_can(v_club, 'events.manage') or public.is_admin()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  if jsonb_array_length(coalesce(p_images, '[]'::jsonb)) > 5 then
    raise exception 'TOO_MANY_EVENT_IMAGES';
  end if;

  delete from public.club_event_images where event_id = p_event;

  insert into public.club_event_images (event_id, src, storage_path, alt, "position")
  select p_event,
         coalesce(shot ->> 'src', ''),
         nullif(coalesce(shot ->> 'path', ''), ''),
         left(coalesce(shot ->> 'alt', ''), 300),
         (ordinality - 1)::smallint
    from jsonb_array_elements(coalesce(p_images, '[]'::jsonb))
           with ordinality as t(shot, ordinality)
   -- A row with neither is a row nothing could render, which is what an
   -- upload that failed halfway leaves behind in the form.
   where coalesce(shot ->> 'src', '') <> '' or coalesce(shot ->> 'path', '') <> '';

  get diagnostics v_made = row_count;
  return v_made;
end $$;

revoke all on function public.save_event_images(bigint, jsonb) from public, anon;
grant execute on function public.save_event_images(bigint, jsonb) to authenticated;

-- --------------------------------------------------------------- the reader

/**
 * An event's pictures, in order.
 *
 * A function rather than a select, because `src/types/database.ts` has not
 * been regenerated and `npm run check:columns` is right to refuse a column the
 * schema it knows about does not have. Same shape the coaching list took for
 * the same reason.
 *
 * `security invoker`, so the two select policies above decide what comes back:
 * a draft's pictures stay the club's. A definer here would have to write those
 * two rules out a second time and would be the copy that drifted.
 */
create or replace function public.event_images_for(p_event bigint)
returns table (
  id bigint, src text, storage_path text, alt text, "position" smallint
) language sql stable security invoker set search_path = public as $$
  select i.id, i.src, i.storage_path, i.alt, i."position"
    from public.club_event_images i
   where i.event_id = p_event
   order by i."position", i.id;
$$;

grant execute on function public.event_images_for(bigint) to anon, authenticated;
