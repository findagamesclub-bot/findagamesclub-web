import "server-only";

import * as repo from "@/repositories/eventBoard.repository";

export type RosterEntry = {
  profileId: string | null;
  name: string;
  isMember: boolean;
  /**
   * Null for a reader outside the club and the ticket holders. On a finished
   * event the list itself opens up but the seat counts do not: how many a
   * person bought is the club's business, and on a past event it answers
   * nothing anybody asked. Null rather than 0, so the reader is told nothing
   * rather than told nought.
   */
  tickets: number | null;
  /** Separate trips through checkout. Shown only when it is more than one. */
  bookings: number | null;
};

/**
 * Who is coming, as a fellow attendee sees it.
 *
 * No email, no booking reference and no money: those are the club's, and the
 * club has its own door list for them. This is the answer to "who else is
 * turning up", which legacy shows to anybody holding a ticket — and, once the
 * event is over, to anybody at all, because by then it is "who was there" and
 * the standings beside it already name them (0065).
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

/** A row on the list: the thread, and how many have answered it. */
export type BoardThread = BoardReply & {
  title: string;
  replyCount: number;
  lastActivityAt: string;
};

const THREADS_PER_PAGE = 8;
const REPLIES_PER_PAGE = 20;

export { THREADS_PER_PAGE, REPLIES_PER_PAGE };

const person = (name: string | null | undefined) =>
  name?.trim() || "Club member";

/**
 * A page of threads, paged in SQL.
 *
 * Before 0132 this fetched every thread with every reply inside it and the
 * browser paged the result, which is the thing `CLAUDE.md`'s scale rules exist
 * to stop: a hundred threads of two hundred replies is twenty thousand rows to
 * draw eight of them, and the two hundred and first thread did not exist at
 * all. A failed read answers null rather than an empty list, because "no
 * threads yet" is a very different thing to tell somebody.
 */
export async function getEventThreads(eventId: number, page: number) {
  // One wave. The masthead's reply figure does not need the rows and the rows
  // do not need it, so waiting for one before starting the other costs a round
  // trip for nothing.
  const [got, replies] = await Promise.all([
    repo.findEventThreads(eventId, {
      limit: THREADS_PER_PAGE,
      offset: (page - 1) * THREADS_PER_PAGE,
    }).catch(() => null),
    repo.countEventReplies(eventId).catch(() => 0),
  ]);

  return {
    replies,
    threads: (got?.rows ?? []).map((row): BoardThread => ({
      id: row.id,
      title: row.title,
      content: row.content,
      authorId: row.author_profile_id,
      authorName: person(row.author?.full_name),
      createdAt: row.created_at,
      lastActivityAt: row.last_activity_at,
      // PostgREST hands an aggregate back as a one-element array.
      replyCount: row.club_event_board_replies?.[0]?.count ?? 0,
    })),
    total: got?.total ?? 0,
    page,
    perPage: THREADS_PER_PAGE,
    failed: got === null,
  };
}

export type BoardThreadPage = {
  thread: BoardThread;
  replies: BoardReply[];
  total: number;
  page: number;
  perPage: number;
};

/**
 * One thread and a page of its replies.
 *
 * Oldest first and the last page by default, because a conversation is read
 * forward and the reply box sits at the end of it. `page` of 0 means "the last
 * one", which is what a link to a thread should open on.
 */
export async function getEventThread(
  postId: number, page: number,
): Promise<BoardThreadPage | null> {
  const row = await repo.findEventThread(postId).catch(() => null);
  if (!row) return null;

  const count = row.club_event_board_replies?.[0]?.count ?? 0;
  const pages = Math.max(1, Math.ceil(count / REPLIES_PER_PAGE));
  const on = page > 0 ? Math.min(page, pages) : pages;

  const got = await repo.findEventReplies(postId, {
    limit: REPLIES_PER_PAGE,
    offset: (on - 1) * REPLIES_PER_PAGE,
  }).catch(() => ({ rows: [], total: 0 }));

  return {
    thread: {
      id: row.id,
      title: row.title,
      content: row.content,
      authorId: row.author_profile_id,
      authorName: person(row.author?.full_name),
      createdAt: row.created_at,
      lastActivityAt: row.last_activity_at,
      replyCount: count,
    },
    replies: got.rows.map((r): BoardReply => ({
      id: r.id,
      content: r.content,
      authorId: r.author_profile_id,
      authorName: person(r.author?.full_name),
      createdAt: r.created_at,
    })),
    total: got.total,
    page: on,
    perPage: REPLIES_PER_PAGE,
  };
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
