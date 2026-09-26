import assert from "node:assert/strict";
import {
  reportedKeys, reportKey, NOTHING_REPORTED, reportTabs,
  reportStatusForSql, REPORT_TABS,
} from "../reported-set";
import { statusTag } from "../moderation-status";
import { nextSearch } from "../filter-url";

// -------------------------------------------------------------- the lookup
{
  const keys = reportedKeys([
    { target_type: "post", target_id: 7 },
    { target_type: "review", target_id: 4 },
  ]);
  const held = new Set(keys);
  assert.equal(held.has(reportKey("post", 7)), true);
  assert.equal(held.has(reportKey("review", 4)), true);
  assert.equal(keys.length, 2);

  // Ids are per table, so a review 7 is not the board post 7. Getting this
  // wrong greys out a Report button on something nobody reported.
  assert.equal(held.has(reportKey("review", 7)), false);
  assert.equal(held.has(reportKey("post", 4)), false);
  assert.equal(held.has(reportKey("reply", 7)), false);
}
{
  // Everything that crosses into a client component has to survive being
  // serialized, so the keys are strings and nothing else.
  for (const key of reportedKeys([{ target_type: "post", target_id: 7 }])) {
    assert.equal(typeof key, "string");
  }
  assert.deepEqual(JSON.parse(JSON.stringify(NOTHING_REPORTED)), []);
}
{
  // An empty read and a failed read both mean "nothing is greyed out", never
  // a crash on a page that is only showing content.
  assert.deepEqual(reportedKeys([]), []);
  assert.deepEqual(NOTHING_REPORTED, []);
}
{
  // The same thing twice cannot be reported twice, but a duplicated row from
  // the read must not produce a duplicated key.
  assert.equal(reportedKeys([
    { target_type: "post", target_id: 7 },
    { target_type: "post", target_id: 7 },
  ]).length, 1);
}

// ------------------------------------------------------------- the outcome
{
  // One map for three screens. The admin's queue, the club's queue and the
  // member's own list all draw the same fact, and they shipped with two
  // vocabularies and two treatments between them.
  assert.deepEqual(statusTag("actioned"), { label: "Taken down", tone: "down" });
  assert.deepEqual(statusTag("actioned", true), { label: "Taken down", tone: "down" });
  assert.deepEqual(statusTag("dismissed"), { label: "Left as it is", tone: "kept" });
  assert.deepEqual(statusTag("withdrawn"), { label: "Taken back", tone: "quiet" });
  assert.deepEqual(statusTag("open"), { label: "Waiting", tone: "waiting" });
  // Still open and the words have gone: the author deleted it before anybody
  // looked, which is a different ending from an admin taking it down.
  assert.deepEqual(statusTag("open", true), { label: "Gone already", tone: "quiet" });
  // Anything unheard of reads as waiting rather than as a blank tag.
  assert.equal(statusTag("nonsense").label, "Waiting");
}
{
  // "Taken back" has to be the words the member's own tab uses, or the tag and
  // the tab it sits under disagree about the same rows.
  const tab = REPORT_TABS.find((t) => t.key === "withdrawn");
  assert.equal(statusTag("withdrawn").label, tab?.label);
}

// ---------------------------------------------------------------- the URL
{
  // Every tab has to come back as itself. The one holding the empty string is
  // the tab a plain URL selects, so if two tabs wrote the same address one of
  // them could never be reached.
  const written = new Set<string>();
  for (const tab of REPORT_TABS) {
    const search = nextSearch(new URLSearchParams(""), { state: tab.key }, { state: "" });
    assert.equal(written.has(search), false,
      `${tab.label} writes an address another tab already writes`);
    written.add(search);
    const back = new URLSearchParams(search).get("state") ?? "";
    assert.equal(back, tab.key, `${tab.label} did not survive the URL`);
  }
}
{
  assert.equal(reportStatusForSql(""), "open");
  assert.equal(reportStatusForSql("answered"), "answered");
  assert.equal(reportStatusForSql("withdrawn"), "withdrawn");
  assert.equal(reportStatusForSql("any"), "any");
  // Anything invented falls back to the tab a plain URL shows rather than
  // narrowing the list to nothing under a tab that says otherwise.
  assert.equal(reportStatusForSql("nonsense"), "open");
}

// ----------------------------------------------------------------- counts
{
  const tabs = reportTabs({ all: 9, open: 2, answered: 6, withdrawn: 1 });
  assert.deepEqual(tabs.map((t) => [t.value, t.count]),
    [["", 2], ["answered", 6], ["withdrawn", 1], ["any", 9]]);
  // A counts read that failed prints zeros, never blanks: the house tab bar
  // renders whatever it is given and undefined renders as nothing at all.
  assert.deepEqual(reportTabs({}).map((t) => t.count), [0, 0, 0, 0]);
}

console.log("reported-set: all pass");
