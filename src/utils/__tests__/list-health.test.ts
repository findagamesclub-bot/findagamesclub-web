import assert from "node:assert/strict";
import { listHealth } from "../list-health";
import { tagsFor, primaryTagFor } from "../list-tags";
import type { ListLine } from "../army-list";

const line = (unitName: string, quantity: number, linePoints: number): ListLine => ({
  unitName, optionLabel: "Default", optionModelCount: null,
  quantity, unitPoints: Math.round(linePoints / quantity), linePoints,
});

// ------------------------------------------------------------------- tags
{
  // Substring, case-insensitive, and a unit can hold several jobs at once.
  assert.deepEqual([...tagsFor("Predator Annihilator")].sort(), ["antiTank"]);
  assert.ok(tagsFor("Land Raider").has("durable"));
  assert.ok(tagsFor("Repulsor Grav-tank").has("antiTank"));  // matched inside the name

  // Worth pinning: "Castigator" carries no keyword at all, so the Sororitas
  // tank falls through to the objective fallback. That is legacy's behaviour
  // and it is why the tagger is a heuristic rather than a datasheet.
  assert.deepEqual([...tagsFor("Castigator")], ["objective"]);
  assert.ok(tagsFor("Seraphim Squad").has("mobility"));
  assert.ok(tagsFor("Scout Squad").has("objective"));
  assert.ok(tagsFor("Scout Squad").has("action"));

  // Nothing matched is never nothing: a terminator anchors, anything else is
  // a body on an objective. An unknown unit still occupies space.
  assert.deepEqual([...tagsFor("Aestred Thurga")], ["objective"]);
  assert.deepEqual([...tagsFor("Cataphractii Terminators")], ["durable"]);
  assert.deepEqual([...tagsFor("")], ["objective"]);

  // The primary tag follows the declared order, not the match order.
  assert.equal(primaryTagFor("Grav-tank"), "antiTank");
  assert.equal(primaryTagFor("Aestred Thurga"), "objective");
}

const bare = { detachments: [], dispositionsFor: () => [] };

// ------------------------------------------------------------- the ladder
{
  // One anti-tank piece at 2,000 is the high-severity case, and a high
  // severity sets the label whatever else is true.
  const out = listHealth({
    ...bare, pointsLimit: 2000, totalPoints: 1000,
    units: [line("Predator", 1, 200), line("Intercessor Squad", 3, 300),
            line("Captain", 1, 100), line("Outrider Squad", 2, 400)],
  });
  assert.equal(out.flaggedIssues[0].title, "Anti-tank looks light");
  assert.equal(out.flaggedIssues[0].severity, "high");
  assert.equal(out.healthSummary.label, "Needs attention");
  // One reads as one, and nought reads as "Nothing in the list is", never as
  // "Only 0 ... selection".
  assert.ok(out.flaggedIssues[0].detail.startsWith("Only one selection is"));
  // The reason names what is flagged rather than repeating the first card's
  // own sentence directly above it.
  assert.ok(out.healthSummary.reason.startsWith("Anti-tank looks light,"));
  assert.ok(!out.healthSummary.reason.includes(out.flaggedIssues[0].detail));
}
{
  // Exactly two is its own middle rung, not a strength and not a crisis.
  const out = listHealth({
    ...bare, pointsLimit: 2000, totalPoints: 1200,
    units: [line("Predator", 2, 400), line("Intercessor Squad", 3, 300),
            line("Captain", 1, 100), line("Outrider Squad", 2, 400)],
  });
  const antiTank = out.flaggedIssues.find((i) => i.title.startsWith("Anti-tank"));
  assert.equal(antiTank?.severity, "medium");
  assert.ok(!out.strengths.some((s) => s.includes("anti-tank threats")));
}
{
  // The limit is what makes anti-tank and mobility high-stakes. The same list
  // at 1,000 points is not flagged for either.
  const small = listHealth({
    ...bare, pointsLimit: 1000, totalPoints: 500,
    units: [line("Predator", 1, 200), line("Intercessor Squad", 3, 300)],
  });
  assert.ok(!small.flaggedIssues.some((i) => i.title === "Anti-tank looks light"));
  assert.ok(!small.flaggedIssues.some((i) => i.title === "Mobility looks limited"));
}

