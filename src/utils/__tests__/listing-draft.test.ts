import assert from "node:assert/strict";
import { parseProfileStep } from "../listing-draft";

const form = (entries: [string, string][]) => {
  const f = new FormData();
  for (const [k, v] of entries) f.append(k, v);
  return f;
};

const complete: [string, string][] = [
  ["name", "Didcot Wargames"], ["city", "Didcot"], ["summary", "A club"],
  ["description", "A longer one"], ["formats", "Wargaming"],
  ["venueName", "The Hall"], ["venueAddress", "1 High Street"],
  ["postcode", "ox11 8aa"], ["website", "https://example.com"],
  ["contactEmail", "Hello@Example.com"], ["ages", "All ages"],
  ["memberCount", "148"], ["tablesAvailable", "10"],
];

const ok = parseProfileStep(form(complete));
assert.equal(ok.ok, true);
if (ok.ok) {
  // Legacy uppercases the postcode and lowercases the email on save.
  assert.equal(ok.value.postcode, "OX11 8AA");
  assert.equal(ok.value.contactEmail, "hello@example.com");
  assert.deepEqual(ok.value.formats, ["Wargaming"]);
  assert.equal(ok.value.memberCount, 148);
}

// Legacy's two hand-written messages, word for word.
const noFormats = parseProfileStep(form(complete.filter(([k]) => k !== "formats")));
assert.equal(noFormats.ok, false);
if (!noFormats.ok) {
  assert.equal(noFormats.errors.formats, "Add at least one club format before continuing.");
}

const noAges = parseProfileStep(form(complete.filter(([k]) => k !== "ages")));
assert.equal(noAges.ok, false);
if (!noAges.ok) {
  assert.equal(noAges.errors.ages, "Add at least one age group before continuing.");
}

// A club has to have a name.
const noName = parseProfileStep(form(complete.map(([k, v]) => (k === "name" ? [k, "  "] : [k, v]))));
assert.equal(noName.ok, false);

// Zero tables is an answer, not a blank, and not an error.
const noTables = parseProfileStep(
  form(complete.map(([k, v]) => (k === "tablesAvailable" ? [k, "0"] : [k, v]))),
);
assert.equal(noTables.ok, true);
if (noTables.ok) assert.equal(noTables.value.tablesAvailable, 0);

// Left blank is null, which the readiness check reads as not answered.
const blankTables = parseProfileStep(
  form(complete.map(([k, v]) => (k === "tablesAvailable" ? [k, ""] : [k, v]))),
);
assert.equal(blankTables.ok, true);
if (blankTables.ok) assert.equal(blankTables.value.tablesAvailable, null);

// Nonsense in a number field is refused rather than quietly becoming zero.
for (const bad of ["ten", "-4", "3.5"]) {
  const r = parseProfileStep(
    form(complete.map(([k, v]) => (k === "memberCount" ? [k, bad] : [k, v]))),
  );
  assert.equal(r.ok, false, `expected "${bad}" to be refused`);
}

// Addresses are checked, but only when given: both are optional fields.
const badEmail = parseProfileStep(
  form(complete.map(([k, v]) => (k === "contactEmail" ? [k, "hello"] : [k, v]))),
);
assert.equal(badEmail.ok, false);

const badSite = parseProfileStep(
  form(complete.map(([k, v]) => (k === "website" ? [k, "example.com"] : [k, v]))),
);
assert.equal(badSite.ok, false);

const noSite = parseProfileStep(form(complete.filter(([k]) => k !== "website")));
assert.equal(noSite.ok, true);

// Several problems come back together, so the form does not fix one at a time.
const messy = parseProfileStep(form([["name", ""], ["memberCount", "lots"]]));
assert.equal(messy.ok, false);
if (!messy.ok) {
  assert.equal(Object.keys(messy.errors).length, 4); // name, formats, ages, memberCount
}

console.log("listing-draft: all assertions passed");

// Age groups are chips stored as one comma-separated string, legacy's format.
import { parseTokens, joinTokens } from "../listing-draft";

assert.deepEqual(parseTokens("All ages, Under 18"), ["All ages", "Under 18"]);
assert.deepEqual(parseTokens("All ages\nUnder 18"), ["All ages", "Under 18"]);
assert.deepEqual(parseTokens("  All ages ,, "), ["All ages"]);
assert.deepEqual(parseTokens(null), []);
assert.equal(joinTokens(["All ages", " Under 18 ", ""]), "All ages, Under 18");

// The form posts one field per chip, and they arrive joined.
const chips = new FormData();
for (const [k, v] of complete.filter(([k]) => k !== "ages")) chips.append(k, v);
chips.append("ages", "All ages");
chips.append("ages", "Under 18");
const parsedChips = parseProfileStep(chips);
assert.equal(parsedChips.ok, true);
if (parsedChips.ok) assert.equal(parsedChips.value.ages, "All ages, Under 18");

console.log("listing-draft tokens: all assertions passed");
