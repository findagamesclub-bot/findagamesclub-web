import assert from "node:assert/strict";
import {
  DEFAULT_TIERS, dueAnniversaries, earnedPoints, redemption, tierFor,
} from "../loyalty";

// --- earnedPoints ---
assert.equal(earnedPoints({ base: 25 }), 25);
assert.equal(earnedPoints({ base: 25, tierBonus: 10 }), 35);
assert.equal(earnedPoints({ base: 10, multiplier: 1.5 }), 15);
assert.equal(earnedPoints({ base: 10, tierBonus: 5, multiplier: 2 }), 30);
assert.equal(earnedPoints({ base: 5, multiplier: 1.5 }), 8, "7.5 rounds to 8");
// A club typing 0 or a negative multiplier must not cost somebody points.
assert.equal(earnedPoints({ base: 10, multiplier: 0 }), 10);
assert.equal(earnedPoints({ base: 10, multiplier: -3 }), 10);
assert.equal(earnedPoints({ base: 0, tierBonus: 50 }), 0, "no base, no award");
assert.equal(earnedPoints({ base: -5 }), 0);

// --- tierFor ---
assert.equal(tierFor(0).tier?.label, "Bronze");
assert.equal(tierFor(99).tier?.label, "Bronze");
assert.equal(tierFor(100).tier?.label, "Silver", "the boundary counts as reached");
assert.equal(tierFor(2000).tier?.label, "Legend");
assert.equal(tierFor(2000).next, null, "nothing above the top");
assert.equal(tierFor(2000).toNext, null);
assert.equal(tierFor(0).toNext, 100);
assert.equal(tierFor(175).tier?.label, "Silver");
assert.equal(tierFor(175).toNext, 75);
// Halfway between Silver (100) and Gold (250).
assert.equal(Math.round(tierFor(175).progress * 100), 50);
assert.equal(tierFor(2000).progress, 1);

// A club listing its tiers out of order must still get a working ladder.
const jumbled = [...DEFAULT_TIERS].reverse();
assert.equal(tierFor(300, jumbled).tier?.label, "Gold");

// --- dueAnniversaries ---
const anniversaries = [{ years: 1, points: 20 }, { years: 2, points: 30 }, { years: 5, points: 60 }];
const base = { anniversaries, membershipId: 3, awarded: new Set<string>() };

const twoYears = dueAnniversaries({ ...base, joinedOn: "2024-02-03", today: "2026-08-26" });
assert.deepEqual(twoYears.map((a) => a.years), [1, 2], "five years has not come round");
assert.equal(twoYears[0].sourceKey, "membership:3::anniversary:1");
assert.equal(twoYears[0].awardedOn, "2025-02-03");

// Already paid ones are not paid twice — this is what makes the award safe to
// run on every read.
const paid = dueAnniversaries({
  ...base, joinedOn: "2024-02-03", today: "2026-08-26",
  awarded: new Set(["membership:3::anniversary:1"]),
});
assert.deepEqual(paid.map((a) => a.years), [2]);

// The day itself counts; the day before does not.
assert.equal(dueAnniversaries({ ...base, joinedOn: "2025-08-26", today: "2026-08-26" }).length, 1);
assert.equal(dueAnniversaries({ ...base, joinedOn: "2025-08-27", today: "2026-08-26" }).length, 0);

// 29 February joiners land on the 28th in a common year, not on 1 March.
assert.equal(
  dueAnniversaries({ ...base, joinedOn: "2024-02-29", today: "2026-01-01" })[0].awardedOn,
  "2025-02-28",
);

assert.deepEqual(dueAnniversaries({ ...base, joinedOn: null, today: "2026-08-26" }), []);

// --- redemption ---
const wallet = { pointValue: 0.01, availablePoints: 5000, subtotal: 30, capPercent: 100 };
assert.deepEqual(redemption({ ...wallet, points: 1000 }), { points: 1000, amount: 10 });
assert.equal(redemption({ ...wallet, points: 0 }).amount, 0);
assert.match(redemption({ ...wallet, points: 9999 }).error!, /do not have that many/);
assert.match(redemption({ ...wallet, points: 100, pointValue: 0 }).error!, /what a point is worth/);

// A 50% cap on a £30 bill is £15, so 2000 points (£20) is refused.
assert.match(redemption({ ...wallet, points: 2000, capPercent: 50 }).error!, /at most 50%/);
assert.equal(redemption({ ...wallet, points: 1500, capPercent: 50 }).amount, 15, "exactly the cap");
assert.match(redemption({ ...wallet, points: 100, capPercent: 0 }).error!, /does not take points/);

console.log("all passing");
