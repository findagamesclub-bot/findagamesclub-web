import assert from "node:assert/strict";
import { addRefusal, sizesRefusal, MAX_SIZE_LABEL } from "../shop-sizes";

const at = (label: string, stock = 0) => ({ label, stock });

// The state every item started in: one size with no name, which is the item.
assert.equal(sizesRefusal([at("")]), null);
assert.equal(sizesRefusal([at("S", 2), at("M"), at("L", 3)]), null);

// An item with nothing to sell in cannot be bought at all.
assert.match(sizesRefusal([]) ?? "", /at least one size/);

// The trap this exists for: an unnamed size beside named ones is stock in the
// item's total that the shop's picker never offers.
assert.match(sizesRefusal([at("", 4), at("S", 2)]) ?? "", /Only an item with one size/);
assert.match(sizesRefusal([at(""), at("")]) ?? "", /Only an item with one size/);

// Two of the same, however they were typed.
assert.match(sizesRefusal([at("M"), at("m")]) ?? "", /two sizes called "m"/);
assert.match(sizesRefusal([at("M"), at(" M ")]) ?? "", /two sizes called "M"/);

// A name long enough to break the row.
assert.match(sizesRefusal([at("x".repeat(MAX_SIZE_LABEL + 1))]) ?? "", /at most 24 characters/);
assert.equal(sizesRefusal([at("x".repeat(MAX_SIZE_LABEL))]), null);

// Adding, as you type.
assert.equal(addRefusal([at("S")], "M"), null);
assert.equal(addRefusal([at("S")], "   "), null, "an empty box is not a request");
assert.match(addRefusal([at("S")], "s") ?? "", /already have a size called "s"/);
assert.match(addRefusal([at("S")], " S ") ?? "", /already have a size called "S"/);
assert.match(addRefusal([], "y".repeat(30)) ?? "", /at most 24 characters/);
// The unnamed size is not something you can collide with by name.
assert.equal(addRefusal([at("")], "S"), null);

console.log("shop-sizes: all assertions passed");
