-- 0085 · The listing's own tables become writable
--
-- Stage 2, steps 2 to 4. Eight tables the club edits directly, each gated on
-- `club_can(club_id, 'listing.edit')` and each granted by column rather than
-- by table.
--
-- Three tables that belong to these steps are deliberately not here, because
-- they need more than a policy:
--
--   club_sessions               deleting a night with bookings on it has to
--                               refuse, and by which rule is the function's job
--   club_membership_tiers       a tier key has to survive a rename, and a tier
--                               somebody holds cannot vanish
--   club_discussion_categories  renaming one has to follow into the posts filed
--                               under it
--
-- Those get definer functions in 0086.
--
-- Supabase grants `authenticated` insert, update and delete on every new table
-- in `public` by default, and a later `grant insert (col, col)` is additive: it
-- adds nothing and the column list is inert. So every table here is revoked
-- first, including `club_coaching_settings`, which Stage 7 left carrying a
-- whole-table grant. Its policy has always gated the writes, so nothing was
-- reachable, but a table where the only thing standing between a member and a
-- write is one policy is a table one mistake from being wrong.

-- ------------------------------------------------------------------ revokes

revoke insert, update, delete on public.club_images             from authenticated, anon;
revoke insert, update, delete on public.club_social_links       from authenticated, anon;
revoke insert, update, delete on public.club_announcements      from authenticated, anon;
revoke insert, update, delete on public.club_pricing_models     from authenticated, anon;
revoke insert, update, delete on public.club_booking_settings   from authenticated, anon;
revoke insert, update, delete on public.club_membership_settings from authenticated, anon;
revoke insert, update, delete on public.club_loyalty_settings   from authenticated, anon;
revoke insert, update, delete on public.club_coaching_settings  from authenticated, anon;

-- ----------------------------------------------------------------- policies

do $$
declare
  t text;
  tables text[] := array[
    'club_images', 'club_social_links', 'club_announcements', 'club_pricing_models',
    'club_booking_settings', 'club_membership_settings', 'club_loyalty_settings',
    'club_coaching_settings'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    -- One policy for insert, update and delete: the question is the same for
    -- all three, and three policies saying `club_can(club_id, 'listing.edit')`
    -- is three places to get it wrong later.
    execute format($f$
      create policy %I on public.%I
        for all to authenticated
        using (public.club_can(club_id, 'listing.edit'))
        with check (public.club_can(club_id, 'listing.edit'))
    $f$, t || '_write', t);
  end loop;
end $$;

-- The read policies already on these tables stay as they are. A club's photos,
-- links and prices are public; its booking and loyalty settings are read by
-- the pages that price a booking.

-- ------------------------------------------------------------------- grants
--
-- `club_id` is grantable on insert and never on update: a row may be created
-- against a club the writer runs, and may not later be moved to another one.
-- Ids and `created_at` are never grantable at all.

grant insert (club_id, src, alt, position), update (src, alt, position)
  on public.club_images to authenticated;

grant insert (club_id, label, url, position), update (label, url, position)
  on public.club_social_links to authenticated;

grant insert (club_id, message), update (message)
  on public.club_announcements to authenticated;

grant insert (club_id, label, price, notes, position), update (label, price, notes, position)
  on public.club_pricing_models to authenticated;

grant insert (club_id, table_booking_price, price_currency, calendar_horizon_days,
              enforce_advance_window, cancel_cutoff_hours, waitlist_enabled,
              looking_for_games_enabled, updated_at),
      update (table_booking_price, price_currency, calendar_horizon_days,
              enforce_advance_window, cancel_cutoff_hours, waitlist_enabled,
              looking_for_games_enabled, updated_at)
  on public.club_booking_settings to authenticated;

grant insert (club_id, basic_label, advance_booking_dates, upcoming_booking_limit,
              event_advance_days, looking_for_game_future_dates,
              looking_for_game_post_limit, loyalty_redemption_cap_percent),
      update (basic_label, advance_booking_dates, upcoming_booking_limit,
              event_advance_days, looking_for_game_future_dates,
              looking_for_game_post_limit, loyalty_redemption_cap_percent)
  on public.club_membership_settings to authenticated;

grant insert (club_id, enabled, point_value, table_booking_price, milestones,
              anniversaries, tiers, updated_at),
      update (enabled, point_value, table_booking_price, milestones,
              anniversaries, tiers, updated_at)
  on public.club_loyalty_settings to authenticated;

grant insert (club_id, enabled, intro_text, policy_text),
      update (enabled, intro_text, policy_text)
  on public.club_coaching_settings to authenticated;

-- Delete has no column form, so it can only be granted on the table. The four
-- that need it are the ones the editor treats as lists: a photo removed, a link
-- dropped, a notice taken down, a price row deleted. The three settings tables
-- are one row per club and are upserted, never deleted, so they do not get it.

grant delete on public.club_images         to authenticated;
grant delete on public.club_social_links   to authenticated;
grant delete on public.club_announcements  to authenticated;
grant delete on public.club_pricing_models to authenticated;

-- --------------------------------------------------------------------- guard

do $$
declare bad text;
begin
  select string_agg(distinct table_name, ', ') into bad
    from information_schema.role_table_grants
   where table_schema = 'public'
     and grantee in ('authenticated', 'anon')
     -- INSERT and UPDATE only. DELETE has no column form, so a table-level
     -- grant for it is the only way to give it and is not the hazard.
     and privilege_type in ('INSERT', 'UPDATE')
     and table_name in (
       'club_images', 'club_social_links', 'club_announcements', 'club_pricing_models',
       'club_booking_settings', 'club_membership_settings', 'club_loyalty_settings',
       'club_coaching_settings');
  if bad is not null then
    raise exception 'whole-table grant still present on %; the column lists are inert', bad;
  end if;
end $$;
