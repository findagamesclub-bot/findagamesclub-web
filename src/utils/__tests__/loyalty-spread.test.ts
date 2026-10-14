import assert from "node:assert/strict";
import { ladderSpread } from "../loyalty-spread";
import { DEFAULT_TIERS, type LoyaltyTier } from "../loyalty";

// Bronze 0, Silver 100, Gold 250, Platinum 500, Legend 1000.
{
  const spread = ladderSpread([0, 50, 100, 260, 999, 1000, 5000]);
  const at = (label: string) => spread.find((r) => r.label === label)!.members;

  assert.equal(spread.length, DEFAULT_TIERS.length, "every rung comes back");
  assert.equal(at("Bronze"), 2, "zero and fifty are both on the bottom rung");
  assert.equal(at("Silver"), 1);
  assert.equal(at("Gold"), 1);
  assert.equal(at("Platinum"), 1, "999 has not reached Legend");
  assert.equal(at("Legend"), 2);
}

// A rung nobody is on is still a rung. Dropping it reads as a ladder that
// stops, which is the opposite of what a club wants to know.
{
  const spread = ladderSpread([0, 0, 0]);
  assert.equal(spread.length, DEFAULT_TIERS.length);
  assert.equal(spread.find((r) => r.label === "Legend")!.members, 0);
}

// The CLUB'S ladder, not the default one. Didcot runs six rungs with a sixth
// called Rock Star at 2,000, which the default list has never heard of.
{
  const theirs: LoyaltyTier[] = [
    { label: "Recruit", pointsRequired: 0, tone: "bronze", rewards: [] },
    { label: "Captain", pointsRequired: 500, tone: "gold", rewards: [] },
    { label: "Rock Star", pointsRequired: 2000, tone: "rainbow", rewards: [] },
  ];
  const spread = ladderSpread([10, 750, 2130], theirs);
  assert.deepEqual(spread.map((r) => `${r.label}:${r.members}`),
    ["Recruit:1", "Captain:1", "Rock Star:1"]);
}

// An empty ladder falls back rather than returning nothing, which is what the
// club page already does: a club with no tiers saved IS running the defaults.
{
  assert.equal(ladderSpread([0], []).length, DEFAULT_TIERS.length);
}

// Nobody on the roster is an empty ladder of the right shape, not an error.
{
  const spread = ladderSpread([]);
  assert.equal(spread.length, DEFAULT_TIERS.length);
  assert.ok(spread.every((r) => r.members === 0));
}

console.log("loyalty-spread: all assertions passed");
