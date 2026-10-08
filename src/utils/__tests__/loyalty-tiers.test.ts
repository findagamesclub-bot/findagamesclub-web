import assert from "node:assert/strict";
import {
  anniversaryDrafts, normaliseAnniversaries, normaliseTiers, startsAtZero,
  tierDrafts, tiersProblem, type TierDraft,
} from "../loyalty-tiers";
import { DEFAULT_TIERS } from "../loyalty";

const tier = (label: string, points: string, tone = "", rewards = ""): TierDraft =>
  ({ label, points, tone, rewards });

// ------------------------------------------------- a ladder sorts on the way in
{
  const out = normaliseTiers([
    tier("Gold", "250", "gold"),
    tier("Bronze", "0", "bronze"),
    tier("Silver", "100", "silver"),
  ]);
  assert.deepEqual(out.map((t) => t.label), ["Bronze", "Silver", "Gold"]);
  assert.deepEqual(out.map((t) => t.pointsRequired), [0, 100, 250]);
  // Stored in ladder order, so nothing downstream has to know to sort it.
  assert.ok(out.every((t, i) => i === 0 || t.pointsRequired > out[i - 1]!.pointsRequired));
}

{
  // A row nobody filled in drops out rather than refusing the save: pressing
  // Add and changing your mind is not a mistake.
  const out = normaliseTiers([tier("Bronze", "0"), tier("", ""), tier("Gold", "250")]);
  assert.equal(out.length, 2);
}

{
  // Legacy's tone fallback, so a tier nobody styled still carries a key.
  // `metalOf` turns anything it does not know into bronze, which is why this
  // is never validated against the metal list.
  const out = normaliseTiers([tier("Starter", "0", "")]);
  assert.equal(out[0]!.tone, "tier-1");
  assert.equal(normaliseTiers([tier("Gold", "0", "  GOLD ")])[0]!.tone, "gold");
}

// ------------------------------------------------------- rewards, one per line
{
  const out = normaliseTiers([
    tier("Gold", "250", "gold", "Free table every month\n  10% off kit  \n\nEarly event tickets"),
  ]);
  assert.deepEqual(out[0]!.rewards,
    ["Free table every month", "10% off kit", "Early event tickets"]);
  // Blank lines are not rewards.
  assert.deepEqual(normaliseTiers([tier("Bronze", "0", "", "\n \n")])[0]!.rewards, []);
}

// --------------------------------------- a duplicate threshold is named, not dropped
{
  /**
   * Legacy drops the second one silently (`seen_thresholds`, club_store.py:13689).
   * A club types two tiers at 250, saves, and one is simply not there. Same call
   * STAGE3-SPEC made about a duplicate ticket label: refuse and say which two.
   */
  const clash = tiersProblem([tier("Gold", "250"), tier("Elite", "250")]);
  assert.match(clash, /"Gold" and "Elite" both start at 250 points/);

  assert.equal(tiersProblem([tier("Bronze", "0"), tier("Gold", "250")]), "");
  assert.match(tiersProblem([tier("", "250")]), /points but no name/);
  assert.match(tiersProblem([tier("Gold", "-5")]), /whole number of points/);
  assert.match(tiersProblem([tier("Gold", "nope")]), /whole number of points/);
  // An untouched row is not a problem.
  assert.equal(tiersProblem([tier("Bronze", "0"), tier("", "")]), "");

  // And the normaliser agrees with the guard: it would have dropped one.
  assert.equal(normaliseTiers([tier("Gold", "250"), tier("Elite", "250")]).length, 1);
}

// ----------------------------------------------------------- anniversaries
{
  const out = normaliseAnniversaries([
    { years: "5", points: "60" }, { years: "1", points: "20" },
    { years: "0", points: "10" }, { years: "2", points: "0" },
    { years: "1", points: "99" },
  ]);
  assert.deepEqual(out, [{ years: 1, points: 20 }, { years: 5, points: 60 }]);
}

// ------------------------------------ reading back seeds from the live defaults
{
  // A club with none saved IS running the defaults, so an empty editor over the
  // top of them would read as "no tiers" and the first save would wipe them.
  const seeded = tierDrafts([]);
  assert.equal(seeded.length, DEFAULT_TIERS.length);
  assert.equal(seeded[0]!.label, "Bronze");
  assert.equal(seeded[0]!.points, "0");
  assert.deepEqual(tierDrafts(null).map((t) => t.label),
    DEFAULT_TIERS.map((t) => t.label));

  // A club that has saved its own gets its own, untouched.
  const own = tierDrafts([
    { label: "Recruit", pointsRequired: 0, tone: "navy", rewards: ["A warm welcome"] },
    { label: "Veteran", pointsRequired: 400, tone: "emerald", rewards: [] },
  ]);
  assert.deepEqual(own.map((t) => t.label), ["Recruit", "Veteran"]);
  assert.equal(own[0]!.rewards, "A warm welcome");
  assert.equal(own[1]!.tone, "emerald");

  // Round trip: what comes out of the editor goes back in unchanged.
  assert.deepEqual(tierDrafts(normaliseTiers(own)), own);

  const years = anniversaryDrafts([]);
  assert.ok(years.length > 0, "anniversaries seed from the defaults too");
  assert.deepEqual(anniversaryDrafts([{ years: 3, points: 45 }]),
    [{ years: "3", points: "45" }]);
}

// --------------------------------------------- the first rung, said not refused
{
  assert.equal(startsAtZero([tier("Bronze", "0"), tier("Gold", "250")]), true);
  // A club is allowed to want this; the screen says what it means.
  assert.equal(startsAtZero([tier("Silver", "100"), tier("Gold", "250")]), false);
}

console.log("loyalty-tiers: all pass");
