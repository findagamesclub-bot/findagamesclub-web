import assert from "node:assert/strict";
import { priceTickets, type TicketStanding } from "../ticket-pricing";

// The worked example from the migration test: two £30 tickets, Premium member
// on 10% off with a 50% redemption cap and points worth a penny each.
const premium: TicketStanding = {
  subtotal: 60, currency: "GBP", discountPercent: 10, tierLabel: "Premium Member",
  points: 5000, pointValue: 0.01, redemptionCapPercent: 50,
};

const p = priceTickets(premium, 1000);
assert.equal(p.discountAmount, 6);
assert.equal(p.payable, 54);
assert.equal(p.pointsOff, 10);
assert.equal(p.total, 44, "matches what checkout_event_cart wrote");

// The cap floors, it does not refuse: 50% of £54 is £27, so 2700 points max.
assert.equal(priceTickets(premium, 99999).maxPoints, 2700);
assert.equal(priceTickets(premium, 99999).pointsOff, 27);
assert.equal(priceTickets(premium, 99999).total, 27);

// A non-member holds no points at this club, so the field never appears.
const stranger: TicketStanding = {
  ...premium, discountPercent: 0, tierLabel: null, points: 0, redemptionCapPercent: 0,
};
assert.equal(priceTickets(stranger, 500).canRedeem, false);
assert.equal(priceTickets(stranger, 500).pointsOff, 0);
assert.equal(priceTickets(stranger, 500).total, 60);

// A club that never priced a point cannot take them.
assert.equal(priceTickets({ ...premium, pointValue: null }, 100).canRedeem, false);
// A club that runs no redemption.
assert.equal(priceTickets({ ...premium, redemptionCapPercent: 0 }, 100).canRedeem, false);

// A free cart has nothing to take points off.
assert.equal(priceTickets({ ...premium, subtotal: 0 }, 100).canRedeem, false);
assert.equal(priceTickets({ ...premium, discountPercent: 100 }, 100).canRedeem, false);

// Points asked for beyond the balance are held to the balance.
assert.equal(priceTickets({ ...premium, points: 300 }, 99999).maxPoints, 300);

// Rubbish in the field never produces NaN on the page.
assert.equal(priceTickets(premium, NaN).total, 54);
assert.equal(priceTickets(premium, -50).total, 54);
assert.equal(priceTickets(premium, 12.9).pointsOff, 0.12);

console.log("priceTickets: all assertions passed");
