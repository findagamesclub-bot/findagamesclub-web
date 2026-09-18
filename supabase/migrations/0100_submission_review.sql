-- 0100 · An admin working the submission queue
--
-- Three verbs. Legacy has one of them, `approve_submission` (club_store.py
-- ~12440), and this copies its rules: only a submission awaiting review can be
-- approved, the slug is generated from name and town with a numeric suffix on
-- collision, and the payload becomes a live club owned by whoever submitted it.
--
-- The other two, sending one back with a note and declining one with a reason,
-- have no legacy behaviour to copy. Legacy's admin can only approve, which is
-- why its status labels carry a `rejected` that nothing ever sets. Agreed with
-- the client as part of this stage.
--
-- Approving is one transaction on purpose. A club that appears in the directory
-- with a name and no games, because the second write failed, is worse than one
-- that did not appear at all.
--
-- The payload is read by **named key**, never copied wholesale into `clubs`.
-- The owner writes that jsonb themselves, so a blanket copy would be handing
-- them every column on the table, `spotlight` and `status` included.
--
-- Checked on a throwaway Postgres: a member can run none of the three; an admin
-- approves and the club appears with its games, nights, tiers and photos, owned
-- by the submitter and with a team row; a second club of the same name in the
-- same town gets `-2`; approving twice raises rather than making two clubs;
-- sending one back makes it editable again and submitting clears the note.

/**
 * A slug nothing else is using.
 *
 * Legacy's `_generate_unique_slug`: slugify "name-city", then append 2, 3, 4
 * until it is free. The suffix counts from 2 because the first one has no
 * number, which is the shape every existing club's slug already has.
 */
