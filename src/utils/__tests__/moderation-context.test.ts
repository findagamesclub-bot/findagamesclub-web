import assert from "node:assert/strict";

import { moderationContext, type ContextRow } from "../moderation-context";

const row = (over: Partial<ContextRow>): ContextRow => ({
  target_type: "post", club_slug: "didcot-wargames-didcot",
  context_id: 7, event_key: "", target_gone: false, ...over,
});

// --- the five that have somewhere to go ------------------------------------

{
  assert.deepEqual(moderationContext(row({ target_type: "post", context_id: 7 })),
    { href: "/clubs/didcot-wargames-didcot/board/7", label: "Open the thread" });

  // A reply opens its PARENT, which is the whole point: a reply has no page of
  // its own, and whether it is out of order is a question about the thread.
  assert.deepEqual(moderationContext(row({ target_type: "reply", context_id: 7 })),
    { href: "/clubs/didcot-wargames-didcot/board/7", label: "Open the thread" });

  assert.deepEqual(moderationContext(row({
    target_type: "event_post", context_id: 12, event_key: "2026-10-31-oxford-onslaught-5",
  })), {
    href: "/clubs/didcot-wargames-didcot/events/2026-10-31-oxford-onslaught-5/board/12",
    label: "Open the thread",
  });

  assert.deepEqual(moderationContext(row({
    target_type: "event_reply", context_id: 12, event_key: "2026-10-31-oxford-onslaught-5",
  })), {
    href: "/clubs/didcot-wargames-didcot/events/2026-10-31-oxford-onslaught-5/board/12",
    label: "Open the thread",
  });

  // A review has no thread, so the club page is where it is read. The anchor
  // is the id `Section` derives from the heading "Reviews".
  assert.deepEqual(moderationContext(row({ target_type: "review", context_id: null })),
    { href: "/clubs/didcot-wargames-didcot#reviews", label: "Open the club page" });
}

// --- and the ones that do not ---------------------------------------------

{
  // A private message. Nothing on this site shows one person somebody else's
  // conversation, so a link here would have to point at a page that does not
  // exist. The dialog says so instead.
  assert.equal(moderationContext(row({ target_type: "message", context_id: null })), null);

  // Taken down already: the queue resolves a thread only for content that is
  // still there, so there is nothing to open.
  assert.equal(moderationContext(row({ target_gone: true })), null);
  assert.equal(moderationContext(row({ target_type: "review", target_gone: true })), null);

  // An event board item needs both halves of its address. One without the
  // other would build `/events//board/12`, which is a 404 wearing a link.
  assert.equal(moderationContext(row({ target_type: "event_post", event_key: "" })), null);
  assert.equal(moderationContext(row({
    target_type: "event_reply", context_id: null, event_key: "x",
  })), null);

  // No club, no board.
  assert.equal(moderationContext(row({ club_slug: "" })), null);

  // And a kind nobody has mapped gets nothing rather than a guess.
  assert.equal(moderationContext(row({ target_type: "invented" })), null);
}

console.log("moderation-context: all assertions passed");
