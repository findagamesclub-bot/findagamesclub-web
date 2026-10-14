import assert from "node:assert/strict";
import { hasBreakdown, priceRows, savedAmount, savedLine, type Priced } from "../price-lines";

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

console.log("price-lines: all pass");
