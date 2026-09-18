import "server-only";

import { table } from "@/lib/supabase/table";
import type { EventNotice } from "@/types/eventEditor";

/**
 * Short updates on an event, newest first.
 *
 * Separate from the info board, which is the standing information. A notice is
 * "the hall has changed, use the side door", posted on the day.
 */

type NoticeRow = { id: number; message: string; created_at: string };

export async function findNotices(eventId: number): Promise<EventNotice[]> {
  const notices = await table<NoticeRow>("club_event_notices");
  const { data, error } = await notices
    .select("id, message, created_at").eq("event_id", eventId)
    .order("created_at", { ascending: false }).order("id", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id, message: row.message, createdAt: row.created_at,
  }));
}

export async function addNotice(eventId: number, message: string) {
  const notices = await table<NoticeRow>("club_event_notices");
  const { error } = await notices.insert({ event_id: eventId, message });
  if (error) throw new Error(error.message);
}

export async function deleteNotice(eventId: number, id: number) {
  const notices = await table<NoticeRow>("club_event_notices");
  const { error } = await notices.delete().eq("id", id).eq("event_id", eventId);
  if (error) throw new Error(error.message);
}
