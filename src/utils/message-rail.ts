import type { Contact, MessageThread, RailEntry } from "@/types/message";

const keyOf = (clubId: number, personId: string) => `${clubId}:${personId}`;

/**
 * Conversations first, then everybody else you could start one with.
 *
 * Threads keep the order the inbox gave them, which is newest first — a live
 * conversation should not drop down the list because somebody's surname is
 * late in the alphabet. The rest sort by name, since nothing has happened to
 * rank them by.
 */
export function railEntries(threads: MessageThread[], contacts: Contact[]): RailEntry[] {
  const started = new Set(threads.map((t) => keyOf(t.clubId, t.personId)));

  const open: RailEntry[] = threads.map((t) => ({
    clubId: t.clubId,
    clubSlug: t.clubSlug,
    clubName: t.clubName,
    personId: t.personId,
    personName: t.personName,
    latest: t.latest,
    latestAt: t.latestAt,
    unread: t.unread,
  }));

  const rest: RailEntry[] = contacts
    .filter((c) => !started.has(keyOf(c.clubId, c.personId)))
    .map((c) => ({
      clubId: c.clubId,
      clubSlug: c.clubSlug,
      clubName: c.clubName,
      personId: c.personId,
      personName: c.personName,
      latest: null,
      latestAt: null,
      unread: 0,
    }))
    .sort((a, b) =>
      a.personName.localeCompare(b.personName) || a.clubName.localeCompare(b.clubName),
    );

  return [...open, ...rest];
}
