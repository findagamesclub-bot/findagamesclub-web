-- 0086 · The three sections that need more than a policy
--
-- Club nights, membership tiers and discussion categories are all lists the
-- editor replaces wholesale. A policy can say who may write them; it cannot say
-- what must not be thrown away, and each of these has something.
--
--   club nights       are pointed at by bookings, the waiting list and
--                     looking-for-a-game posts. Deleting one would orphan a
--                     member's Thursday.
--   membership tiers  are named by key from four other tables. Removing a tier
--                     somebody holds leaves their membership pointing at
--                     nothing, and their price and their benefits with it.
--   categories        are named by *label* on every post filed under them, so a
--                     rename has to follow into the posts or the board empties.
--
-- Each takes the whole list and replaces it, so the caller must always send
-- everything it holds. That is the same shape as legacy, whose payload carries
-- the entire array every time.
--
-- What reserves a category to a tier is left where legacy keeps it: in the
-- tier's own `benefits -> privateDiscussionCategories`. The plan proposed
-- moving it onto the category as a `minimum_tier_key`, which reads better and
-- is a change for after M3.

-- ---------------------------------------------------------------- club nights

/**
 * Replace a club's nights.
 *
 * Rows with an id are updated in place, which is what keeps existing bookings
 * attached: `club_bookings` points at `club_sessions.id`, so a night that is
 * deleted and re-inserted takes everybody's booking with it even though the
 * text on screen never changed.
 */
create or replace function public.save_club_schedule(p_club bigint, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  keep bigint[];
  doomed record;
  written integer := 0;
begin
  if not public.club_can(p_club, 'listing.edit') then
    raise exception 'NOT_PERMITTED';
  end if;

  select coalesce(array_agg((r ->> 'id')::bigint), array[]::bigint[])
    into keep
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) as r
   where nullif(r ->> 'id', '') is not null;

  -- Refuse before writing anything, and name the night rather than the id: the
  -- person reading this is looking at a form, not at a database.
  for doomed in
    select s.id, s.day, s.label,
           (select count(*) from public.club_bookings b
             where b.club_session_id = s.id
               and b.session_date >= public.london_today()
               and b.status <> 'cancelled') as booked
      from public.club_sessions s
     where s.club_id = p_club and not (s.id = any (keep))
  loop
    if doomed.booked > 0 then
      raise exception 'SESSION_HAS_BOOKINGS: % (%) has % booking(s) still to come',
        doomed.label, doomed.day, doomed.booked;
    end if;
  end loop;

  delete from public.club_sessions
   where club_id = p_club and not (id = any (keep));

  -- Updated in place, keyed on the id, so the bookings hanging off it follow.
  update public.club_sessions s
     set day = r.day, time = r.time, label = r.label, position = r.pos
    from (
      select (r ->> 'id')::bigint as id,
             btrim(r ->> 'day') as day,
             btrim(r ->> 'time') as time,
             btrim(r ->> 'label') as label,
             (ord - 1)::smallint as pos
        from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) with ordinality as t(r, ord)
       where nullif(r ->> 'id', '') is not null
    ) as r
   where s.id = r.id and s.club_id = p_club;

  insert into public.club_sessions (club_id, day, time, label, position)
  select p_club, btrim(r ->> 'day'), btrim(r ->> 'time'), btrim(r ->> 'label'),
         (ord - 1)::smallint
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) with ordinality as t(r, ord)
   where nullif(r ->> 'id', '') is null;

  select count(*) into written from public.club_sessions where club_id = p_club;
  return written;
end;
$$;

-- ------------------------------------------------------------ membership tiers

/**
 * Replace a club's tiers.
 *
 * `tier_key` is the identity, not the label: memberships, ticket types and
 * merchandise all name a tier by key, and `membership-billing` scopes what
 * somebody has paid to the key they were on. So a renamed tier keeps its key,
 * and a tier anybody or anything still names cannot be removed at all.
 *
 * Legacy simply replaces its array and lets the reference dangle, which it can
 * afford because its tiers live inside the club's own JSON. Ours are a table
 * four others point at, so a dangling key is a member with no price and no
 * benefits. Refusing is the difference the schema forces.
 */
