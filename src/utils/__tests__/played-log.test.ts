import assert from "node:assert/strict";
import {
  isPlayedSort, isPlayedTab, owedAnswer, PLAYED_TABS, type PlayedCounts,
} from "../played-log";

// The four groups partition "all". A tab somebody added without taking it out
// of another would show a club five games across four tabs over a header
// saying four, which is the kind of disagreement the client counts.
const counts: PlayedCounts = {
  all: 12, unscored: 3, waiting: 5, disputed: 1, settled: 3,
};
assert.equal(
  counts.unscored + counts.waiting + counts.disputed + counts.settled,
  counts.all,
);

// Disputed is inside "waiting on you", not beside it: both are games the club
// has to rule on. Written once here because the header and the tabs read it.
assert.equal(owedAnswer(counts), 6);
assert.equal(owedAnswer({ all: 1, unscored: 1, waiting: 0, disputed: 0, settled: 0 }), 0);

// Every tab the bar draws is one the address will accept back. A label with
// no guard behind it means a bookmarked filter silently opens on All.
for (const tab of PLAYED_TABS) assert.equal(isPlayedTab(tab.value), true);
assert.equal(isPlayedTab("settled"), true);
assert.equal(isPlayedTab("everything"), false);
assert.equal(isPlayedTab(""), false);

assert.equal(isPlayedSort("oldest"), true);
assert.equal(isPlayedSort("value"), false);

// "all" is the empty tab, so a plain URL selects it. 0118 paid for the other
// way round: give a list a default its empty value does not match and the
// first tab press lands on it for ever.
assert.equal(PLAYED_TABS[0]!.value, "all");

console.log("played-log: all pass");
