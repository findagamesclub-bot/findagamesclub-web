import "server-only";

import { createClient } from "@/lib/supabase/server";

export type NotificationRow = {
  id: number;
  kind: string;
  title: string;
  /** The sender's standing, on the small line under the title. Often empty. */
  meta: string;
  body: string;
  href: string;
  created_at: string;
  read_at: string | null;
};

const COLUMNS = "id, kind, title, meta, body, href, created_at, read_at";

/** The badge. One indexed count, no rows read. */
export async function countUnread(profileId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .is("read_at", null);

  if (error) throw new Error(`Failed to count notifications: ${error.message}`);
  return count ?? 0;
}

/** What the panel shows, newest first. Only fetched when it opens. */
export async function findRecent(profileId: string, limit: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select(COLUMNS)
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to load notifications: ${error.message}`);
  return data ?? [];
}

/** Mark everything unread as read, in one statement. */
export async function markAllRead(profileId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("profile_id", profileId)
    .is("read_at", null);

  if (error) throw new Error(`Failed to mark notifications read: ${error.message}`);
}

export async function markOneRead(profileId: string, id: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("profile_id", profileId)
    .eq("id", id)
    // Only if it is still unread. Re-reading one that is already read would
    // otherwise write a row, and every write on this table wakes the badges.
    .is("read_at", null);

  if (error) throw new Error(`Failed to mark that read: ${error.message}`);
}
