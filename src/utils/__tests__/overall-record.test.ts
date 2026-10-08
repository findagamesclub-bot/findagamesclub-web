import assert from "node:assert/strict";
import {
  allSources, combine, recordLine, sourceOf, SOURCES, SOURCE_LABELS, SOURCE_NOTES,
  type SourceRecord,
} from "../overall-record";

const rows: SourceRecord[] = [
  { source: "club", played: 12, wins: 7, draws: 1, losses: 4 },
  { source: "event", played: 5, wins: 2, draws: 0, losses: 3 },
  { source: "league", played: 6, wins: 3, draws: 1, losses: 2 },
];

// The headline is the three added up, in the order a record is written.
assert.deepEqual(combine(rows), { played: 23, wins: 12, draws: 2, losses: 9 });
assert.equal(recordLine(combine(rows)), "12-2-9");

// A source nobody has played reads as zero rather than as missing, so the
// panel can say "none yet" about it instead of leaving a hole in the three.
assert.deepEqual(sourceOf([rows[0]], "league"),
  { source: "league", played: 0, wins: 0, draws: 0, losses: 0 });
assert.equal(allSources([]).length, 3);
assert.deepEqual(allSources(rows).map((r) => r.source), SOURCES);

// Order is the util's, never the database's.
assert.deepEqual(allSources([...rows].reverse()).map((r) => r.source), SOURCES);

// Nothing at all adds up to nothing, and never to NaN.
assert.deepEqual(combine([]), { played: 0, wins: 0, draws: 0, losses: 0 });

// Every source has a label and a note, or a new one would render blank.
for (const source of SOURCES) {
  assert.ok(SOURCE_LABELS[source], `${source} has no label`);
  assert.ok(SOURCE_NOTES[source], `${source} has no note`);
}

console.log("overall-record: all pass");
