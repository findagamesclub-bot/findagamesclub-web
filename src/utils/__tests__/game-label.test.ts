import assert from "node:assert/strict";
import { canonicalGame } from "../game-label";

// The two spellings a club's own bookings actually carry.
assert.equal(canonicalGame("warhammer 40k"), "Warhammer 40,000");
assert.equal(canonicalGame("Warhammer 40,000"), "Warhammer 40,000");
assert.equal(canonicalGame("  WARHAMMER 40K  "), "Warhammer 40,000");
assert.equal(canonicalGame("aos"), "Age of Sigmar");

// Anything not in the table keeps the wording the club chose.
assert.equal(canonicalGame("Blood Bowl"), "Blood Bowl");
assert.equal(canonicalGame(""), "Club game");
assert.equal(canonicalGame(null), "Club game");

console.log("game-label ok");
