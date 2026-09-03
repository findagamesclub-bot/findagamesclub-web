import "server-only";

import { createClient } from "@/lib/supabase/server";

export type ActivityRow = {
  id: string;
  kind: string;
  at: string;
  /** Null for a visitor: 0063 anonymises rather than hiding the board. */
  who: string | null;
  what: string;
  /** The second line, where a kind has one worth reading. Null for a visitor. */
  detail: string | null;
  /** Whatever the kind needs to build a link: a profile id, an event key, a post id. */
  ref: string;
};

/**
 * The club's recent activity, from every source at once.
 *
 * One function rather than a query per kind. A member cannot read another
 * member's merchandise order, coaching booking or event ticket, and should
 * not be able to: the feed needs a name, a time and a line of text, never a
 * total. 0063 reads past RLS for exactly that much, and decides for itself
 * whether the caller has earned the names.
 */
export async function findActivityFeed(clubId: number, days = 14, limit = 18) {
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as {
    rpc(name: string, args: Record<string, unknown>): Promise<{
      data: ActivityRow[] | null; error: { message: string } | null;
    }>;
  }).rpc("club_activity_feed", { p_club: clubId, p_days: days, p_limit: limit });

  if (error) throw new Error(`Failed to load the club's activity: ${error.message}`);
  return data ?? [];
}
