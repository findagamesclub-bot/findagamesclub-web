import assert from "node:assert/strict";
import { siftFactions, siftDetachments } from "../catalogue-filters";

const factions = [
  { id: "adepta-sororitas", label: "Adepta Sororitas" },
  { id: "tau-empire", label: "T'au Empire" },
  { id: "death-guard", label: "Death Guard" },
];

{
  // An empty query is not a filter.
  assert.equal(siftFactions(factions, "").length, 3);
  assert.equal(siftFactions(factions, "   ").length, 3);

  assert.deepEqual(siftFactions(factions, "sorori").map((f) => f.id),
    ["adepta-sororitas"]);
  // By slug too: an admin reading the API sees ids.
  assert.deepEqual(siftFactions(factions, "death-guard").map((f) => f.id),
    ["death-guard"]);
  // Folded on both sides, so the apostrophe and the case do not matter.
  assert.deepEqual(siftFactions(factions, "t'AU").map((f) => f.id), ["tau-empire"]);
  assert.deepEqual(siftFactions(factions, "tau").map((f) => f.id), ["tau-empire"]);
  assert.equal(siftFactions(factions, "orks").length, 0);
}

const detachments = [
  { slug: "hallowed-martyrs", label: "Hallowed Martyrs", dispositions: ["Priority Assets"] },
  { slug: "army-of-faith", label: "Army of Faith", dispositions: ["Take and Hold"] },
  { slug: "penitent-host", label: "Penitent Host", dispositions: null },
];

{
  assert.equal(siftDetachments(detachments, "").length, 3);
  assert.deepEqual(siftDetachments(detachments, "martyr").map((d) => d.slug),
    ["hallowed-martyrs"]);

  // The question worth asking: which of these can take Priority Assets?
  assert.deepEqual(siftDetachments(detachments, "priority").map((d) => d.slug),
    ["hallowed-martyrs"]);

  // A detachment with no dispositions is not a crash.
  assert.deepEqual(siftDetachments(detachments, "penitent").map((d) => d.slug),
    ["penitent-host"]);
  assert.equal(siftDetachments(detachments, "nothing").length, 0);
}

console.log("catalogue-filters: all pass");