create or replace function public.generate_unique_club_slug(p_name text, p_city text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_base   text;
  v_slug   text;
  v_suffix integer := 2;
begin
  v_base := public.slugify(
    case when btrim(coalesce(p_city, '')) <> ''
      then btrim(p_name) || '-' || btrim(p_city)
      else btrim(p_name)
    end);

  -- `slugify` already falls back to 'club' on a name with nothing usable in it.
  v_slug := v_base;

  while exists (select 1 from public.clubs where lower(slug) = lower(v_slug)) loop
    v_slug   := v_base || '-' || v_suffix;
    v_suffix := v_suffix + 1;
  end loop;

  return v_slug;
end;
$$;

revoke all on function public.generate_unique_club_slug(text, text) from public, anon;
grant execute on function public.generate_unique_club_slug(text, text) to authenticated;

-- ------------------------------------------------------------- send it back

/**
 * Nearly right. Hand it back with a note saying what to fix.
 *
 * The note lands at the top of the builder when they reopen it, and is cleared
 * the moment they resubmit, so nobody reads a reviewer's old words as though
 * they still applied.
 */
create or replace function public.request_submission_changes(p_id bigint, p_note text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  if btrim(coalesce(p_note, '')) = '' then
    raise exception 'REVIEW_NEEDS_NOTE' using errcode = 'check_violation';
  end if;

  select status into v_status from public.club_submissions where id = p_id for update;

  if v_status is null then
    raise exception 'SUBMISSION_NOT_FOUND' using errcode = 'check_violation';
  end if;

  if v_status <> 'review_pending' then
    raise exception 'SUBMISSION_NOT_IN_REVIEW' using errcode = 'check_violation';
  end if;

  update public.club_submissions
     set status      = 'changes_requested',
         review_note = btrim(p_note),
         reviewed_at = now(),
         reviewed_by = (select auth.uid())
   where id = p_id;

  return 'changes_requested';
end;
$$;

revoke all on function public.request_submission_changes(bigint, text) from public, anon;
grant execute on function public.request_submission_changes(bigint, text) to authenticated;

-- ----------------------------------------------------------------- decline

create or replace function public.decline_club_submission(p_id bigint, p_reason text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  -- A refusal somebody cannot act on is a refusal they will email us about.
  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'DECLINE_NEEDS_REASON' using errcode = 'check_violation';
  end if;

  select status into v_status from public.club_submissions where id = p_id for update;

  if v_status is null then
    raise exception 'SUBMISSION_NOT_FOUND' using errcode = 'check_violation';
  end if;

  if v_status <> 'review_pending' then
    raise exception 'SUBMISSION_NOT_IN_REVIEW' using errcode = 'check_violation';
  end if;

  update public.club_submissions
     set status         = 'declined',
         decline_reason = btrim(p_reason),
         reviewed_at    = now(),
         reviewed_by    = (select auth.uid())
   where id = p_id;

  return 'declined';
end;
$$;

revoke all on function public.decline_club_submission(bigint, text) from public, anon;
grant execute on function public.decline_club_submission(bigint, text) to authenticated;

-- ----------------------------------------------------------------- approve

/**
 * Make it a club.
 *
 * Everything the five steps collected, in one transaction. The children go in
 * through the Stage 2 section savers rather than by hand, so a submitted club
 * and an edited club are normalised by the same code: `club_role_of` returns
 * 'admin' for a site admin, which is what lets this call functions guarded by
 * `club_can(club, 'listing.edit')` on a club the admin has no team row for.
 *
 * Returns what the caller needs to send an email and redirect: the new id, its
 * slug and its name.
 */
create or replace function public.approve_club_submission(p_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row     public.club_submissions%rowtype;
  v_club    jsonb;
  v_slug    text;
  v_id      bigint;
  v_name    text;
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  select * into v_row from public.club_submissions where id = p_id for update;

  if v_row.id is null then
    raise exception 'SUBMISSION_NOT_FOUND' using errcode = 'check_violation';
  end if;

  if v_row.status <> 'review_pending' then
    raise exception 'SUBMISSION_NOT_IN_REVIEW' using errcode = 'check_violation';
  end if;

  v_club := coalesce(v_row.payload -> 'club', '{}'::jsonb);
  v_name := btrim(coalesce(v_club ->> 'name', v_row.club_name));

  if v_name = '' then
    raise exception 'SUBMISSION_NEEDS_NAME' using errcode = 'check_violation';
  end if;

  v_slug := public.generate_unique_club_slug(v_name, coalesce(v_club ->> 'city', v_row.city));

  -- Named columns only. The owner wrote this jsonb, so anything not listed here
  -- is something they do not get to set.
  insert into public.clubs (
    slug, name, city, neighbourhood, summary, description,
    venue_name, venue_address, venue_postcode,
    website_url, contact_email, ages, member_count, tables_available,
    owner_id, status, geocode_stale
  ) values (
    v_slug,
    v_name,
    btrim(coalesce(v_club ->> 'city', v_row.city)),
    nullif(btrim(coalesce(v_club ->> 'neighbourhood', '')), ''),
    nullif(btrim(coalesce(v_club ->> 'summary', '')), ''),
    nullif(btrim(coalesce(v_club ->> 'description', '')), ''),
    nullif(btrim(coalesce(v_club ->> 'venue_name', '')), ''),
    nullif(btrim(coalesce(v_club ->> 'venue_address', '')), ''),
    nullif(btrim(coalesce(v_club ->> 'venue_postcode', '')), ''),
    nullif(btrim(coalesce(v_club ->> 'website_url', '')), ''),
    nullif(btrim(coalesce(v_club ->> 'contact_email', '')), ''),
    nullif(btrim(coalesce(v_club ->> 'ages', '')), ''),
    nullif(v_club ->> 'member_count', '')::integer,
    nullif(v_club ->> 'tables_available', '')::integer,
    v_row.owner_id,
    'active',
    -- The postcode has never been geocoded, so the nightly job has to place it.
    true
  )
  returning id into v_id;

  -- The four vocabularies, through the same saver the listing editor uses, so
  -- a submitted club's games are upserted into the shared list exactly as an
  -- edited club's are.
  perform public.save_club_taxonomy(v_id, 'formats',
    coalesce((select array_agg(value #>> '{}') from jsonb_array_elements(v_row.payload -> 'formats')), array[]::text[]));
  perform public.save_club_taxonomy(v_id, 'games',
    coalesce((select array_agg(value #>> '{}') from jsonb_array_elements(v_row.payload -> 'games')), array[]::text[]));
  perform public.save_club_taxonomy(v_id, 'facilities',
    coalesce((select array_agg(value #>> '{}') from jsonb_array_elements(v_row.payload -> 'facilities')), array[]::text[]));
  perform public.save_club_taxonomy(v_id, 'payment_methods',
    coalesce((select array_agg(value #>> '{}') from jsonb_array_elements(v_row.payload -> 'payment_methods')), array[]::text[]));

  if jsonb_typeof(v_row.payload -> 'sessions') = 'array' then
    perform public.save_club_schedule(v_id, v_row.payload -> 'sessions');
  end if;

  if jsonb_typeof(v_row.payload -> 'tiers') = 'array' then
    perform public.save_club_tiers(v_id, v_row.payload -> 'tiers');
  end if;

  if jsonb_typeof(v_row.payload -> 'categories') = 'array' then
    perform public.save_club_discussion_categories(v_id, v_row.payload -> 'categories');
  end if;

  -- The four plain lists. Ordered by their position in the payload, which is
  -- the order the club dragged them into.
  insert into public.club_social_links (club_id, label, url, position)
  select v_id, btrim(r ->> 'label'), btrim(r ->> 'url'), (i - 1)::integer
    from jsonb_array_elements(coalesce(v_row.payload -> 'social_links', '[]'::jsonb))
      with ordinality as t(r, i)
   where btrim(coalesce(r ->> 'url', '')) <> '';

  insert into public.club_pricing_models (club_id, label, price, notes, position)
  select v_id, btrim(r ->> 'label'), btrim(coalesce(r ->> 'price', '')),
         btrim(coalesce(r ->> 'notes', '')), (i - 1)::integer
    from jsonb_array_elements(coalesce(v_row.payload -> 'pricing_models', '[]'::jsonb))
      with ordinality as t(r, i)
   where btrim(coalesce(r ->> 'label', '')) <> '';

  insert into public.club_announcements (club_id, message)
  select v_id, btrim(r ->> 'message')
    from jsonb_array_elements(coalesce(v_row.payload -> 'announcements', '[]'::jsonb)) as r
   where btrim(coalesce(r ->> 'message', '')) <> '';

  -- Photos were uploaded to submissions/<id>/ while it was a draft. The rows
  -- point there until the action that called this moves the objects across and
  -- rewrites the paths, which cannot happen inside a transaction because the
  -- Storage API is an HTTP call.
  insert into public.club_images (club_id, src, alt, storage_path, position)
  select v_id, btrim(coalesce(r ->> 'src', '')), btrim(coalesce(r ->> 'alt', '')),
         nullif(btrim(coalesce(r ->> 'storage_path', '')), ''), (i - 1)::integer
    from jsonb_array_elements(coalesce(v_row.payload -> 'images', '[]'::jsonb))
      with ordinality as t(r, i)
   where btrim(coalesce(r ->> 'src', '')) <> ''
      or btrim(coalesce(r ->> 'storage_path', '')) <> '';

  update public.club_submissions
     set status      = 'approved',
         club_id     = v_id,
         reviewed_at = now(),
         reviewed_by = (select auth.uid())
   where id = p_id;

  return jsonb_build_object('club_id', v_id, 'slug', v_slug, 'name', v_name);
end;
$$;

revoke all on function public.approve_club_submission(bigint) from public, anon;
grant execute on function public.approve_club_submission(bigint) to authenticated;
