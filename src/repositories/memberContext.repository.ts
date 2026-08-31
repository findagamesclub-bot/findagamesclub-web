import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Someone else's memberships, as far as the viewer is allowed to see them.
 *
 * RLS on club_memberships already limits this to clubs the viewer belongs to,
 * so no filtering by shared club is needed here — asking for all of theirs
 * returns only the ones both people are in.
 */
export async function findTheirMemberships(memberId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_memberships")
    .select(
      `id, club_id, status, tier_key, joined_at,
       clubs!inner(id, slug, name, logo_url,
         club_membership_tiers(tier_key, label))`,
    )
    .eq("profile_id", memberId)
    .eq("status", "approved")
    .order("joined_at", { ascending: true });

  if (error) throw new Error(`Failed to load their clubs: ${error.message}`);
  return data ?? [];
}

export type MeetingRow = {
  id: number;
  session_date: string;
  game_title: string | null;
  booked_by: string;
  opponent_profile_id: string | null;
  booked_by_score: number | null;
  opponent_score: number | null;
  booked_by_army: string;
  opponent_army: string;
  clubs: { slug: string; name: string; logo_url: string | null };
};

/**
 * `src/types/database.ts` does not know the result columns until 0030 is
 * applied and the types are regenerated. Delete this narrowing then.
 */
type Chain = {
  select(columns: string): Chain;
  eq(column: string, value: string): Chain;
  or(filter: string): Chain;
  order(column: string, options: { ascending: boolean }): Chain;
  limit(count: number): Promise<{ data: MeetingRow[] | null; error: { message: string } | null }>;
};

/** Games the two of them have played against each other, newest first. */
export async function findGamesBetween(viewerId: string, memberId: string) {
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as { from(name: string): Chain })
    .from("club_bookings")
    .select(
      `id, session_date, game_title, status, booked_by, opponent_profile_id,
       booked_by_score, opponent_score, booked_by_army, opponent_army,
       clubs!inner(slug, name, logo_url)`,
    )
    .eq("status", "booked")
    .or(
      `and(booked_by.eq.${viewerId},opponent_profile_id.eq.${memberId}),` +
      `and(booked_by.eq.${memberId},opponent_profile_id.eq.${viewerId})`,
    )
    .order("session_date", { ascending: false })
    .limit(20);

  if (error) throw new Error(`Failed to load your games: ${error.message}`);
  return data ?? [];
}

export type EventHistoryRow = {
  booking_id: number;
  club_slug: string;
  club_name: string;
  event_legacy_id: string;
  event_title: string;
  start_date: string | null;
  start_time: string | null;
  tickets: number;
  is_past: boolean;
};

/**
 * Events this member has booked, at clubs the reader shares with them.
 *
 * Through a function rather than a direct read: club_event_bookings stays
 * "yours and the club's" by policy, and this returns curated columns so the
 * total paid never leaves the row.
 */
export async function findEventHistory(memberId: string) {
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as {
    rpc(name: string, args: Record<string, unknown>): Promise<{
      data: EventHistoryRow[] | null; error: { message: string } | null;
    }>;
  }).rpc("member_event_history", { p_member: memberId });

  if (error) throw new Error(`Failed to load their events: ${error.message}`);
  return data ?? [];
}
