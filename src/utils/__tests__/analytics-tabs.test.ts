import assert from "node:assert/strict";

import {
  ANALYTICS_TABS, DEFAULT_TAB, isAnalyticsTab, readTab, readsFor, tabLabel,
} from "../analytics-tabs";

{
  // Six tabs, one per section the page used to scroll through.
  assert.equal(ANALYTICS_TABS.length, 6);
  assert.deepEqual(ANALYTICS_TABS.map((t) => t.key),
    ["headline", "money", "trend", "people", "nights", "membership"]);

  // Headline leads, because "how are we doing" is the question that opens the
  // page, and it is the tab a plain URL lands on.
  assert.equal(ANALYTICS_TABS[0]!.key, DEFAULT_TAB);
}

{
  // Every tab needs exactly one read, and between them they use all six. A tab
  // pointing at a read nobody fetches renders its empty state over real data,
  // which is indistinguishable from a club that has done nothing.
  const needed = ANALYTICS_TABS.map((t) => t.needs);
  assert.equal(new Set(needed).size, 6, "two tabs share a read, or one is unused");
  assert.deepEqual([...needed].sort(),
    ["health", "money", "months", "nights", "people", "summary"]);
}

{
  assert.equal(readTab("money"), "money");
  assert.equal(readTab(undefined), DEFAULT_TAB);
  assert.equal(readTab(""), DEFAULT_TAB);
  // A link from before a rename lands somewhere rather than on a blank page.
  assert.equal(readTab("revenue"), DEFAULT_TAB);
  assert.equal(readTab(["people", "money"]), "people", "the first one wins");

  assert.equal(isAnalyticsTab("nights"), true);
  assert.equal(isAnalyticsTab("Nights"), false, "the key is what is in the URL");
}

{
  for (const tab of ANALYTICS_TABS) {
    assert.ok(readsFor(tab.key), `${tab.key} needs no read`);
    assert.ok(tabLabel(tab.key).length > 0, `${tab.key} has no label`);
    // A tab label is a thing you press, not a sentence.
    assert.ok(tabLabel(tab.key).length <= 20, `${tab.key}'s label is too long to be a tab`);
  }
  assert.equal(readsFor("money"), "money");
  assert.equal(readsFor("trend"), "months", "the trend tab charts months, not nights");
  assert.equal(readsFor("membership"), "health");
}

console.log("analytics-tabs: all assertions passed");
