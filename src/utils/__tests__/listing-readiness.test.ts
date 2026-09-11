import assert from "node:assert/strict";
import {
  listingChecks, readinessSummary, readinessFraction, stepStatus,
  type ReadinessInput,
} from "../listing-readiness";

const empty: ReadinessInput = {};

const full: ReadinessInput = {
  name: "Didcot Wargames", city: "Didcot", summary: "A club", description: "A longer one",
  formats: ["Wargaming"],
  venueName: "The Hall", postcode: "OX11 8AA", venueAddress: "1 High Street",
  website: "https://example.com",
  contactEmail: "hello@example.com",
  ages: "All ages", memberCount: 148, tablesAvailable: 10,
  featuredGames: ["Warhammer 40,000"], facilities: ["Parking"], paymentMethods: ["Cash"],
  basicMembershipPriced: true, loyaltyReady: true,
  sessions: [{ day: "Thursday", time: "18:30 to 22:00", label: "Club night" }],
};

const ready = (i: ReadinessInput, key: string) =>
  listingChecks(i).find((c) => c.key === key)!.ready;
const note = (i: ReadinessInput, key: string) =>
  listingChecks(i).find((c) => c.key === key)!.note;

// A live listing has seven checks. The eighth is a plan, and a club that
// already exists has no plan to choose.
assert.equal(listingChecks(empty).length, 7);
assert.equal(listingChecks({ ...full, plan: { chosen: false } }).length, 8);

// Nothing filled in.
assert.equal(readinessSummary(listingChecks(empty)), "0 of 7 required checks ready");
assert.equal(readinessFraction(listingChecks(empty)), 0);

// Everything filled in.
assert.equal(readinessSummary(listingChecks(full)), "7 of 7 required checks ready");
assert.equal(readinessFraction(listingChecks(full)), 1);

// Legacy's partial wording, counted rather than described.
assert.equal(note({ name: "Didcot", city: "Didcot" }, "profile"),
  "2 of 5 required fields completed");
assert.equal(note(full, "profile"), "Complete");
assert.equal(note(empty, "contact"), "Add a public contact email");
assert.equal(note(empty, "pricing"), "Set the basic membership fee and loyalty programme");
assert.equal(note(empty, "schedule"), "Complete every opening-rhythm row");

// Zero is an answer, not a blank. Legacy reads form values as strings, so a
// club that says it has no tables has filled the field in.
assert.equal(ready({ ...full, tablesAvailable: 0 }, "capacity"), true);
assert.equal(ready({ ...full, tablesAvailable: null }, "capacity"), false);

// An empty list is not a format.
assert.equal(ready({ ...full, formats: [] }, "profile"), false);

// One incomplete row fails the whole schedule, and no rows fails it too.
assert.equal(ready({ ...full, sessions: [] }, "schedule"), false);
assert.equal(ready({ ...full, sessions: [
  { day: "Thursday", time: "18:30 to 22:00", label: "Club night" },
  { day: "Monday", time: "", label: "Beginners" },
] }, "schedule"), false);

// Both halves of the pricing check have to be true.
assert.equal(ready({ ...full, loyaltyReady: false }, "pricing"), false);
assert.equal(ready({ ...full, basicMembershipPriced: false }, "pricing"), false);

// Whitespace is not an answer.
assert.equal(ready({ ...full, summary: "   " }, "profile"), false);

// Step 1 counts thirteen fields across four checks, which is legacy's own sum.
assert.equal(stepStatus(full)[1], "Core details: 13/13 complete");
assert.equal(stepStatus(empty)[1], "Core details: 0/13 complete");
assert.equal(stepStatus({ name: "Didcot", contactEmail: "a@b.c" })[1],
  "Core details: 2/13 complete");
assert.equal(stepStatus(full)[2], "Content: 3/3 complete");
assert.equal(stepStatus(empty)[3], "Membership fee required");
assert.equal(stepStatus(full)[4], "Opening rhythm complete");

// Step 5 reads differently for a live club: there is nothing to submit.
assert.equal(stepStatus(full)[5], "Listing health");
assert.equal(stepStatus({ ...full, plan: { chosen: false } })[5], "Choose plan");
assert.equal(stepStatus({ ...full, plan: { chosen: true } })[5], "Ready");

console.log("listing-readiness: all assertions passed");
