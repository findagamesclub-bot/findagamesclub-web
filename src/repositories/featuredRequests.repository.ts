import "server-only";

import { callRpc, table } from "@/lib/supabase/table";

/**
 * A club asking to lead the homepage.
 *
 * Through `table()` and `callRpc` because 0161 is newer than the generated
 * types. Convert when `database.ts` is next regenerated.
 */

export type FeaturedRequestRow = {
  id: number;
  club_id: number;
  status: string;
  preferred_from: string | null;
  note: string;
  created_at: string;
  answered_at: string | null;
  decline_reason: string;
  slot_id: number | null;
  club?: { slug: string; name: string; city: string } | null;
};

const COLUMNS =
  `id, club_id, status, preferred_from, note, created_at, answered_at,
   decline_reason, slot_id, club:clubs(slug, name, city)`;

/**
 * This club's own asks, newest first.
 *
 * It read one row until 0204, which was right while the unique index allowed
 * one open ask per club. A club running four events a year wants four weeks,
 * each with its own date and its own answer, so the panel lists every open one
 * and each gets its own way back out.
 *
 * Capped, because the panel draws the open asks and one answer: a club a few
 * years in has a history nobody reads to the end of.
 */
export async function findRequestsForClub(
  clubId: number,
): Promise<FeaturedRequestRow[]> {
  const rows = await table<FeaturedRequestRow>("featured_requests");
  const { data, error } = await rows
    .select(COLUMNS)
    .eq("club_id", clubId)
    .order("id", { ascending: false })
    .limit(20);

  if (error) throw new Error(`Failed to load the featured requests: ${error.message}`);
  return data ?? [];
}

/** The admin's queue. Open ones first, oldest at the top of those. */
export async function findRequests(): Promise<FeaturedRequestRow[]> {
  const rows = await table<FeaturedRequestRow>("featured_requests");
  const { data, error } = await rows
    .select(COLUMNS)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to load the featured requests: ${error.message}`);
  return data ?? [];
}

export const askForFeatured = (clubId: number, from: string | null, note: string) =>
  callRpc<number>("request_featured_slot", {
    p_club: clubId, p_from: from, p_note: note,
  });

export const withdrawFeaturedRequest = (id: number) =>
  callRpc<void>("withdraw_featured_request", { p_id: id });

export const answerFeaturedRequest = (
  id: number, slotId: number | null, reason: string,
) => callRpc<void>("answer_featured_request", {
  p_id: id, p_slot: slotId, p_reason: reason,
});
