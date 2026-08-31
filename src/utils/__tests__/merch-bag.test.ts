import assert from "node:assert/strict";
import { addLine, needsQuote, priceBag, removeLine, reviveBag, setQuantity } from "../merch-bag";
import type { MerchItem, ShopStanding } from "@/types/clubExtras";

const item = (id: number, name: string, price: string, stock = 10,
              extra: Partial<MerchItem> = {}): MerchItem => ({
  id, name, category: null, description: null, image: null, price, stock,
  soldOut: stock === 0, blockedReason: null, ...extra,
});

const ITEMS = [item(1, "Club t shirt", "£15"), item(2, "Club Jumper", "£25")];

const standing = (over: Partial<ShopStanding> = {}): ShopStanding => ({
  discountPercent: 10, tierLabel: "Premium", points: 500, pointValue: 0.01,
  redemptionCapPercent: 100, offer: null, earnPerOrder: 5, ...over,
});

// --- lines -----------------------------------------------------------------
assert.deepEqual(addLine([], 1), [{ itemId: 1, quantity: 1 }]);
assert.deepEqual(addLine([{ itemId: 1, quantity: 2 }], 1), [{ itemId: 1, quantity: 3 }]);
assert.deepEqual(addLine([{ itemId: 1, quantity: 1 }], 2, 3),
  [{ itemId: 1, quantity: 1 }, { itemId: 2, quantity: 3 }]);
assert.deepEqual(setQuantity([{ itemId: 1, quantity: 3 }], 1, 0), [], "zero removes the line");
assert.deepEqual(setQuantity([{ itemId: 1, quantity: 3 }], 1, 99), [{ itemId: 1, quantity: 20 }]);
assert.deepEqual(removeLine([{ itemId: 1, quantity: 1 }], 1), []);

// --- pricing ---------------------------------------------------------------
const bag = priceBag({ lines: [{ itemId: 1, quantity: 2 }, { itemId: 2, quantity: 1 }],
                       items: ITEMS, standing: standing(), points: 0 });
assert.equal(bag.count, 3);
assert.equal(bag.subtotal, 55);              // 15*2 + 25
assert.equal(bag.tierDiscount, 5.5);         // 1.50*2 + 2.50
assert.equal(bag.total, 49.5);

// 100% cap, 500 points at 1p = £5.00 off.
const withPoints = priceBag({ lines: [{ itemId: 2, quantity: 1 }], items: ITEMS,
                              standing: standing(), points: 500 });
assert.equal(withPoints.maxPoints, 500);
assert.equal(withPoints.pointsOff, 5);
assert.equal(withPoints.total, 17.5);        // 25 less 10% less £5

// The cap, not the balance, is what usually binds. 50% of £22.50 is £11.25,
// which at 1p a point is 1125 points, more than the 500 held.
assert.equal(priceBag({ lines: [{ itemId: 2, quantity: 1 }], items: ITEMS,
                        standing: standing({ redemptionCapPercent: 50 }), points: 9999 }).maxPoints, 500);

// Didcot: the cap is zero, so points are not money here at all.
const noPoints = priceBag({ lines: [{ itemId: 2, quantity: 1 }], items: ITEMS,
                            standing: standing({ redemptionCapPercent: 0 }), points: 400 });
assert.equal(noPoints.maxPoints, 0);
assert.equal(noPoints.pointsOff, 0, "asking for points cannot take money off when the cap is 0");

// Per-unit rounding, mirroring the SQL. 33% of £19.99 is £6.60 a unit, so three
// come to £40.17, not the £40.16 a discount on the line total would give.
const odd = priceBag({ lines: [{ itemId: 3, quantity: 3 }], items: [item(3, "Dice", "£19.99")],
                       standing: standing({ discountPercent: 33 }), points: 0 });
assert.equal(odd.tierDiscount, 19.8);
assert.equal(Math.round(odd.total * 100) / 100, 40.17);

// --- a price that is not a price ---------------------------------------------
const quoted = priceBag({ lines: [{ itemId: 6, quantity: 2 }, { itemId: 1, quantity: 1 }],
                          items: [...ITEMS, item(6, "Terrain board", "Ask at the desk")],
                          standing: standing(), points: 0 });
assert.equal(quoted.lines[0].quoted, true);
assert.equal(quoted.quotedCount, 1);
// It contributes nothing to the total rather than being counted as free.
assert.equal(quoted.subtotal, 15);
assert.equal(quoted.total, 13.5);

// "£0" and "Free" are the club saying it costs nothing, which is not the same
// as the club not having said what it costs.
assert.equal(needsQuote("£0"), false);
assert.equal(needsQuote("Free"), false);
assert.equal(needsQuote("Free to members"), false);
assert.equal(needsQuote("£12.50"), false);
assert.equal(needsQuote("TBC"), true);
assert.equal(needsQuote("Ask at the desk"), true);
assert.equal(needsQuote(""), true);
assert.equal(needsQuote(null), true);

// --- problems --------------------------------------------------------------
const stale = priceBag({ lines: [{ itemId: 4, quantity: 3 }], items: [item(4, "Mat", "£30", 1)],
                         standing: standing(), points: 0 });
assert.equal(stale.lines[0].problem, "Only 1 left");

const gone = priceBag({ lines: [{ itemId: 5, quantity: 1 }], items: [item(5, "Tee", "£10", 0)],
                        standing: standing(), points: 0 });
assert.equal(gone.lines[0].problem, "Sold out since you added it");
assert.equal(gone.blocked, true);

// --- revive ----------------------------------------------------------------
assert.deepEqual(reviveBag([{ itemId: 1, quantity: 2 }, { itemId: 99, quantity: 1 }], ITEMS),
  [{ itemId: 1, quantity: 2 }], "an item the club deleted drops out");
assert.deepEqual(reviveBag("nonsense", ITEMS), []);
assert.deepEqual(reviveBag([{ itemId: 1, quantity: "x" }], ITEMS), [{ itemId: 1, quantity: 1 }]);

console.log("merch-bag ok");
