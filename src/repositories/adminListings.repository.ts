import "server-only";

import { createClient } from "@/lib/supabase/server";
import { callRpc } from "@/lib/supabase/table";

/**
 * Taking a club or an event listing down, and putting it back (0188).
 *
 * Through functions rather than an update, for two different reasons that end
 * in the same place. `clubs.status` is in no column grant at all, so the
 * function is the only way in. `club_events.status` IS granted to the club, so
 * a trigger refuses them the suspended state and these are what gets past it.
 *
 * The reason is read rather than selected: `src/types/database.ts` has not been
 * regenerated since 0151 and `check:columns` is right to refuse a select naming
 * a column it has never heard of.
 */

export type Suspension = {
  reason: string;
  suspended_at: string | null;
  by_name: string;
};

export const suspendClub = (clubId: number, reason: string) =>
  callRpc<string>("admin_suspend_club", { p_club: clubId, p_reason: reason });

export const restoreClub = (clubId: number) =>
  callRpc<string>("admin_restore_club", { p_club: clubId });

export const suspendEvent = (eventId: number, reason: string) =>
  callRpc<string>("admin_suspend_event", { p_event: eventId, p_reason: reason });

export const restoreEvent = (eventId: number) =>
  callRpc<string>("admin_restore_event", { p_event: eventId });

export const findClubSuspension = (clubId: number) =>
  callRpc<Suspension[]>("club_suspension", { p_club: clubId });

export const findEventSuspension = (eventId: number) =>
  callRpc<Suspension[]>("event_suspension", { p_event: eventId });

/**
 * Just enough of the row to write a letter about it.
 *
 * Only columns the generated types already know, so `check:columns` has
 * nothing to object to: the suspension's own columns are read through the
 * functions above.
 */
export async function findClubForNotice(clubId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clubs")
    .select("id, slug, name, city, owner_id")
    .eq("id", clubId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function findEventForNotice(eventId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_events")
    .select("id, legacy_id, title, club_id, clubs!inner(slug, name, city, owner_id)")
    .eq("id", eventId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
