import assert from "node:assert/strict";

import {
  contentReading, pricingReading, profileColumns, scheduleReading,
} from "../listing-payload";
import { readinessFromPayload } from "../draft-readiness";
import { stepDone, stepStatus } from "../listing-readiness";

const form = (pairs: [string, string][]) => {
  const data = new FormData();
  for (const [key, value] of pairs) data.append(key, value);
  return data;
};

// --- step 1, as club columns ----------------------------------------------

{
  const columns = profileColumns({
    name: "Leeds Test Club", city: "Leeds", neighbourhood: "",
    summary: "A friendly club.", description: "", formats: ["Miniatures"],
    venueName: "The Hall", venueAddress: "", postcode: "LS1 1AA",
    website: "", contactEmail: "hi@leeds.test", ages: "18+",
    memberCount: 40, tablesAvailable: 8,
  });

  assert.equal(columns.name, "Leeds Test Club");
  assert.equal(columns.venue_postcode, "LS1 1AA", "the column name, not the form name");
  assert.equal(columns.website_url, null, "an empty field is null, not an empty string");
  assert.equal(columns.neighbourhood, null);
  assert.equal(columns.member_count, 40);
  assert.equal(columns.tables_available, 8);

  // Zero is an answer. A club saying it has no tables has told us something,
  // and storing that as null would read as "never asked".
  const none = profileColumns({
    name: "X", city: "Y", neighbourhood: "", summary: "", description: "", formats: [],
    venueName: "", venueAddress: "", postcode: "", website: "", contactEmail: "",
    ages: "", memberCount: 0, tablesAvailable: 0,
  });
  assert.equal(none.tables_available, 0);
  assert.equal(none.member_count, 0);
}

// --- step 2 ----------------------------------------------------------------

{
  const read = contentReading(form([
    ["games", "Warhammer 40,000"], ["games", " "], ["games", "Kill Team"],
    ["facilities", "Parking"],
    ["paymentMethods", "Cash"],
    ["photo", JSON.stringify({ path: "clubs/9/a.webp", src: "", alt: "The hall" })],
    ["photo", JSON.stringify({ path: null, src: null, alt: "still uploading" })],
    ["photo", "not json at all"],
    ["social-Facebook", "facebook.com/leeds"],
    ["social-Instagram", "  "],
    ["category", "General"], ["categoryId", "12"],
    ["category", "New one"], ["categoryId", ""],
    ["removedPhoto", "clubs/9/old.webp"],
  ]));

  assert.deepEqual(read.games, ["Warhammer 40,000", "Kill Team"], "blanks dropped");
  assert.equal(read.images.length, 1, "a half-uploaded photo and broken json are not rows");
  assert.equal(read.images[0]!.storage_path, "clubs/9/a.webp");
  assert.equal(read.images[0]!.alt, "The hall");
  assert.equal(read.social_links.length, 1, "an empty social box is not a link");
  assert.equal(read.social_links[0]!.label, "Facebook");
  assert.equal(read.social_links[0]!.url, "https://facebook.com/leeds",
    "a missing scheme is a typing habit, not an error");
  assert.deepEqual(read.categories,
    [{ id: "12", label: "General" }, { id: null, label: "New one" }],
    "an existing category keeps its id so a rename cascades; a new one has none");
  assert.deepEqual(read.removed, ["clubs/9/old.webp"]);
}

// --- step 3 ----------------------------------------------------------------

{
  const good = pricingReading(form([
    ["modelLabel", "Drop in"], ["modelPrice", "5"], ["modelNotes", ""],
    ["modelLabel", ""], ["modelPrice", "9"], ["modelNotes", ""],
    ["tierKey", "basic"], ["tierLabel", "Basic"], ["tierPrice", "30"],
    ["tierDuration", "year"], ["tierDescription", ""], ["tierBasic", "yes"],
    ["tierBenefits", '{"eventDiscountPercent":5}'], ["tierBilling", "[]"],
    ["loyaltyEnabled", "yes"],
  ]));

  assert.ok(good.ok);
  if (good.ok) {
    assert.equal(good.value.pricing_models.length, 1, "a model with no label is not a model");
    assert.equal(good.value.tiers[0]!.is_basic, true);
    assert.deepEqual(good.value.tiers[0]!.benefits, { eventDiscountPercent: 5 },
      "perks ride back out as the json they came in as");
    assert.equal(good.value.loyalty.enabled, true);
  }
}

