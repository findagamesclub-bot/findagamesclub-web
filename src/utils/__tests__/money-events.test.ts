import assert from "node:assert/strict";
import {
  moneyEventLine, moneyEventNote, moneyEventTone, tidyMethod,
  type MoneyEvent,
} from "../money-events";

/**
 * One vocabulary, checked against the six sections that feed it.
 *
 * The states here are the real ones each table stores, copied from their check
 * constraints. A state nobody translated would render as `paid_on_the_door`
 * on a screen, which is the sort of thing that only shows up in a screenshot.
 */

const event = (over: Partial<MoneyEvent> = {}): MoneyEvent => ({
  id: 1, entityId: 9, side: "", kind: "payment", state: "paid",
  method: "", note: "", at: "2026-11-16T10:00:00Z", automatic: true,
  author: "Owner Eight", ...over,
});

let failed = 0;
const check = (what: string, run: () => void) => {
  try { run(); console.log(`ok   ${what}`); }
  catch (error) { failed += 1; console.log(`FAIL ${what}\n     ${error}`); }
};

check("every stored state has words", () => {
  const states = [
    // club_bookings / club_event_bookings
    "unpaid", "paid_on_the_door", "paid_in_advance",
    // club_coaching_bookings
    "paid",
    // club_membership_payments and listing_payments, written by 0233
    "recorded", "corrected", "subscription", "featured",
    // every refund column
    "not_due", "due", "refunded",
    // club_merchandise_orders
    "placed", "fulfilled", "cancelled", "refund_due",
  ];
  for (const state of states) {
    const line = moneyEventLine(event({ state }));
    assert.notEqual(line, state, `"${state}" came through untranslated`);
    assert.ok(/^[A-Z]/.test(line), `"${state}" did not start with a capital`);
  }
});

check("a method joins the line, and an empty one does not", () => {
  assert.equal(
    moneyEventLine(event({ kind: "refund", state: "refunded", method: "Bank transfer" })),
    "Refunded by Bank transfer");
  assert.equal(moneyEventLine(event({ state: "paid" })), "Marked paid");
});

check("a billing key reads as English", () => {
  assert.equal(tidyMethod("bank_transfer"), "Bank transfer");
  // What a club typed is left exactly as they typed it.
  assert.equal(tidyMethod("Cash"), "Cash");
  assert.equal(tidyMethod(""), "");
});

check("a note is the line, never doubled underneath it", () => {
  const typed = event({ kind: "note", state: "", note: "Settled in person." });
  assert.equal(moneyEventLine(typed), "Settled in person.");
  assert.equal(moneyEventNote(typed), "");
});

check("a refund reads as money leaving and a payment does not", () => {
  assert.equal(moneyEventTone(event({ kind: "refund", state: "refunded" })), "refunded");
  assert.equal(moneyEventTone(event({ kind: "refund", state: "due" })), "waiting");
  assert.equal(moneyEventTone(event({ state: "paid_on_the_door" })), "kept");
  // Unmarking a payment is not good news in green.
  assert.equal(moneyEventTone(event({ state: "unpaid" })), null);
});

if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
console.log("\nall passed");
