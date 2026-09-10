import assert from "node:assert/strict";
import { notificationHref } from "../notification-href";

// An admin reading a notice written before they were one.
assert.equal(
  notificationHref("/account/messages/0/abc", true),
  "/admin/messages/0/abc",
);

// And the reverse, for somebody who has stood down.
assert.equal(
  notificationHref("/admin/messages/0/abc", false),
  "/account/messages/0/abc",
);

// Already right, either way round.
assert.equal(notificationHref("/admin/messages/0/abc", true), "/admin/messages/0/abc");
assert.equal(notificationHref("/account/messages/9/abc", false), "/account/messages/9/abc");

// Everything else lives at one address whoever opens it.
assert.equal(notificationHref("/clubs/didcot/members", true), "/clubs/didcot/members");
assert.equal(notificationHref("/team/invites/tok", true), "/team/invites/tok");

// A notice with nowhere to go stays nowhere, rather than becoming "/".
assert.equal(notificationHref(null, true), "");
assert.equal(notificationHref("", false), "");
assert.equal(notificationHref("   ", true), "");

console.log("notification-href: all assertions passed");
