import assert from "node:assert/strict";
import { canonicalGame, knownGames } from "../game-label";

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

// What the result dialog's picker offers. Derived from the synonym list so a
// game added there turns up without anybody remembering to.
{
  const list = knownGames();
  assert.ok(list.includes("Warhammer 40,000"),
    "40k is in the list, which is the one the client asked for by name");
  assert.deepEqual(list, [...new Set(list)], "no duplicates");
  assert.deepEqual(list, [...list].sort((a, b) => a.localeCompare(b, "en-GB")),
    "sorted, so the dropdown does not change order between renders");
  assert.ok(list.every((name) => canonicalGame(name) === name),
    "every option is already its own canonical spelling");
}

console.log("game-label: known games passed");
