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
 *
 * Length-of-membership badges arrive through here too since 0162. They used to
 * be worked out on the fly from the join date and are ordinary rows now, which
 * is why this file no longer reads memberships at all.
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
