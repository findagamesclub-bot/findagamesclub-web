import type { Contact, MessageThread, RailEntry } from "@/types/message";

/**
 * The rail is conversations, and only conversations.
 *
 * It used to be every conversation followed by everybody you could start one
 * with. That reads fine at Didcot's two members and falls apart at two
 * hundred: the person you were talking to yesterday sits below ninety
 * strangers. Starting a conversation is now its own action, with its own
 * search, and the rail stays a list of what is happening.
 */
export function conversationEntries(threads: MessageThread[]): RailEntry[] {
  return threads.map((thread) => ({
    clubId: thread.clubId,
    clubSlug: thread.clubSlug,
    clubName: thread.clubName,
    personId: thread.personId,
    personName: thread.personName,
    latest: thread.latest,
    latestAt: thread.latestAt,
    unread: thread.unread,
  }));
}

const fold = (value: string) => value.trim().toLowerCase();

/**
 * People to start a conversation with, filtered by what was typed.
 *
 * Name or club, because "who at Didcot can I ask" is as common a question as
 * "where is Ann". Sorted by name: nothing has happened between you yet, so
 * there is no other order to put them in.
 */
export function searchContacts(contacts: Contact[], query: string): Contact[] {
  const needle = fold(query);

  return contacts
    .filter((contact) =>
      !needle ||
      fold(contact.personName).includes(needle) ||
      fold(contact.clubName).includes(needle))
    .sort((a, b) =>
      a.personName.localeCompare(b.personName) || a.clubName.localeCompare(b.clubName));
}

/** Contacts under the club they share with you, for a grouped picker. */
export function byClub(contacts: Contact[]): { clubName: string; people: Contact[] }[] {
  const groups = new Map<string, Contact[]>();
  for (const contact of contacts) {
    const list = groups.get(contact.clubName) ?? [];
    list.push(contact);
    groups.set(contact.clubName, list);
  }

  return [...groups.entries()]
    .map(([clubName, people]) => ({ clubName, people }))
    .sort((a, b) => a.clubName.localeCompare(b.clubName));
}
