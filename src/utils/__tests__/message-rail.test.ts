import assert from "node:assert/strict";
import { railEntries } from "../message-rail";
import type { Contact, MessageThread } from "@/types/message";

const thread = (clubId: number, personId: string, name: string): MessageThread => ({
  clubId, clubSlug: `c${clubId}`, clubName: `Club ${clubId}`,
  personId, personName: name, latest: "hi", latestAt: "2026-08-26T10:00:00Z",
  unread: 1, messageCount: 1,
});

const contact = (clubId: number, personId: string, name: string): Contact => ({
  clubId, clubSlug: `c${clubId}`, clubName: `Club ${clubId}`,
  personId, personName: name,
});

// Somebody you already talk to must not appear twice once they are also a contact.
{
  const rows = railEntries([thread(1, "p1", "Ann")], [contact(1, "p1", "Ann")]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].latest, "hi");
}

// The same person at two clubs is two rows: two separate conversations.
{
  const rows = railEntries([thread(1, "p1", "Ann")], [contact(2, "p1", "Ann")]);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => r.clubId), [1, 2]);
}

// Conversations lead; the rest sort by name.
{
  const rows = railEntries(
    [thread(1, "p9", "Zoe")],
    [contact(1, "p2", "Bob"), contact(1, "p3", "Ada")],
  );
  assert.deepEqual(rows.map((r) => r.personName), ["Zoe", "Ada", "Bob"]);
  assert.equal(rows[1].latest, null);
  assert.equal(rows[1].unread, 0);
}

console.log("message-rail ok");
