import "server-only";

import * as repo from "@/repositories/messages.repository";
import type { Contact, Conversation, DirectMessage, MessageThread } from "@/types/message";

/**
 * Direct messages.
 *
 * A thread is (club, the two people) — the same identity legacy encodes as the
 * string "didcot-wargames-didcot::2-4" (club_store.py:20174). Unread is counted
 * against one watermark per thread rather than per message, matching
 * _serialise_message_thread; the difference is that legacy reports a boolean
 * and this counts, because a count is more use in an inbox.
 */

type Person = { id: string; full_name: string | null; role?: string | null } | null;

const nameOf = (p: Person) => p?.full_name?.trim() || "Club member";

/** Stable ordering, so the pair is the same key from either side. */
export function pairOf(a: string, b: string): { low: string; high: string } {
  return a < b ? { low: a, high: b } : { low: b, high: a };
}

const keyOf = (clubId: number, low: string, high: string) => `${clubId}:${low}:${high}`;

/**
 * A message from the site rather than from a club.
 *
 * Stored as a null club_id, carried through the app as club 0 so the id stays
 * a number: it is a URL segment, a map key and a form field, and making all
 * three nullable to describe one case is worse than one reserved value.
 */
export const SITE_CLUB = 0;
const SITE_NAME = "FindAGamesClub";

/** null in the row, 0 in the app. */
const toClubId = (raw: number | null) => raw ?? SITE_CLUB;
/** 0 in the app, null in the row. */
const toRowClub = (clubId: number) => (clubId === SITE_CLUB ? null : clubId);

/**
 * The other end of a thread, as the reader should see it.
 *
 * On the site's own thread the other end is the site. A member has no idea who
 * "gul-admin" is, and the thing that makes an official message worth opening is
 * that FindAGamesClub sent it. An admin reading the same thread still sees the
 * member's name, because their side of it really is a person.
 */
const partyName = (p: Person, clubId: number) =>
  clubId === SITE_CLUB && p?.role === "admin" ? SITE_NAME : nameOf(p);

export async function getInbox(viewerId: string): Promise<MessageThread[]> {
  const [rows, marks] = await Promise.all([repo.findMyMessages(), repo.findReadMarks()]);

  const watermarks = new Map(
    marks.map((m) => [keyOf(toClubId(m.club_id), m.pair_low, m.pair_high), m.read_at]),
  );

  const threads = new Map<string, MessageThread>();

  // Newest first from the query, so the first row of each thread is its latest.
  for (const row of rows) {
    const r = row as unknown as {
      sender: Person; recipient: Person; clubs: { slug: string; name: string } | null;
    };
    const key = keyOf(toClubId(row.club_id), row.pair_low, row.pair_high);
    const theirs = row.sender_id === viewerId;
    const person = theirs ? r.recipient : r.sender;

    let thread = threads.get(key);
    if (!thread) {
      thread = {
        clubId: toClubId(row.club_id),
        clubSlug: r.clubs?.slug ?? "",
        clubName: r.clubs?.name ?? SITE_NAME,
        personId: theirs ? row.recipient_id : row.sender_id,
        personName: partyName(person, toClubId(row.club_id)),
        latest: row.content,
        latestAt: row.created_at,
        unread: 0,
        messageCount: 0,
      };
      threads.set(key, thread);
    }

    thread.messageCount += 1;

    // Only what they sent counts as unread; your own messages are not news.
    const readAt = watermarks.get(key);
    if (row.sender_id !== viewerId && (!readAt || row.created_at > readAt)) {
      thread.unread += 1;
    }
  }

  return [...threads.values()].sort((a, b) => b.latestAt.localeCompare(a.latestAt));
}

export async function getUnreadCount(viewerId: string): Promise<number> {
  const threads = await getInbox(viewerId);
  return threads.reduce((n, t) => n + t.unread, 0);
}

export async function getConversation(
  clubId: number,
  viewerId: string,
  personId: string,
): Promise<Conversation | null> {
  const { low, high } = pairOf(viewerId, personId);
  const rows = await repo.findThread(toRowClub(clubId), low, high);
  if (!rows.length) return null;

  const first = rows[0] as unknown as {
    sender: Person; recipient: Person; clubs: { slug: string; name: string } | null;
  };
  const person = rows[0].sender_id === viewerId ? first.recipient : first.sender;

  const messages: DirectMessage[] = rows.map((row) => {
    const r = row as unknown as { sender: Person };
    return {
      id: row.id,
      content: row.content,
      createdAt: row.created_at,
      isMine: row.sender_id === viewerId,
      senderName: partyName(r.sender, clubId),
    };
  });

  return {
    clubId,
    clubSlug: first.clubs?.slug ?? "",
    clubName: first.clubs?.name ?? SITE_NAME,
    personId,
    personName: partyName(person, clubId),
    messages,
  };
}

export async function getContacts(viewerId: string): Promise<Contact[]> {
  const rows = await repo.findContacts(viewerId);

  return rows
    .map((row) => {
      const r = row as unknown as {
        profiles: Person;
        clubs: { id: number; slug: string; name: string };
      };
      return {
        personId: row.profile_id,
        personName: nameOf(r.profiles),
        clubId: r.clubs.id,
        clubSlug: r.clubs.slug,
        clubName: r.clubs.name,
      };
    })
    .sort((a, b) => a.personName.localeCompare(b.personName));
}

type Result = { ok: true } | { ok: false; error: string };

export async function send(clubId: number, recipientId: string, content: string): Promise<Result> {
  const words = content.trim();
  if (!words) return { ok: false, error: "Write a message before sending." };
  if (words.length > 4000) return { ok: false, error: "That message is too long." };

  try {
    await repo.insertMessage(toRowClub(clubId), recipientId, words);
    return { ok: true };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    if (raw.includes("NOT_PERMITTED") || raw.includes("row-level security")) {
      return { ok: false, error: "You can only message approved members of the same club." };
    }
    return { ok: false, error: "Could not send that message. Try again." };
  }
}

export async function markRead(clubId: number, viewerId: string, personId: string) {
  const { low, high } = pairOf(viewerId, personId);
  try {
    await repo.markRead(toRowClub(clubId), low, high);
  } catch {
    // Losing a read receipt shows an unread badge that should not be there.
    // Annoying, not worth failing the page the person came to read.
  }
}

/**
 * Who an admin can start a conversation with: anybody.
 *
 * Shaped as a Contact so the same dialog draws it, with the club standing in
 * as the site. The address is shown beside the name because two members can
 * share one, and an admin writing about somebody's account needs to be sure
 * they have the right person.
 */
export async function getAdminContacts(query: string): Promise<Contact[]> {
  const rows = await repo.findAdminContacts(query).catch(() => []);
  return rows.map((row) => ({
    personId: row.id,
    personName: row.full_name?.trim() || row.email,
    clubId: SITE_CLUB,
    clubSlug: "",
    clubName: row.email,
  }));
}
