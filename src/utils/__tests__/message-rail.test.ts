import assert from "node:assert/strict";
import { byClub, conversationEntries, searchContacts } from "../message-rail";
import type { Contact, MessageThread } from "@/types/message";

const thread = (clubId: number, personId: string, name: string): MessageThread => ({
  clubId, clubSlug: `c${clubId}`, clubName: `Club ${clubId}`,
  personId, personName: name, latest: "hi", latestAt: "2026-08-26T10:00:00Z",
  unread: 1, messageCount: 1,
});

const contact = (clubId: number, personId: string, name: string, club = ""): Contact => ({
  clubId, clubSlug: `c${clubId}`, clubName: club || `Club ${clubId}`,
  personId, personName: name,
});

// The rail carries conversations only; contacts are not mixed in any more.
{
  const rows = conversationEntries([thread(1, "p1", "Ann"), thread(2, "p1", "Ann")]);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => r.clubId), [1, 2]);
  assert.equal(rows[0].latest, "hi");
}

// The inbox order is kept: newest conversation first, not alphabetical.
{
  const rows = conversationEntries([thread(1, "p9", "Zoe"), thread(1, "p2", "Ada")]);
  assert.deepEqual(rows.map((r) => r.personName), ["Zoe", "Ada"]);
}

// An empty search returns everybody, sorted by name.
{
  const rows = searchContacts([contact(1, "p2", "Bob"), contact(1, "p3", "Ada")], "");
  assert.deepEqual(rows.map((r) => r.personName), ["Ada", "Bob"]);
}

// Matching is case-insensitive and partial.
{
  const rows = searchContacts([contact(1, "p2", "Bob Marley"), contact(1, "p3", "Ada")], "MAR");
  assert.deepEqual(rows.map((r) => r.personName), ["Bob Marley"]);
}

// A club name finds everybody at that club.
{
  const people = [contact(1, "p2", "Bob", "Didcot"), contact(2, "p3", "Ada", "Abingdon")];
  assert.deepEqual(searchContacts(people, "didcot").map((r) => r.personName), ["Bob"]);
}

// Nobody matches, and that is an empty list rather than everybody.
{
  assert.deepEqual(searchContacts([contact(1, "p2", "Bob")], "zzz"), []);
}

// Grouping puts each person under the club you share, clubs in name order.
{
  const groups = byClub([
    contact(2, "p3", "Ada", "Zebra Club"),
    contact(1, "p2", "Bob", "Anvil Club"),
    contact(1, "p4", "Cid", "Anvil Club"),
  ]);
  assert.deepEqual(groups.map((g) => g.clubName), ["Anvil Club", "Zebra Club"]);
  assert.deepEqual(groups[0].people.map((p) => p.personName), ["Bob", "Cid"]);
}

console.log("message-rail ok");
