import assert from "node:assert/strict";
import {
  metaSummary, metaTakeaways, META_CAVEATS, NOTHING_YET,
} from "../meta-takeaways";

const factions = [
  { factionId: "death-guard", label: "Death Guard", games: 12, winRate: 66.7,
    appearances: 14, averageVp: 72.5 },
  { factionId: "aeldari", label: "Aeldari", games: 20, winRate: 45,
    appearances: 22, averageVp: 80.1 },
];
const detachments = [
  { label: "Mortarion's Hammer", parent: "Death Guard", games: 9, winRate: 77.8 },
];
const dispositions = [
  { label: "Purge the Foe", parent: "Mortarion's Hammer", games: 6, winRate: 83.3 },
];

// ----------------------------------------------------------- the summary
{
  const said = metaSummary({
    lensLabel: "Last 3 months", factions, detachments, dispositions,
  });
  assert.equal(said,
    "Death Guard leads the last 3 months sample at 66.7% from 12 scored games. "
    + "Mortarion's Hammer is the strongest detachment signal for Death Guard. "
    + "Purge the Foe is the strongest recorded disposition for Mortarion's Hammer.");
}

{
  // Nothing played is legacy's own sentence, not a chart with no bars in it.
  assert.equal(metaSummary({
    lensLabel: "Last 30 days", factions: [], detachments: [], dispositions: [],
  }), NOTHING_YET);

  // One faction and nothing under it still says the one true thing.
  assert.equal(metaSummary({
    lensLabel: "All time", factions: [factions[0]!], detachments: [], dispositions: [],
  }), "Death Guard leads the all time sample at 66.7% from 12 scored games.");
}

{
  // One game is a game, not "1 games".
  const one = [{ ...factions[0]!, games: 1 }];
  assert.ok(metaSummary({ lensLabel: "Last 30 days", factions: one,
    detachments: [], dispositions: [] }).endsWith("from 1 scored game."));
}

// ---------------------------------------------------------- the bullets
{
  const lines = metaTakeaways({
    factions, detachments, dispositions,
    matchups: [{ label: "Death Guard", opponent: "Aeldari", games: 5, winRate: 80 }],
    missions: [{ value: "Purge the Foe", games: 11 }],
    terrain: [{ value: "Ruins", games: 9 }],
    units: [{ unitName: "Plague Marines", label: "Death Guard", mvp: 7 }],
  });

  assert.equal(lines[0], "Death Guard tops this view at 66.7% over 12 games.");
  // Most PLAYED is by appearances, not by rate: Aeldari turn up more often and
  // win less, which is the whole point of showing both.
  assert.ok(lines[1]!.startsWith("Aeldari is the most played faction"));
  // Highest average VP is a third ordering again, and Aeldari lead that too.
  assert.ok(lines.some((l) => l.startsWith("Aeldari is posting the highest average total VP")));
  assert.ok(lines.some((l) => l.includes("strongest matchup signal into Aeldari at 80.0%")));
  assert.ok(lines.some((l) => l.includes("busiest mission in this window with 11 logged games")));
}

{
  // Nothing to say is nothing said, never a bullet with a zero in it.
  const lines = metaTakeaways({
    factions: [], detachments: [], dispositions: [],
    matchups: [], missions: [], terrain: [], units: [],
  });
  assert.deepEqual(lines, []);
}

// ---------------------------------------------------------- the caveats
{
  assert.equal(META_CAVEATS.length, 6);
  // The two that are this build's own honesty, not legacy's.
  assert.ok(META_CAVEATS.some((c) => c.includes("once the club has confirmed")));
  assert.ok(META_CAVEATS.some((c) => c.includes("do not create synthetic wins or losses")));
  // No em dashes anywhere in copy a member reads.
  assert.ok(META_CAVEATS.every((c) => !c.includes("—")));
}

console.log("meta-takeaways: all pass");
