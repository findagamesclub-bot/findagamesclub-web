import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { TablesInsert } from "@/types/database";

const COLUMNS =
  "id, club_id, club_session_id, session_date, game_title, notes, created_by, status, created_at";

/** Open posts for a club across a window. */
export async function findOpenPosts(clubId: number, fromDate: string, toDate: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_looking_for_games")
    .select(`${COLUMNS}, profiles!club_looking_for_games_created_by_fkey(id, full_name)`)
    .eq("club_id", clubId)
    .eq("status", "open")
    .gte("session_date", fromDate)
    .lte("session_date", toDate)
    .order("session_date")
    .order("created_at");

  if (error) throw new Error(`Failed to load looking-for-game posts: ${error.message}`);
  return data ?? [];
}

/** How many open posts one member holds at a club. Legacy caps this per tier. */
export async function countOpenPostsFor(clubId: number, profileId: string) {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("club_looking_for_games")
    .select("id", { count: "exact", head: true })
    .eq("club_id", clubId)
    .eq("created_by", profileId)
    .eq("status", "open");

  if (error) throw new Error(`Failed to count posts: ${error.message}`);
  return count ?? 0;
}

export async function insertPost(row: TablesInsert<"club_looking_for_games">) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_looking_for_games")
    .insert(row)
    .select("id, session_date, club_session_id")
    .maybeSingle();

  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  if (!data) throw new Error("NOT_PERMITTED");
  return data;
}

/** Withdraw your own post. Policy pins the result to 'cancelled'. */
export async function withdrawPost(id: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_looking_for_games")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("status", "open")
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("NOT_PERMITTED");
  return data;
}

/**
 * Take someone up on their post.
 *
 * Goes through the definer function, not a plain insert: accepting creates a
 * booking in the POSTER's name, which the insert policy forbids outright.
 */
export async function acceptPost(id: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_looking_for_game", { post_id: id });

  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  return data as number;
}

/**
 * Withdraw your own open posts for one night.
 *
 * Called when you book a table that night: accepting a post CREATES a booking
 * in your name, so once you hold one the post can never be taken up — whoever
 * clicks gets a duplicate-key error and your advert sits there dead.
 */
export async function withdrawOwnPostsFor(clubId: number, profileId: string, sessionDate: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_looking_for_games")
    .update({ status: "cancelled" })
    .eq("club_id", clubId)
    .eq("created_by", profileId)
    .eq("session_date", sessionDate)
    .eq("status", "open")
    .select("id");

  if (error) throw new Error(error.message);
  return data ?? [];
}
