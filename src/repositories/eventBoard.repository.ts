import "server-only";

import { createClient } from "@/lib/supabase/server";
// The same shim every repository written alongside a migration uses. Its
// builder is deliberately not thenable, which a hand-rolled one here was:
// `await` unwrapped the query before anything could be chained onto it.
import { table } from "@/lib/supabase/table";

export type RosterRow = {
  profile_id: string | null;
  full_name: string;
  is_member: boolean;
  tickets: number;
  bookings: number;
  first_booked: string;
};

/**
 * Who is signed up, as a fellow attendee may see it.
 *
 * A function, because club_event_bookings_select (0015) shows a member their
 * own booking and nothing else. 0059 reads past it behind the same gate legacy
 * uses: holding a ticket, or running the club.
 */
export async function findEventRoster(eventId: number) {
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as {
    rpc(name: string, args: Record<string, unknown>): Promise<{
      data: RosterRow[] | null; error: { message: string } | null;
    }>;
  }).rpc("club_event_roster", { p_event: eventId });

  if (error) throw new Error(`Failed to load the roster: ${error.message}`);
  return data ?? [];
}

export type ThreadRow = {
  id: number;
  title: string;
  content: string;
  created_at: string;
  last_activity_at: string;
  author_profile_id: string;
  author: { full_name: string | null } | null;
  /** PostgREST returns an aggregate as a one-element array. */
  club_event_board_replies: { count: number }[] | null;
};

export type ReplyRow = {
  id: number;
  post_id: number;
  content: string;
  created_at: string;
  author_profile_id: string;
  author: { full_name: string | null } | null;
};

const THREAD_COLUMNS = `
  id, title, content, created_at, last_activity_at, author_profile_id,
  author:profiles!club_event_board_posts_author_profile_id_fkey(full_name),
  club_event_board_replies(count)`;

const REPLY_COLUMNS = `
  id, post_id, content, created_at, author_profile_id,
  author:profiles!club_event_board_replies_author_profile_id_fkey(full_name)`;

/**
 * A page of threads, with how many replies each has rather than the replies.
 *
 * The whole point of 0132. Before it this read every thread with every reply
 * embedded and paged them in the browser, so a hundred threads of two hundred
 * replies was twenty thousand rows to draw eight. The count rides along as a
 * PostgREST aggregate, which costs one index scan per thread on the page and
 * not one round trip.
 *
 * RLS returns nothing at all to anybody without a ticket, which is the gate.
 */
export async function findEventThreads(
  eventId: number, params: { limit: number; offset: number },
) {
  const query = await table<ThreadRow>("club_event_board_posts");
  const { data, error, count } = await query
    .select(THREAD_COLUMNS, { count: "exact" })
    .eq("event_id", eventId)
    .is("removed_at", null)
    .order("last_activity_at", { ascending: false })
    .range(params.offset, params.offset + params.limit - 1);

  if (error) throw new Error(`Failed to load the event board: ${error.message}`);
  return { rows: data ?? [], total: count ?? 0 };
}

/**
 * How many live replies the whole event has.
 *
 * `head: true` so PostgREST counts and returns nothing, and an inner embed so
 * the filter reaches the reply's own post. One count, no rows.
 */
export async function countEventReplies(eventId: number) {
  const query = await table<{ id: number }>("club_event_board_replies");
  const { count, error } = await query
    .select("id, club_event_board_posts!inner(event_id)",
            { count: "exact", head: true })
    .eq("club_event_board_posts.event_id", eventId)
    .is("removed_at", null);

  if (error) throw new Error(`Failed to count the replies: ${error.message}`);
  return count ?? 0;
}

/** One thread. Null when it has gone, or when the reader holds no ticket. */
export async function findEventThread(postId: number) {
  const query = await table<ThreadRow>("club_event_board_posts");
  const { data, error } = await query
    .select(THREAD_COLUMNS)
    .eq("id", postId)
    .is("removed_at", null)
    .maybeSingle();

  if (error) throw new Error(`Failed to load the thread: ${error.message}`);
  return data;
}

/**
 * A page of one thread's replies, oldest first.
 *
 * Forward order, because a conversation is read forward, so the last page is
 * the newest and that is where the reply box sits.
 */
export async function findEventReplies(
  postId: number, params: { limit: number; offset: number },
) {
  const query = await table<ReplyRow>("club_event_board_replies");
  const { data, error, count } = await query
    .select(REPLY_COLUMNS, { count: "exact" })
    .eq("post_id", postId)
    .is("removed_at", null)
    .order("created_at", { ascending: true })
    .range(params.offset, params.offset + params.limit - 1);

  if (error) throw new Error(`Failed to load the replies: ${error.message}`);
  return { rows: data ?? [], total: count ?? 0 };
}

type Writer = {
  insert(values: Record<string, unknown>): {
    select(columns: string): { maybeSingle(): Promise<{ data: { id: number } | null; error: { message: string } | null }> };
  };
  update(values: Record<string, unknown>): {
    eq(column: string, value: number): {
      is(column: string, value: null): {
        select(columns: string): { maybeSingle(): Promise<{ data: { id: number } | null; error: { message: string } | null }> };
      };
    };
  };
};

const writer = async (table: string) =>
  (await createClient() as unknown as { from(name: string): Writer }).from(table);

export async function insertBoardPost(eventId: number, title: string, content: string) {
  const { data, error } = await (await writer("club_event_board_posts"))
    .insert({ event_id: eventId, title, content })
    .select("id").maybeSingle();

  if (error) throw new Error(error.message);
  // RLS filtering an insert out returns no row and no error, so the absence of
  // a row IS the refusal. Never report a blocked write as a success.
  if (!data) throw new Error("BOARD_NOT_YOURS");
  return data.id;
}

export async function insertBoardReply(postId: number, content: string) {
  const { data, error } = await (await writer("club_event_board_replies"))
    .insert({ post_id: postId, content })
    .select("id").maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("BOARD_NOT_YOURS");
  return data.id;
}

/** Soft. The thread survives, so a removed post does not take its replies. */
export async function removeBoardPost(id: number, by: string) {
  const { data, error } = await (await writer("club_event_board_posts"))
    .update({ removed_at: new Date().toISOString(), removed_by: by })
    .eq("id", id).is("removed_at", null)
    .select("id").maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("BOARD_NOT_YOURS");
}

export async function removeBoardReply(id: number, by: string) {
  const { data, error } = await (await writer("club_event_board_replies"))
    .update({ removed_at: new Date().toISOString(), removed_by: by })
    .eq("id", id).is("removed_at", null)
    .select("id").maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("BOARD_NOT_YOURS");
}
