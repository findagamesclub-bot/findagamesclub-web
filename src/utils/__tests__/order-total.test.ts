import assert from "node:assert/strict";
import { orderTotalLabel } from "../order-total";

const money = (n: number) => `£${n.toFixed(2)}`;

// A club that priced its kit.
assert.equal(orderTotalLabel({ total: 13.5, lines: [{ price: "£15" }] }, money), "£13.50");

// "Ask at the desk" stores a total of zero. £0.00 tells the club a member took
// a jumper for nothing.
assert.equal(orderTotalLabel({ total: 0, lines: [{ price: "Ask at the desk" }] }, money),
  "To be priced");
assert.equal(orderTotalLabel({ total: 0, lines: [{ price: "TBC" }, { price: null }] }, money),
  "To be priced");

// A real price of zero is a price. "Free" is the club saying it costs nothing.
assert.equal(orderTotalLabel({ total: 0, lines: [{ price: "£0" }] }, money), "£0.00");
assert.equal(orderTotalLabel({ total: 0, lines: [{ price: "Free" }] }, money), "£0.00");

// Mixed: one line is priced, so the total means something.
assert.equal(orderTotalLabel({ total: 13.5, lines: [{ price: "£15" }, { price: "TBC" }] }, money),
  "£13.50");

// An order with no lines at all cannot be judged, so it keeps its total.
assert.equal(orderTotalLabel({ total: 0, lines: [] }, money), "£0.00");

console.log("order-total ok");
