import assert from "node:assert/strict";
import { hasBreakdown, priceRows, savedAmount, savedLine, tierSavingLine,
  type Priced } from "../price-lines";

// The client's own merchandise example, which is where the mislabelling was
// found: two shirts at £15, Premium taking 10%, then 54 points at 5p.
const order: Priced = {
  subtotal: 30, tierLabel: "Premium Membership", tierPercent: 10, tierAmount: 3,
  points: 54, pointsAmount: 2.7, total: 24.3,
};

{
  const rows = priceRows(order);
  assert.deepEqual(rows.map((row) => row.key), ["subtotal", "tier", "points", "total"]);
  assert.equal(rows[0]!.value, "£30.00");
  assert.equal(rows[1]!.label, "Premium Membership discount · 10%");
  assert.equal(rows[1]!.value, "− £3.00");
  assert.equal(rows[2]!.label, "54 points");
  assert.equal(rows[2]!.value, "− £2.70");
  assert.equal(rows[3]!.value, "£24.30");

  // The rows have to add up, or the breakdown is decoration.
  assert.equal(order.subtotal - order.tierAmount - order.pointsAmount, order.total);
}

// The two savings are never added together and credited to the tier. That is
// exactly what the merchandise card did: "£5.70 off as Premium Membership".
assert.equal(savedAmount(order), 5.7);
assert.equal(savedLine(order),
  "£3.00 off as Premium Membership · £2.70 off with 54 points");
assert.ok(!savedLine(order)!.includes("£5.70"),
  "the combined figure must never be presented as one saving");

// A line is only drawn when it did something.
{
  const plain: Priced = {
    subtotal: 5, tierLabel: null, tierPercent: 0, tierAmount: 0,
    points: 0, pointsAmount: 0, total: 5,
  };
  assert.deepEqual(priceRows(plain).map((row) => row.key), ["subtotal", "total"]);
  assert.equal(savedLine(plain), null);
  assert.equal(hasBreakdown(plain), false);
}

// A tier with no money off is not a saving, whatever the label says. A club
// can hold somebody on a tier whose discount is zero.
{
  const free: Priced = {
    subtotal: 5, tierLabel: "Standard", tierPercent: 0, tierAmount: 0,
    points: 0, pointsAmount: 0, total: 5,
  };
  assert.deepEqual(priceRows(free).map((row) => row.key), ["subtotal", "total"]);
  assert.equal(hasBreakdown(free), false);
}

// Points with no tier, which is every member of a club that sells one tier.
{
  const pointsOnly: Priced = {
    subtotal: 10, tierLabel: null, tierPercent: 0, tierAmount: 0,
    points: 1, pointsAmount: 0.05, total: 9.95,
  };
  const rows = priceRows(pointsOnly);
  assert.deepEqual(rows.map((row) => row.key), ["subtotal", "points", "total"]);
  // One point is a point, not "1 points". The stage 5 singular lesson.
  assert.equal(rows[1]!.label, "1 point");
  assert.equal(savedLine(pointsOnly), "£0.05 off with 1 point");
}

// A tier the club recorded with no label still reads as something.
{
  const unnamed: Priced = {
    subtotal: 20, tierLabel: "", tierPercent: 5, tierAmount: 1,
    points: 0, pointsAmount: 0, total: 19,
  };
  assert.equal(priceRows(unnamed)[1]!.label, "Member discount · 5%");
  assert.equal(savedLine(unnamed), "£1.00 off as a member");
}

// A discount with no percentage recorded says the amount and stops, rather
// than printing "· 0%" and claiming a rule that is not the one that applied.
{
  const flat: Priced = {
    subtotal: 20, tierLabel: "Life Member", tierPercent: 0, tierAmount: 4,
    points: 0, pointsAmount: 0, total: 16,
  };
  assert.equal(priceRows(flat)[1]!.label, "Life Member discount");
}

// The labels are overridable, because a table booking is not a subtotal: the
// desk calls it "Pay as you play" and says "You pay".
{
  const rows = priceRows(order, { subtotal: "Pay as you play", total: "You pay" });
  assert.equal(rows[0]!.label, "Pay as you play");
  assert.equal(rows.at(-1)!.label, "You pay");
}

// Another currency is formatted, not assumed away.
assert.equal(priceRows({ ...order, currency: "EUR" })[0]!.value, "EUR 30.00");

// The coaching card quotes a tier discount BEFORE anything is booked, so it
// has no `Priced` to hand over: it builds the three figures it holds. The
// point of the shared function is that both routes say the same sentence, so
// the test compares them rather than pinning each one's wording separately.
{
  const quoted = { tierAmount: 5, tierLabel: "Life Member", currency: "GBP" };
  assert.equal(tierSavingLine(quoted), "£5.00 off as Life Member");

  const booked: Priced = {
    subtotal: 25, tierLabel: "Life Member", tierPercent: 20, tierAmount: 5,
    points: 0, pointsAmount: 0, total: 20,
  };
  assert.equal(tierSavingLine(quoted), savedLine(booked));
}

// A club that has not named its tier still gets a sentence, and a session with
// nothing off gets none: a line reading "£0.00 off" is a saving that did not
// happen.
assert.equal(
  tierSavingLine({ tierAmount: 2.5, tierLabel: null, currency: "GBP" }),
  "£2.50 off as a member");
assert.equal(tierSavingLine({ tierAmount: 0, tierLabel: "Life Member", currency: "GBP" }), null);

console.log("price-lines: all pass");
