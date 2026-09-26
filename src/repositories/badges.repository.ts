import "server-only";

import { callRpc } from "@/lib/supabase/table";

/**
 * Badges a club hands out itself.
 *
 * Every read and write goes through a definer function in 0121, so nothing here
 * names a table: the guard is `club_can(club, 'members.manage')` and it lives
 * in one place rather than being re-stated in a policy and again here.
 *
 * Competition and tenure badges are not in this file at all. They are derived
 * from data the app already has (`competition-badges.ts`, `tenure-badges.ts`)
 * and a round trip to fetch them would be a round trip to fetch nothing new.
 */

export type ClubBadgeRow = {
  id: number; label: string; description: string;
  icon: string; tone: string; active: boolean; awarded: number;
};

export type MemberBadgeRow = {
  id: number; badge_id: number; label: string; description: string;
  icon: string; tone: string; note: string; awarded_at: string;
};

export type BadgeAwardRow = {
  id: number; badge_id: number; label: string; icon: string; tone: string;
  profile_id: string; member_name: string; note: string; awarded_at: string;
};

/** The same row from the filtered, counted and paged read in 0125. */
export type BadgeAwardPageRow = BadgeAwardRow & {
  badge_active: boolean; total_count: number;
};

export const findClubBadges = (club: number) =>
  callRpc<ClubBadgeRow[]>("club_badges_for", { p_club: club });

export const findMemberBadges = (club: number, profile: string) =>
  callRpc<MemberBadgeRow[]>("member_badges_for", { p_club: club, p_profile: profile });

export const findBadgeAwards = (club: number, badge: number | null = null) =>
  callRpc<BadgeAwardRow[]>("club_badge_awards", { p_club: club, p_badge: badge });

export const findBadgeAwardsPage = (params: {
  club: number; badge: number | null; query: string; state: string;
  sort: string; limit: number; offset: number;
}) => callRpc<BadgeAwardPageRow[]>("club_badge_awards_page", {
  p_club: params.club, p_badge: params.badge, p_query: params.query,
  p_state: params.state, p_sort: params.sort,
  p_limit: params.limit, p_offset: params.offset,
});

export const findBadgeAwardCounts = (
  club: number, badge: number | null, query: string,
) => callRpc<Record<string, number>>("club_badge_award_counts",
  { p_club: club, p_badge: badge, p_query: query });

export const saveBadge = (params: {
  club: number; badge: number | null; label: string; description: string;
  icon: string; tone: string; active: boolean;
}) => callRpc<number>("save_club_badge", {
  p_club: params.club, p_badge: params.badge, p_label: params.label,
  p_description: params.description, p_icon: params.icon, p_tone: params.tone,
  p_active: params.active,
});

export const awardBadge = (badge: number, profile: string, note: string) =>
  callRpc<number | null>("award_member_badge",
    { p_badge: badge, p_profile: profile, p_note: note });

export const revokeAward = (award: number) =>
  callRpc<boolean>("revoke_member_badge", { p_award: award });
