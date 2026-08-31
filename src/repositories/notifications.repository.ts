import "server-only";

import { createClient } from "@/lib/supabase/server";

export type NotificationRow = {
  id: number;
  kind: string;
  title: string;
  body: string;
  href: string;
  created_at: string;
  read_at: string | null;
};

/**
 * `src/types/database.ts` is generated from the live schema and does not know
 * this table until 0027 is applied and the types are regenerated. Same
 * temporary narrowing as the competitions tables; delete this block then.
 */
type Result<T> = { data: T | null; count: number | null; error: { message: string } | null };

// The root has no `then` of its own: a builder that is itself thenable gets
// flattened by `await`, quietly turning the query object into its result.
type CountChain = Promise<Result<null>> & {
  eq(column: string, value: string | number): CountChain;
  is(column: string, value: null): CountChain;
};
type ListChain = {
  eq(column: string, value: string | number): ListChain;
  order(column: string, options: { ascending: boolean }): ListChain;
  limit(count: number): Promise<Result<NotificationRow[]>>;
};
type WriteChain = Promise<Result<null>> & {
  eq(column: string, value: string | number): WriteChain;
  is(column: string, value: null): WriteChain;
};
type Root = {
  select(columns: string, options: { count: "exact"; head: true }): CountChain;
  select(columns: string): ListChain;
  update(patch: Record<string, unknown>): WriteChain;
};

const table = async (): Promise<Root> => {
  const supabase = await createClient();
  return (supabase as unknown as { from(name: string): Root }).from("notifications");
};

const COLUMNS = "id, kind, title, body, href, created_at, read_at";

/** The badge. One indexed count, no rows read. */
export async function countUnread(profileId: string): Promise<number> {
  const { count, error } = await (await table())
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .is("read_at", null);

  if (error) throw new Error(`Failed to count notifications: ${error.message}`);
  return count ?? 0;
}

/** What the panel shows, newest first. Only fetched when it opens. */
export async function findRecent(profileId: string, limit: number) {
  const { data, error } = await (await table())
    .select(COLUMNS)
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to load notifications: ${error.message}`);
  return data ?? [];
}

/** Mark everything unread as read, in one statement. */
export async function markAllRead(profileId: string) {
  const { error } = await (await table())
    .update({ read_at: new Date().toISOString() })
    .eq("profile_id", profileId)
    .is("read_at", null);

  if (error) throw new Error(`Failed to mark notifications read: ${error.message}`);
}

export async function markOneRead(profileId: string, id: number) {
  const { error } = await (await table())
    .update({ read_at: new Date().toISOString() })
    .eq("profile_id", profileId)
    .eq("id", id);

  if (error) throw new Error(`Failed to mark that read: ${error.message}`);
}
