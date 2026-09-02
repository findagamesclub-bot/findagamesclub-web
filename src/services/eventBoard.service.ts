import "server-only";

import * as repo from "@/repositories/eventBoard.repository";

export type RosterEntry = {
  profileId: string | null;
  name: string;
  isMember: boolean;
  tickets: number;
  /** Separate trips through checkout. Shown only when it is more than one. */
  bookings: number;
};

/**
 * Who is coming, as a fellow attendee sees it.
 *
 * No email, no booking reference and no money: those are the club's, and the
 * club has its own door list for them. This is the answer to "who else is
 * turning up", which legacy shows to anybody holding a ticket.
 */
export async function getEventRoster(eventId: number): Promise<RosterEntry[]> {
  const rows = await repo.findEventRoster(eventId).catch(() => []);

  return rows.map((r) => ({
    profileId: r.profile_id,
    name: r.full_name,
    isMember: r.is_member,
    tickets: r.tickets,
    bookings: r.bookings,
  }));
}

export type BoardReply = {
  id: number;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
};

export type BoardPost = BoardReply & {
  title: string;
  replies: BoardReply[];
};

/** Every thread on one event, newest first. Empty for anybody without a ticket. */
export async function getEventBoard(eventId: number): Promise<BoardPost[]> {
  const rows = await repo.findBoardPosts(eventId).catch(() => []);

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    authorId: row.author_profile_id,
    authorName: row.author?.full_name?.trim() || "Club member",
    createdAt: row.created_at,
    replies: (row.club_event_board_replies ?? [])
      .filter((r) => r.removed_at === null)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((r) => ({
        id: r.id,
        content: r.content,
        authorId: r.author_profile_id,
        authorName: r.author?.full_name?.trim() || "Club member",
        createdAt: r.created_at,
      })),
  }));
}

const ERRORS: [string, string][] = [
  ["BOARD_NOT_YOURS", "Only people holding a ticket for this event can post here."],
  ["row-level security", "Only people holding a ticket for this event can post here."],
  ["_title_len", "A title has to be between 1 and 200 characters."],
  ["_content_len", "That message is too long."],
];

function refusal(error: unknown, where: string): string {
  const raw = error instanceof Error ? error.message : String(error);
  const known = ERRORS.find(([code]) => raw.includes(code));
  if (known) return known[1];

  console.error(where, raw);
  return "Could not post that. Try again.";
}

export async function postToBoard(params: {
  eventId: number;
  title: string;
  content: string;
}): Promise<{ ok: boolean; error?: string }> {
  const title = params.title.trim();
  const content = params.content.trim();
  if (!title) return { ok: false, error: "Give it a title." };
  if (!content) return { ok: false, error: "Say something in the message." };

  try {
    await repo.insertBoardPost(params.eventId, title, content);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: refusal(error, "event board post failed") };
  }
}

export async function replyOnBoard(
  postId: number,
  content: string,
): Promise<{ ok: boolean; error?: string }> {
  const body = content.trim();
  if (!body) return { ok: false, error: "Say something in the reply." };

  try {
    await repo.insertBoardReply(postId, body);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: refusal(error, "event board reply failed") };
  }
}

/** Soft removal. The author may withdraw their own; the club anybody's. */
export async function removeFromBoard(
  kind: "post" | "reply",
  id: number,
  by: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (kind === "post") await repo.removeBoardPost(id, by);
    else await repo.removeBoardReply(id, by);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: refusal(error, "event board removal failed") };
  }
}
