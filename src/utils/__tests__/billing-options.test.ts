import assert from "node:assert/strict";
import {
  cadenceLabel, cadenceOf, headlineLine, headlineOf, normaliseOptions, optionRows,
} from "../billing-options";

// --------------------------------------------------- legacy's eight spellings
{
  for (const said of ["month", "Monthly", "per-month", "PER_MONTH"]) {
    assert.equal(cadenceOf(said), "month", said);
  }
  for (const said of ["year", "yearly", "Annual", "annually", "per_year"]) {
    assert.equal(cadenceOf(said), "year", said);
  }
  for (const said of ["one-off", "oneoff", "one_off", "once"]) {
    assert.equal(cadenceOf(said), "one-off", said);
  }
  // Anything else is "ask us", not a guess.
  assert.equal(cadenceOf("per week"), "");
  assert.equal(cadenceOf(null), "");
}

// ------------------------------------------------------------- the label rule
{
  assert.equal(cadenceLabel("month"), "Monthly");
  assert.equal(cadenceLabel("one-off"), "One-off");
  // A typed label wins, which is what lets a club call it "Season ticket".
  assert.equal(cadenceLabel("year", "Season ticket"), "Season ticket");
  // No cadence and no label is legacy's own fallback, not a blank.
  assert.equal(cadenceLabel(""), "Offline payment");
}

// ------------------------------------------------- what reaches the column
{
  const saved = normaliseOptions([
    { label: "", price: "15", cadence: "month" },
    { label: "", price: "150", cadence: "year" },
    { label: "", price: "500", cadence: "one-off" },
  ], "premium");

  assert.deepEqual(saved.map((o) => o.id),
    ["premium-month", "premium-year", "premium-one-off"]);
  assert.deepEqual(saved.map((o) => o.label), ["Monthly", "Yearly", "One-off"]);
  assert.deepEqual(saved.map((o) => o.position), [1, 2, 3]);
  // priceDuration and cadence are the same fact twice, which is legacy's shape
  // and what every existing reader of the column expects.
  assert.ok(saved.every((o) => o.priceDuration === o.cadence));
}

{
  // Pressing Add and changing your mind leaves an empty row, which drops out
  // rather than refusing the whole save.
  const saved = normaliseOptions([
    { label: "", price: "15", cadence: "month" },
    { label: "", price: "", cadence: "" },
  ], "premium");
  assert.equal(saved.length, 1);
  assert.equal(saved[0]!.position, 1);
}

{
  // Two of the same cadence would collide on the generated id, so the second
  // takes its position. Nothing in the app can address an option that shares
  // an id with another one.
  const saved = normaliseOptions([
    { price: "15", cadence: "month" },
    { price: "12", cadence: "month", label: "Concession" },
  ], "premium");
  assert.deepEqual(saved.map((o) => o.id), ["premium-month", "premium-month-2"]);

  // An id already on the row is kept, so editing a price does not re-key it.
  const kept = normaliseOptions([
    { id: "premium-membership-month", price: "16", cadence: "month" },
  ], "premium");
  assert.equal(kept[0]!.id, "premium-membership-month");
}

{
  // An older club with a bare price and no list gets one synthesised, which is
  // legacy's fallback. Without it the tier would read as free.
  const saved = normaliseOptions([], "basic", "10", "month");
  assert.deepEqual(saved, [{
    id: "basic-month", label: "Monthly", price: "10",
    priceDuration: "month", cadence: "month", position: 1,
  }]);

  // No price and no options really is free.
  assert.deepEqual(normaliseOptions([], "basic", "", ""), []);
}

// ------------------------------------- the headline IS the first option
{
  const saved = normaliseOptions([
    { price: "15", cadence: "month" },
    { price: "150", cadence: "year" },
  ], "premium");
  assert.deepEqual(headlineOf(saved), { price: "15", price_duration: "month" });

  // Reorder and the headline follows, because a club leading with its yearly
  // price is a decision the editor has to be able to express.
  const yearlyFirst = normaliseOptions([
    { price: "150", cadence: "year" },
    { price: "15", cadence: "month" },
  ], "premium");
  assert.deepEqual(headlineOf(yearlyFirst), { price: "150", price_duration: "year" });

  // The bug the client screenshotted, in one assertion: a tier cannot carry a
  // price its own payment options do not offer.
  assert.equal(headlineOf(saved).price, saved[0]!.price);
}

{
  // No options: the fallback is what was typed, never an invented figure.
  assert.deepEqual(headlineOf([], "120", "one-off"),
    { price: "120", price_duration: "one-off" });
  assert.deepEqual(headlineOf([]), { price: "", price_duration: "" });
}

// ---------------------------------------------- reading a saved tier back
{
  // Didcot's own shape, straight out of the import.
  const rows = optionRows([
    { id: "premium-membership-month", label: "Monthly", price: "£15",
      priceDuration: "month", cadence: "month", position: 1 },
    { id: "premium-membership-year", label: "Yearly", price: "£150",
      priceDuration: "year", cadence: "year", position: 2 },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.id, "premium-membership-month");
  assert.equal(rows[0]!.cadence, "month");

  // A club that only ever had one price sees it, rather than an empty editor
  // over the top of a price that is live on its page.
  assert.deepEqual(optionRows([], "10", "month"),
    [{ id: "", label: "", price: "10", cadence: "month" }]);
  assert.deepEqual(optionRows([], "", ""), []);
  assert.deepEqual(optionRows(null, "", ""), []);
}

// ------------------------------------------------- what the owner is told
{
  assert.match(headlineLine([{ id: "", label: "", price: "15", cadence: "month" }]),
    /^Your club page leads with £15 a month\.$/);
  assert.match(headlineLine([{ id: "", label: "", price: "500", cadence: "one-off" }]),
    /£500, one-off/);
  // A price already carrying its symbol is not given a second one.
  assert.match(headlineLine([{ id: "", label: "", price: "£15", cadence: "month" }]),
    /leads with £15 a month/);

  // The singular, which is the slip stage 5 shipped across twenty nouns.
  const two = headlineLine([
    { id: "", label: "", price: "15", cadence: "month" },
    { id: "", label: "", price: "150", cadence: "year" },
  ]);
  assert.match(two, /1 other way to pay sits under it\./);
  const three = headlineLine([
    { id: "", label: "", price: "15", cadence: "month" },
    { id: "", label: "", price: "150", cadence: "year" },
    { id: "", label: "", price: "500", cadence: "one-off" },
  ]);
  // The verb agrees too. "2 other ways to pay sits under it" is half a
  // sentence pluralised, and it reached the screen.
  assert.match(three, /2 other ways to pay sit under it\./);
  assert.ok(!/ways to pay sits/.test(three));

  assert.match(headlineLine([]), /No fee/);
  assert.match(headlineLine([{ id: "", label: "", price: "", cadence: "month" }]),
    /Add a price/);
}

console.log("billing-options: all pass");
