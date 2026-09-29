import assert from "node:assert/strict";
import {
  META_TABS, READS_FOR, readTab, readsFor, DEFAULT_TAB,
  type MetaRead, type MetaTab,
} from "../meta-tabs";

{
  assert.equal(readTab("units"), "units");
  assert.equal(readTab("trend"), "trend");
  // A hand-typed URL cannot break the page.
  assert.equal(readTab("nonsense"), DEFAULT_TAB);
  assert.equal(readTab(undefined), DEFAULT_TAB);
  assert.equal(readTab(7), DEFAULT_TAB);
}

{
  // Every tab has at least one read. A tab with none renders its empty state
  // over data nobody asked for, which looks exactly like a quiet club.
  for (const tab of META_TABS) {
    assert.ok(readsFor(tab.value).length > 0, `${tab.value} reads nothing`);
  }
}

{
  // And between them they use every read. One nobody asks for is a function
  // being maintained for nothing.
  const asked = new Set<MetaRead>();
  for (const tab of Object.keys(READS_FOR) as MetaTab[]) {
    for (const read of READS_FOR[tab]) asked.add(read);
  }
  const every: MetaRead[] = ["factions", "detachments", "dispositions",
    "matchups", "context", "units", "before"];
  for (const read of every) assert.ok(asked.has(read), `nothing reads ${read}`);
}

{
  // Every tab carries the factions read, because every section's lead sentence
  // names the leading faction.
  for (const tab of Object.keys(READS_FOR) as MetaTab[]) {
    assert.ok(READS_FOR[tab].includes("factions"), `${tab} cannot name a leader`);
  }
}

console.log("meta-tabs: all pass");