// ------------------------------------------------- duplicates and points
{
  // Two of something that neither scores nor does actions is a repeated job.
  // Three of a scoring unit is board coverage and is not flagged.
  const out = listHealth({
    ...bare, pointsLimit: 2000, totalPoints: 1000,
    units: [line("Predator", 3, 600), line("Intercessor Squad", 3, 400)],
  });
  assert.equal(out.duplicateUnits.length, 1);
  assert.equal(out.duplicateUnits[0].unitName, "Predator");
  assert.ok(out.flaggedIssues.some((i) => i.title.includes("duplicated heavily")));
}
{
  // 45% in the top two is the line. 600 of 1000 is over it.
  const heavy = listHealth({
    ...bare, pointsLimit: 2000, totalPoints: 1000,
    units: [line("Predator", 1, 350), line("Land Raider", 1, 250),
            line("Intercessor Squad", 4, 400)],
  });
  assert.ok(heavy.flaggedIssues.some((i) => i.title.includes("points sit in a few units")));

  // 30% or under is the strength. It takes a lot of even lines to get there,
  // which is the point of the measure: two big pieces is the normal shape.
  const spread = listHealth({
    ...bare, pointsLimit: 2000, totalPoints: 1000,
    units: Array.from({ length: 10 }, (_, i) =>
      line(`Intercessor Squad ${i}`, 1, 100)),
  });
  assert.equal(spread.summary.topTwoLinePoints, 200);
  assert.ok(spread.strengths.some((s) => s.includes("spread fairly evenly")));
}

// ------------------------------------------------------- the empty case
{
  // No units at all must not throw, and must not claim anything.
  const out = listHealth({ ...bare, pointsLimit: 2000, totalPoints: 0, units: [] });
  assert.equal(out.summary.uniqueUnits, 0);
  assert.equal(out.healthSummary.label, "Needs attention");
  assert.ok(out.flaggedIssues.length >= 2);
  assert.ok(out.roleBalance.every((r) => r.status === "weak"));
  // Nought in words. "Only 0 clearly anti-tank-tagged selection" went in front
  // of the client, and it is the stage 5 singular slip in a new place.
  const none = out.flaggedIssues.find((i) => i.title === "Anti-tank looks light");
  assert.ok(none?.detail.startsWith("Nothing in the list is tagged as anti-tank"));
  assert.ok(!/\b0\b/.test(none?.detail ?? ""));
}

// ----------------------------------------------- the disposition rung
{
  // A blank disposition only counts when the detachment had one to offer.
  const offered = listHealth({
    pointsLimit: 2000, totalPoints: 1200,
    units: [line("Predator", 3, 600), line("Intercessor Squad", 3, 300),
            line("Captain", 1, 100), line("Outrider Squad", 2, 200)],
    detachments: [{ detachment: "Shield Host", disposition: "" }],
    dispositionsFor: () => ["Auric Champions"],
  });
  assert.ok(offered.flaggedIssues.some((i) => i.title === "Disposition still to choose"));
  assert.equal(offered.configurationReadiness.isComplete, false);

  const nothingToChoose = listHealth({
    pointsLimit: 2000, totalPoints: 1200,
    units: [line("Predator", 3, 600), line("Intercessor Squad", 3, 300),
            line("Captain", 1, 100), line("Outrider Squad", 2, 200)],
    detachments: [{ detachment: "Shield Host", disposition: "" }],
    dispositionsFor: () => [],
  });
  assert.ok(!nothingToChoose.flaggedIssues.some((i) => i.title === "Disposition still to choose"));
  assert.equal(nothingToChoose.configurationReadiness.isComplete, true);
}
{
  // It only downgrades a clean list, never an already-flagged one. Ten even
  // lines of one each: three anti-tank, two scoring, two mobile, three
  // support, nothing duplicated and no concentration.
  const tidy = [
    "Predator", "Ballistus Dreadnought", "Eradicator Squad",
    "Intercessor Squad", "Scout Squad",
    "Outrider Squad", "Bike Squad",
    "Captain", "Lieutenant", "Chaplain",
  ].map((name) => line(name, 1, 100));

  const clean = listHealth({
    pointsLimit: 2000, totalPoints: 1000, units: tidy,
    detachments: [{ detachment: "Shield Host", disposition: "" }],
    dispositionsFor: () => ["Auric Champions"],
  });
  assert.equal(clean.flaggedIssues.length, 1, "only the disposition should flag");
  assert.equal(clean.healthSummary.label, "Configuration to complete");

  // With the disposition chosen, the same list is clean.
  const done = listHealth({
    pointsLimit: 2000, totalPoints: 1000, units: tidy,
    detachments: [{ detachment: "Shield Host", disposition: "Auric Champions" }],
    dispositionsFor: () => ["Auric Champions"],
  });
  assert.equal(done.flaggedIssues.length, 0);
  assert.equal(done.healthSummary.label, "Balanced foundation");
  // With nothing flagged the reason falls back to the first strength rather
  // than being left empty.
  assert.equal(done.healthSummary.reason, done.strengths[0]);
}

// ------------------------------------------------------------- the caps
{
  const out = listHealth({
    ...bare, pointsLimit: 2000, totalPoints: 1000,
    units: Array.from({ length: 8 }, (_, i) => line(`Predator ${i}`, 2, 125)),
  });
  assert.ok(out.strengths.length <= 4, "strengths cap at four");
  assert.ok(out.duplicateUnits.length <= 5, "duplicates cap at five");
}

console.log("list-health: all pass");