create or replace function public.save_club_tiers(p_club bigint, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  keep text[];
  doomed record;
begin
  if not public.club_can(p_club, 'listing.edit') then
    raise exception 'NOT_PERMITTED';
  end if;

  select coalesce(array_agg(btrim(r ->> 'tier_key')), array[]::text[])
    into keep
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) as r
   where nullif(btrim(r ->> 'tier_key'), '') is not null;

  for doomed in
    select t.tier_key, t.label,
           (select count(*) from public.club_memberships m
             where m.club_id = p_club
               and (m.tier_key = t.tier_key or m.requested_tier_key = t.tier_key)
               and m.status in ('pending', 'approved')) as members,
           (select count(*) from public.club_event_ticket_types tt
             join public.club_events e on e.id = tt.event_id
            where e.club_id = p_club and tt.minimum_tier_key = t.tier_key) as tickets,
           (select count(*) from public.club_merchandise_items i
            where i.club_id = p_club and i.minimum_tier_key = t.tier_key) as items
      from public.club_membership_tiers t
     where t.club_id = p_club and not (t.tier_key = any (keep))
  loop
    if doomed.members > 0 then
      raise exception 'TIER_IN_USE: % is held by % member(s)', doomed.label, doomed.members;
    end if;
    if doomed.tickets > 0 or doomed.items > 0 then
      raise exception 'TIER_IN_USE: % is required by something on sale', doomed.label;
    end if;
  end loop;

  delete from public.club_membership_tiers
   where club_id = p_club and not (tier_key = any (keep));

  insert into public.club_membership_tiers
    (club_id, tier_key, label, price, price_duration, description, tone,
     profile_flair, premium_badge_label, is_basic, position, benefits, billing_options)
  select p_club,
         btrim(r ->> 'tier_key'),
         btrim(r ->> 'label'),
         coalesce(r ->> 'price', ''),
         coalesce(r ->> 'price_duration', ''),
         nullif(btrim(coalesce(r ->> 'description', '')), ''),
         nullif(btrim(coalesce(r ->> 'tone', '')), ''),
         nullif(btrim(coalesce(r ->> 'profile_flair', '')), ''),
         nullif(btrim(coalesce(r ->> 'premium_badge_label', '')), ''),
         coalesce((r ->> 'is_basic')::boolean, false),
         (ord - 1)::smallint,
         coalesce(r -> 'benefits', '{}'::jsonb),
         coalesce(r -> 'billing_options', '[]'::jsonb)
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) with ordinality as t(r, ord)
  on conflict (club_id, tier_key) do update
    set label = excluded.label,
        price = excluded.price,
        price_duration = excluded.price_duration,
        description = excluded.description,
        tone = excluded.tone,
        profile_flair = excluded.profile_flair,
        premium_badge_label = excluded.premium_badge_label,
        is_basic = excluded.is_basic,
        position = excluded.position,
        benefits = excluded.benefits,
        billing_options = excluded.billing_options;

  return (select count(*) from public.club_membership_tiers where club_id = p_club);
end;
$$;

-- ------------------------------------------------------- discussion categories

/**
 * Replace a club's board categories.
 *
 * Posts name their category by label, so a rename is two writes: the category
 * and every post filed under the old name. A row carrying an id is a rename; a
 * row without one is new. Removing a category that still has posts is refused,
 * because the posts would keep a label the board no longer offers and drop out
 * of every filter.
 */
create or replace function public.save_club_discussion_categories(p_club bigint, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  keep bigint[];
  row_in record;
  doomed record;
begin
  if not public.club_can(p_club, 'listing.edit') then
    raise exception 'NOT_PERMITTED';
  end if;

  select coalesce(array_agg((r ->> 'id')::bigint), array[]::bigint[])
    into keep
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) as r
   where nullif(r ->> 'id', '') is not null;

  for doomed in
    select c.id, c.label,
           (select count(*) from public.club_discussion_posts p
             where p.club_id = p_club and p.category = c.label
               and p.removed_at is null) as posts
      from public.club_discussion_categories c
     where c.club_id = p_club and not (c.id = any (keep))
  loop
    if doomed.posts > 0 then
      raise exception 'CATEGORY_HAS_POSTS: % still has % post(s)', doomed.label, doomed.posts;
    end if;
  end loop;

  delete from public.club_discussion_categories
   where club_id = p_club and not (id = any (keep));

  -- One at a time, because a rename has to carry the posts with it and that
  -- needs the old label, which a set-based update has already overwritten.
  for row_in in
    select (r ->> 'id')::bigint as id,
           btrim(r ->> 'label') as label,
           (ord - 1)::smallint as pos
      from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) with ordinality as t(r, ord)
     where nullif(r ->> 'id', '') is not null
  loop
    update public.club_discussion_posts p
       set category = row_in.label
      from public.club_discussion_categories c
     where c.id = row_in.id and c.club_id = p_club
       and p.club_id = p_club and p.category = c.label
       and c.label <> row_in.label;

    update public.club_discussion_categories
       set label = row_in.label, position = row_in.pos
     where id = row_in.id and club_id = p_club;
  end loop;

  insert into public.club_discussion_categories (club_id, label, position)
  select p_club, btrim(r ->> 'label'), (ord - 1)::smallint
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) with ordinality as t(r, ord)
   where nullif(r ->> 'id', '') is null;

  return (select count(*) from public.club_discussion_categories where club_id = p_club);
end;
$$;

-- -------------------------------------------------------------------- grants

revoke all on function public.save_club_schedule(bigint, jsonb) from public, anon;
revoke all on function public.save_club_tiers(bigint, jsonb) from public, anon;
revoke all on function public.save_club_discussion_categories(bigint, jsonb) from public, anon;

grant execute on function public.save_club_schedule(bigint, jsonb) to authenticated;
grant execute on function public.save_club_tiers(bigint, jsonb) to authenticated;
grant execute on function public.save_club_discussion_categories(bigint, jsonb) to authenticated;
