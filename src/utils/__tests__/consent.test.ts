import assert from "node:assert/strict";
import { analyticsAllowed, consentMaxAge, parseConsent } from "../consent";

// Only the two values we write. Anything else is somebody's stale cookie or a
// hand-edited one, and the honest answer to both is "we have not asked yet".
assert.equal(parseConsent("all"), "all");
assert.equal(parseConsent(" necessary "), "necessary");
assert.equal(parseConsent("yes"), null);
assert.equal(parseConsent(""), null);
assert.equal(parseConsent(undefined), null);

// The default with no answer is the strict one. A visitor who has not chosen
// has not consented, which is the whole point of asking.
assert.equal(analyticsAllowed(undefined), false);
assert.equal(analyticsAllowed("necessary"), false);
assert.equal(analyticsAllowed("all"), true);

const DAY = 24 * 60 * 60;

// Twelve calendar months, not 365 days hard-coded: 2027-02-14 to 2028-02-14
// does not reach 2028's leap day, so this one really is 365.
assert.equal(consentMaxAge(new Date("2027-02-14T09:00:00.000Z")), 365 * DAY);

// And one that does cross it, which is why the arithmetic is the calendar's.
assert.equal(consentMaxAge(new Date("2027-03-01T00:00:00.000Z")), 366 * DAY);

// 29 February has no anniversary. It rolls to 1 March rather than throwing or
// landing in the past, which is the behaviour to keep.
assert.equal(consentMaxAge(new Date("2028-02-29T00:00:00.000Z")), 366 * DAY);

console.log("consent ok");
