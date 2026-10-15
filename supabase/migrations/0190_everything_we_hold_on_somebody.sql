-- 0190 · One account, and everything the site holds on the person behind it
--
-- The client's words: *"when viewing accounts in admin, and you click through
-- to an individual account, can we show an overview of all of their clubs,
-- memberships and all data we hold on them for their profile. Can we also add
-- a message member button on this menu."*
--
-- `admin_account_detail` (0071) returns seven columns: a name, an email, a
-- role, whether they are active and two dates. That is enough to suspend
-- somebody and not enough to decide whether you should. An admin opening this
-- page is usually about to do something about this person — answer their
-- email, judge a report they are in, take their account away — and the
-- question underneath all three is the same: who is this, and what are they to
-- us.
--
-- Three functions rather than one, because they answer three different
-- questions and the page fires them together. One jsonb blob would have had to
-- be taken apart in TypeScript anyway, and a set is what the clubs list is.
--
-- **The profile half is read literally.** "All data we hold on them for their
-- profile" is every column of `profiles` the person themselves filled in, plus
-- the member code 0177 gives them. Not a selection of the interesting ones: an
-- admin answering "what do you have on me" needs the answer to be the whole
-- answer, and a field left out of this screen is a field nobody can audit.
--
-- `home_postcode` is in there, and it is the one that needs saying out loud:
-- it is the only piece of real-world location the site stores about a person,
-- it is never shown on a public profile, and it is here because an admin
-- handling a data request has to be able to see it. The screen labels it for
-- what it is rather than printing it beside the games they like.
--
-- **The clubs half is one row per club, not two lists.** Somebody can run a
-- club and be a member of it, and the pair is one fact about one club: a full
-- outer join rather than a team list above a membership list saying the same
-- club's name twice. Loyalty rides along because a club's own roster shows it
-- and an admin reading this page should not have to go to six clubs to find
-- out whether somebody is anybody.
--
-- **The tally counts, and never returns the rows.** Thirteen figures over
-- thirteen tables, each of which has its own screen already. A page that
-- loaded somebody's three hundred messages to print "300" would be the scale
-- rule broken for a number.
--
-- Admin only, by `is_admin()`, and definer for the reason 0118 gives: the
-- answer must not depend on which policy happens to cover a club an admin is
-- not a member of.

/**
 * The profile, as the person filled it in.
 *
 * `security definer` and `is_admin()` rather than reading through
 * `profiles_select_authenticated`: that policy is `using (true)`, so an
 * invoker read would work and would also mean this function is no guard at
 * all. The gate is what makes it honest about who it is for.
 */