{
  // Broken json in a hidden field must not wipe the club's perks silently.
  const salvaged = pricingReading(form([
    ["tierKey", "basic"], ["tierLabel", "Basic"], ["tierPrice", ""],
    ["tierDuration", ""], ["tierDescription", ""], ["tierBasic", "yes"],
    ["tierBenefits", "{oops"], ["tierBilling", "{oops"],
  ]));
  assert.ok(salvaged.ok);
  if (salvaged.ok) {
    assert.deepEqual(salvaged.value.tiers[0]!.benefits, {});
    assert.deepEqual(salvaged.value.tiers[0]!.billing_options, []);
  }
}

{
  // Tiers with nobody to join on is a club nobody can join.
  const orphaned = pricingReading(form([
    ["tierKey", "gold"], ["tierLabel", "Gold"], ["tierPrice", "60"],
    ["tierDuration", "year"], ["tierDescription", ""], ["tierBasic", "no"],
    ["tierBenefits", "{}"], ["tierBilling", "[]"],
  ]));
  assert.equal(orphaned.ok, false);
  if (!orphaned.ok) assert.match(orphaned.error, /one people join on/);

  // No tiers at all is fine: a club can run on drop-in alone.
  assert.equal(pricingReading(form([["loyaltyEnabled", "no"]])).ok, true);
}

// --- step 4 ----------------------------------------------------------------

{
  const read = scheduleReading(form([
    ["nightId", "31"], ["nightDay", "Thursday"], ["nightTime", "19:00 - 22:00"],
    ["nightLabel", "Club night"],
    ["notice", "We meet weekly."], ["notice", "  "],
  ]));

  assert.ok(read.ok);
  if (read.ok) {
    assert.equal(read.value.sessions[0]!.id, "31", "an existing night keeps its id");
    assert.deepEqual(read.value.announcements, [{ message: "We meet weekly." }]);
  }
}

{
  // A half-filled night would save as a night nobody can turn up to.
  const half = scheduleReading(form([
    ["nightId", ""], ["nightDay", "Friday"], ["nightTime", ""], ["nightLabel", ""],
  ]));
  assert.equal(half.ok, false);
  if (!half.ok) assert.match(half.error, /day, a time and a name/);

  // A completely empty row is somebody who pressed Add and changed their mind.
  const blank = scheduleReading(form([
    ["nightId", ""], ["nightDay", ""], ["nightTime", ""], ["nightLabel", ""],
  ]));
  assert.equal(blank.ok, true);
  if (blank.ok) assert.equal(blank.value.sessions.length, 0);
}

// --- the stepper's ticks --------------------------------------------------

{
  // What the client saw: a brand new listing with nothing in it, and steps one
  // and two wearing a tick. The status line reads "Core details: 0/13 complete"
  // and the stepper decided by asking whether that sentence ended in the word
  // "complete". A boolean is not a thing to read out of a sentence.
  const empty = readinessFromPayload({});
  assert.deepEqual(stepDone(empty), { 1: false, 2: false, 3: false, 4: false, 5: false });

  // The sentence itself is unchanged, because it is the useful half: it says
  // how far through the step somebody is.
  assert.equal(stepStatus(empty)[1], "Core details: 0/13 complete");
  assert.equal(stepStatus(empty)[2], "Content: 0/3 complete");
}

{
  // Half a step is still not a tick.
  const half = readinessFromPayload({
    club: { name: "Leeds Meeple Society", city: "Leeds" },
    formats: ["Board games"],
  });
  assert.equal(stepDone(half)[1], false, "two of thirteen fields is not done");
  assert.match(stepStatus(half)[1]!, /^Core details: [1-9]/, "and it says how far");
}

{
  // A finished profile step ticks, and only when every one of its four checks
  // is ready: the count on the card is fields, the tick is checks.
  const full = readinessFromPayload({
    club: {
      name: "Leeds Meeple Society", city: "Leeds",
      summary: "A weekly club.", description: "Longer version.",
      venue_name: "Trinity Rooms", venue_postcode: "LS1 6HW",
      venue_address: "12 Boar Lane", website_url: "https://leeds.test",
      contact_email: "hi@leeds.test", ages: "18+",
      member_count: 45, tables_available: 10,
    },
    formats: ["Board games"],
    games: ["Catan"], facilities: ["Parking"], payment_methods: ["Cash"],
  });
  assert.equal(stepDone(full)[1], true, "every profile check ready is a tick");
  assert.equal(stepDone(full)[2], true, "and so is a filled content step");
  assert.equal(stepDone(full)[3], false, "pricing is untouched, so no tick");
}

console.log("listing-payload: all assertions passed");
