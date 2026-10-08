import assert from "node:assert/strict";

import { parseEventDraft, publishRefusal, type EventDraft } from "../event-draft";

function form(fields: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const one of Array.isArray(value) ? value : [value]) data.append(key, one);
  }
  return data;
}

const good = { title: "Autumn Open", startDate: "2026-09-26" };

const errorsOf = (fields: Record<string, string | string[]>) => {
  const parsed = parseEventDraft(form(fields));
  assert.equal(parsed.ok, false, "expected a refusal");
  return parsed.ok ? {} : parsed.errors;
};

const valueOf = (fields: Record<string, string | string[]>): EventDraft => {
  const parsed = parseEventDraft(form(fields));
  assert.equal(parsed.ok, true, `expected it to parse: ${JSON.stringify(parsed)}`);
  return parsed.ok ? parsed.value : ({} as EventDraft);
};

// --- what is required ----------------------------------------------------

{
  const errors = errorsOf({ title: "", startDate: "" });
  assert.ok(errors.title, "a name is required");
  assert.ok(errors.startDate, "a start date is required");
}

{
  const value = valueOf(good);
  assert.equal(value.title, "Autumn Open");
  assert.equal(value.roundCount, null, "rounds left blank is not zero rounds");
  assert.deepEqual(value.formats, []);
}

// --- dates ---------------------------------------------------------------

{
  assert.ok(errorsOf({ ...good, startDate: "26/09/2026" }).startDate, "a UK date is refused");
  assert.ok(errorsOf({ ...good, startDate: "2026-02-30" }).startDate, "30 February is refused");
  assert.ok(errorsOf({ ...good, startDate: "2026-13-01" }).startDate, "month 13 is refused");
  assert.ok(errorsOf({ ...good, endDate: "2026-09-25" }).endDate, "ending before it starts");
  assert.ok(parseEventDraft(form({ ...good, endDate: "2026-09-27" })).ok, "a two day event");
  assert.ok(parseEventDraft(form({ ...good, endDate: "2026-09-26" })).ok, "same day is fine");
}

// --- times ---------------------------------------------------------------

{
  assert.ok(errorsOf({ ...good, startTime: "7pm" }).startTime, "12 hour time is refused");
  assert.ok(errorsOf({ ...good, startTime: "25:00" }).startTime, "hour 25 is refused");
  assert.ok(errorsOf({ ...good, startTime: "19:70" }).startTime, "minute 70 is refused");

  assert.ok(
    errorsOf({ ...good, startTime: "19:00", endTime: "18:00" }).endTime,
    "finishing before it starts on one day",
  );
  assert.ok(
    errorsOf({ ...good, startTime: "19:00", endTime: "19:00" }).endTime,
    "finishing at the same minute it starts",
  );
  // An overnight is a real thing, and the dates already say so.
  assert.ok(
    parseEventDraft(form({
      ...good, endDate: "2026-09-27", startTime: "19:00", endTime: "02:00",
    })).ok,
    "an overnight finishing at 02:00 the next day",
  );
  // An end time with no start time has nothing to be before.
  assert.ok(parseEventDraft(form({ ...good, endTime: "22:30" })).ok);
}

// --- rounds --------------------------------------------------------------

{
  assert.equal(valueOf({ ...good, roundCount: "5" }).roundCount, 5);
  assert.equal(valueOf({ ...good, roundCount: "0" }).roundCount, 0, "zero is a real answer");
  assert.ok(errorsOf({ ...good, roundCount: "2.5" }).roundCount, "half a round");
  assert.ok(errorsOf({ ...good, roundCount: "-1" }).roundCount, "negative rounds");
  assert.ok(errorsOf({ ...good, roundCount: "51" }).roundCount, "a typo, not a tournament");
  assert.ok(errorsOf({ ...good, roundCount: "five" }).roundCount, "words are not a number");
}

// --- the link ------------------------------------------------------------

{
  assert.ok(
    parseEventDraft(form({ ...good, bestcoastLink: "bestcoastpairings.com/event/1" })).ok,
    "a scheme-less address is accepted, as it is everywhere else in the app",
  );
  assert.ok(errorsOf({ ...good, bestcoastLink: "javascript:alert(1)" }).bestcoastLink);
  assert.ok(errorsOf({ ...good, bestcoastLink: "not a url" }).bestcoastLink);
}

// --- the rest ------------------------------------------------------------

{
  const value = valueOf({
    ...good,
    venuePostcode: " ox11 7hh ",
    formats: ["Competitive", "  ", "Casual"],
    featuredGames: ["Warhammer 40,000"],
  });
  assert.equal(value.venuePostcode, "OX11 7HH", "a postcode is upper cased and trimmed");
  assert.deepEqual(value.formats, ["Competitive", "Casual"], "blank tokens are dropped");
  assert.deepEqual(value.featuredGames, ["Warhammer 40,000"],
    "a game with a comma in it stays one game");
}

// --- publishing ----------------------------------------------------------

{
  const draft = valueOf(good);
  assert.equal(publishRefusal(draft), null);
  assert.ok(publishRefusal({ ...draft, title: "" }));
  assert.ok(publishRefusal({ ...draft, startDate: "" }));
}

console.log("event-draft: all assertions passed");

// How many the day is for. Its own figure, not the sum of the ticket types: a
// club sells 40 tickets to a 50 player hall and keeps ten back for the door.
{
  const base = { title: "Open day", startDate: "2026-11-14" };
  const form = (extra: Record<string, string>) => {
    const data = new FormData();
    for (const [k, v] of Object.entries({ ...base, ...extra })) data.set(k, v);
    return data;
  };

  const said = parseEventDraft(form({ capacity: "50" }));
  assert.ok(said.ok);
  assert.equal(said.ok && said.value.capacity, 50);

  const silent = parseEventDraft(form({}));
  assert.ok(silent.ok);
  assert.equal(silent.ok && silent.value.capacity, null,
    "not said is a real answer, and nought is a different one");

  const zero = parseEventDraft(form({ capacity: "0" }));
  assert.equal(zero.ok && zero.value.capacity, 0);

  const wrong = parseEventDraft(form({ capacity: "forty" }));
  assert.equal(wrong.ok, false);
  assert.ok(!wrong.ok && wrong.errors.capacity, "and a typo is named on the field");

  const fractional = parseEventDraft(form({ capacity: "12.5" }));
  assert.equal(fractional.ok, false, "half a person is not a capacity");
}

console.log("event-draft: capacity passed");
