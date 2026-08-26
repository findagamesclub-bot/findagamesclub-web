import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { TablesInsert } from "@/types/database";

const COLUMNS =
  "id, club_id, club_session_id, session_date, game_title, notes, requested_by, " +
  "status, last_skip_reason, skip_count, created_at";

/** The queue for a club across a window. Ordered as promotion will take them. */
export async function findWaitlist(clubId: number, fromDate: string, toDate: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_booking_waitlist")
    .select(`${COLUMNS}, profiles!club_booking_waitlist_requested_by_fkey(id, full_name)`)
    .eq("club_id", clubId)
    .eq("status", "active")
    .gte("session_date", fromDate)
    .lte("session_date", toDate)
    // The promotion order, and the only place rank comes from. Never stored:
    // a position column needs renumbering on every leave, promote and skip.
    .order("created_at")
    .order("id");

  if (error) throw new Error(`Failed to load waiting list: ${error.message}`);
  return data ?? [];
}

export async function joinWaitlist(row: TablesInsert<"club_booking_waitlist">) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_booking_waitlist")
    .insert(row)
    .select("id, session_date, club_session_id")
    .maybeSingle();

  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  if (!data) throw new Error("NOT_PERMITTED");
  return data;
}

/** Leave the queue. Policy pins the result to 'withdrawn'. */
export async function leaveWaitlist(id: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_booking_waitlist")
    .update({ status: "withdrawn", withdrawn_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "active")
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("NOT_PERMITTED");
  return data;
}

/**
 * Hand someone the table, on the club's say-so.
 *
 * Goes through the definer function because promotion creates a booking in
 * somebody else's name, which no policy permits directly. The function checks
 * can_manage_club itself, so a member calling this gets NOT_PERMITTED rather
 * than a silent no-op.
 */
export async function promoteAsManager(entryId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("promote_waitlist_entry_as_manager", {
    entry_id: entryId,
  });

  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  return data as number | null;
}
