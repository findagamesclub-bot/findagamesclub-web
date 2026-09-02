import "server-only";

import { createClient } from "@/lib/supabase/server";

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

export type BoardPostRow = {
  id: number;
  event_id: number;
  title: string;
  content: string;
  created_at: string;
  author_profile_id: string;
  author: { full_name: string | null } | null;
  club_event_board_replies: {
    id: number;
    content: string;
    created_at: string;
    author_profile_id: string;
    removed_at: string | null;
    author: { full_name: string | null } | null;
  }[] | null;
};

type Chain = {
  select(columns: string): Chain;
  eq(column: string, value: number | string): Chain;
  is(column: string, value: null): Chain;
  order(column: string, options: { ascending: boolean }): Chain;
  limit(count: number): Promise<{ data: BoardPostRow[] | null; error: { message: string } | null }>;
};

const COLUMNS = `
  id, event_id, title, content, created_at, author_profile_id,
  author:profiles!club_event_board_posts_author_profile_id_fkey(full_name),
  club_event_board_replies(
    id, content, created_at, author_profile_id, removed_at,
    author:profiles!club_event_board_replies_author_profile_id_fkey(full_name)
  )`;

/** RLS returns nothing at all to anybody without a ticket, which is the gate. */
export async function findBoardPosts(eventId: number, limit = 200) {
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as { from(name: string): Chain })
    .from("club_event_board_posts")
    .select(COLUMNS)
    .eq("event_id", eventId)
    .is("removed_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to load the event board: ${error.message}`);
  return data ?? [];
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
