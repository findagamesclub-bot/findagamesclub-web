import "server-only";

import { table } from "@/lib/supabase/table";

/**
 * Every club badge one member holds, across every club.
 *
 * Read straight from the table rather than through a definer function, because
 * `member_badges_select` (0121) already says exactly who may see one: the
 * holder, anybody on that club's roster, and its team. A profile page read by
 * a clubmate therefore shows the badges they share a club with and nothing
 * else, without this having to know the rule.
 */

export type HeldBadgeRow = {
  id: number;
  note: string;
  awarded_at: string;
  club_badges: { label: string; description: string; icon: string; tone: string };
  clubs: { slug: string; name: string };
};

export async function findBadgesHeldBy(profileId: string): Promise<HeldBadgeRow[]> {
  const { data, error } = await (await table<HeldBadgeRow>("member_badges"))
    .select("id, note, awarded_at, club_badges(label, description, icon, tone), clubs(slug, name)")
    .eq("profile_id", profileId)
    .is("revoked_at", null)
    .order("awarded_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export type TenureRow = {
  joined_at: string | null;
  created_at: string;
  clubs: { slug: string; name: string };
};

/** What they joined and when, for the year badges. */
export async function findMembershipsFor(profileId: string): Promise<TenureRow[]> {
  const { data, error } = await (await table<TenureRow>("club_memberships"))
    .select("joined_at, created_at, clubs(slug, name)")
    .eq("profile_id", profileId)
    .eq("status", "approved");

  if (error) throw new Error(error.message);
  return data ?? [];
}
