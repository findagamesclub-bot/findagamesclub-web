import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * What has happened at a club lately.
 *
 * Four small queries rather than one union view: they are different tables with
 * different policies, and every one of them is already RLS-guarded the way the
 * feed needs. A member sees their club's activity; anyone else reads nothing,
 * which is the same answer legacy gives by gating the feed on member content.
 */
const PERSON = "full_name";

export async function findJoins(clubId: number, limit: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_memberships")
    .select(`id, joined_at, profile_id, profiles!club_memberships_profile_id_fkey(${PERSON})`)
    .eq("club_id", clubId)
    .eq("status", "approved")
    .not("joined_at", "is", null)
    .order("joined_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to load joins: ${error.message}`);
  return data ?? [];
}

export async function findRecentBookings(clubId: number, limit: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_bookings")
    .select(`id, created_at, session_date, game_title, booked_by,
             profiles!club_bookings_booked_by_fkey(${PERSON})`)
    .eq("club_id", clubId)
    .eq("status", "booked")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to load bookings: ${error.message}`);
  return data ?? [];
}

export async function findRecentRivals(clubId: number, limit: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_rivals")
    .select(`id, created_at, profile_id,
             profiles!club_rivals_profile_id_fkey(${PERSON}),
             rival:profiles!club_rivals_rival_id_fkey(${PERSON})`)
    .eq("club_id", clubId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to load rivalries: ${error.message}`);
  return data ?? [];
}

export async function findRecentResults(clubId: number, limit: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_event_results")
    .select(`id, rank, placement, member_name, member_profile_id,
             club_events!inner(id, legacy_id, title, start_date, club_id)`)
    .eq("club_events.club_id", clubId)
    .lte("rank", 3)
    .order("id", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to load results: ${error.message}`);
  return data ?? [];
}