create or replace function public.admin_account_profile(p_profile uuid)
returns table (
  bio text,
  home_postcode text,
  travel_miles integer,
  age_groups text[],
  availability_days text[],
  games_interested text[],
  factions_armies text[],
  play_style_tags text[],
  social_profiles jsonb,
  member_code text,
  profile_updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.bio, p.home_postcode, p.preferred_travel_miles,
         p.age_groups, p.availability_days, p.games_interested,
         p.factions_armies, p.play_style_tags,
         coalesce(p.social_profiles, '{}'::jsonb),
         coalesce(c.code::text, ''),
         p.updated_at
    from public.profiles p
    left join public.member_codes c on c.profile_id = p.id
   where p.id = p_profile and public.is_admin();
$$;

/**
 * Every club this person is attached to, whichever way round.
 *
 * A full outer join on the club, because running one and belonging to it are
 * two different attachments to the same place and an admin wants the place,
 * not the attachment. Didcot's owner is also a member of Didcot; two lists
 * would print the club twice and leave the reader to work out it was one club.
 *
 * `lifetime` is the loyalty total, the same figure `member_loyalty_standing`
 * hands a clubmate (0156) and the same one the club's own roster shows. The
 * balance is deliberately not here: it is money-shaped, nobody on this screen
 * is going to spend it, and the rank is the thing that says whether somebody
 * is anybody at that club.
 */
create or replace function public.admin_account_clubs(p_profile uuid)
returns table (
  club_id bigint, slug text, name text, city text, club_status text,
  team_role text, membership_status text, tier_key text, tier_label text,
  joined_at date, lifetime integer
)
language sql
stable
security definer
set search_path = public
as $$
  with teams as (
    select t.club_id, t.role
      from public.club_team t
     where t.profile_id = p_profile
  ),
  -- One membership per club, and the LIVE one wins. Somebody can leave a club
  -- and rejoin it, because `club_memberships_one_live` only covers pending and
  -- approved, so a club can hold two rows for one person. Picking by status
  -- text would have handed back 'cancelled' over 'approved', which is the
  -- screen saying somebody left a club they are standing in.
  mems as (
    select distinct on (m.club_id)
           m.club_id, m.status, m.tier_key, m.joined_at
      from public.club_memberships m
     where m.profile_id = p_profile
     order by m.club_id,
              case when m.status in ('approved', 'pending') then 0 else 1 end,
              coalesce(m.joined_at, m.created_at::date) desc
  ),
  ids as (
    select club_id from teams
    union
    select club_id from mems
  )
  select i.club_id, c.slug::text, c.name, c.city, c.status,
         coalesce(t.role, ''), coalesce(m.status, ''),
         coalesce(m.tier_key, ''),
         -- The club's own word for the tier, not its key. Every club names
         -- these itself and `premium-membership` is not what anybody calls it.
         coalesce(tr.label, ''),
         m.joined_at,
         coalesce((select sum(l.lifetime_delta)::integer
                     from public.club_loyalty_transactions l
                    where l.club_id = i.club_id and l.profile_id = p_profile), 0)
    from ids i
    join public.clubs c on c.id = i.club_id
    left join teams t on t.club_id = i.club_id
    left join mems m on m.club_id = i.club_id
    left join public.club_membership_tiers tr
           on tr.club_id = i.club_id and tr.tier_key = m.tier_key
   where public.is_admin()
   -- Clubs they run first, then by name. Somebody who owns one club and
   -- belongs to five is primarily the owner of that one, and an admin reading
   -- down the list should meet that first.
   order by case when coalesce(t.role, '') = 'owner' then 0
                 when coalesce(t.role, '') <> '' then 1
                 else 2 end,
            c.name;
$$;

/**
 * How much of each thing the site holds, and nothing else.
 *
 * Counts, never rows. Each of these has a screen of its own already and a page
 * that loaded three hundred messages to print "300" would be the scale rule
 * broken for a number.
 *
 * Cancelled and withdrawn rows are counted in on purpose. This is not "what is
 * live", it is "what do we hold", which is the question somebody answering a
 * data request is being asked, and a cancelled booking is still a record of
 * where that person was going to be on a Thursday.
 */
create or replace function public.admin_account_tally(p_profile uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when not public.is_admin() then '{}'::jsonb else
    jsonb_build_object(
      'tableBookings', (select count(*) from public.club_bookings
                         where booked_by = p_profile
                            or opponent_profile_id = p_profile),
      'eventTickets',  (select count(*) from public.club_event_bookings
                         where profile_id = p_profile),
      'coaching',      (select count(*) from public.club_coaching_bookings
                         where profile_id = p_profile),
      'orders',        (select count(*) from public.club_merchandise_orders
                         where profile_id = p_profile),
      'boardPosts',    (select count(*) from public.club_discussion_posts
                         where author_profile_id = p_profile),
      'boardReplies',  (select count(*) from public.club_discussion_replies
                         where author_profile_id = p_profile),
      'reviews',       (select count(*) from public.club_reviews
                         where author_profile_id = p_profile),
      'messages',      (select count(*) from public.club_messages
                         where sender_id = p_profile),
      'reportsFiled',  (select count(*) from public.moderation_flags
                         where flagged_by = p_profile),
      -- Reports about something THEY wrote, which is the figure that decides
      -- whether a suspension is a first resort or a last one.
      'reportsAbout',  (select count(*) from public.moderation_flags f
                         where public.flag_author(f.target_type, f.target_id)
                               = p_profile),
      'badges',        (select count(*) from public.member_badges
                         where profile_id = p_profile and revoked_at is null),
      'armyLists',     (select count(*) from public.army_lists
                         where profile_id = p_profile and deleted_at is null),
      'listings',      (select count(*) from public.club_submissions
                         where owner_id = p_profile),
      'claims',        (select count(*) from public.club_claims
                         where claimant_id = p_profile)
    )
  end;
$$;

revoke all on function public.admin_account_profile(uuid) from public, anon;
revoke all on function public.admin_account_clubs(uuid) from public, anon;
revoke all on function public.admin_account_tally(uuid) from public, anon;
grant execute on function public.admin_account_profile(uuid) to authenticated;
grant execute on function public.admin_account_clubs(uuid) to authenticated;
grant execute on function public.admin_account_tally(uuid) to authenticated;
