import assert from "node:assert/strict";

import {
  FLAG_ACTIONS, FLAG_TABS, MODERATION_TARGETS, isFlagAction, isModerationTarget,
  statusForSql, targetLabel,
} from "../moderation-targets";
import { nextSearch } from "../filter-url";

// Hand-copied from 0122_moderation_flags.sql.
const SQL_TYPES = ["review", "post", "reply", "event_post", "event_reply", "message"];
const SQL_STATUSES = ["open", "dismissed", "actioned"];

{
  assert.deepEqual(MODERATION_TARGETS.map((t) => t.key), SQL_TYPES,
    "target types differ from the constraint");
  // Every type names a real table, and no two share one, or the queue would
  // read the wrong row for a flag.
  const tables = MODERATION_TARGETS.map((t) => t.table);
  assert.equal(new Set(tables).size, tables.length, "two types share a table");
  for (const t of MODERATION_TARGETS) {
    assert.match(t.table, /^club_[a-z_]+$/, `${t.key} has no table`);
    assert.ok(t.label.length > 0 && t.plural.length > 0, `${t.key} has no label`);
  }
}

{
  assert.equal(isModerationTarget("message"), true);
  assert.equal(isModerationTarget("Message"), false, "the key is what is stored");
  assert.equal(isModerationTarget("club"), false, "a club is not reportable");
  assert.equal(isModerationTarget("profile"), false, "nor is a person");
}

{
  // Never blank. A queue row with no type name is a row nobody can act on.
  assert.equal(targetLabel("review"), "Review");
  assert.equal(targetLabel("event_reply"), "Event reply");
  assert.equal(targetLabel("nonsense"), "Something");
}

{
  // Exactly one tab carries the empty string, and it is the one a plain URL
  // lands on. Give two of them an empty value and one is unreachable.
  const empties = FLAG_TABS.filter((t) => t.key === "");
  assert.equal(empties.length, 1);
  assert.equal(FLAG_TABS[0]!.key, "", "Waiting leads and is the plain URL");

  // And pressing a tab writes an address that reads back as that tab.
  for (const tab of FLAG_TABS) {
    const search = nextSearch("", { state: tab.key }, { state: "" });
    const read = new URLSearchParams(search).get("state") ?? "";
    assert.equal(read, tab.key, `pressing ${tab.label} does not come back as itself`);
  }
}

{
  // The tab and the stored status are not the same word.
  assert.equal(statusForSql(""), "open", "the default tab asks for open flags");
  assert.equal(statusForSql("answered"), "answered");
  assert.equal(statusForSql("any"), "", "All asks SQL for no filter at all");
  assert.equal(statusForSql("nonsense"), "open", "an unknown tab falls back");

  // "answered" is not a stored status; it stands for the two that are.
  assert.equal(SQL_STATUSES.includes("answered"), false);
  assert.ok(SQL_STATUSES.includes("dismissed") && SQL_STATUSES.includes("actioned"));
}

{
  assert.deepEqual([...FLAG_ACTIONS], ["keep", "remove"]);
  assert.equal(isFlagAction("keep"), true);
  assert.equal(isFlagAction("remove"), true);
  // Nothing else, and especially not a word that sounds like one.
  assert.equal(isFlagAction("delete"), false);
  assert.equal(isFlagAction("Keep"), false);
  assert.equal(isFlagAction(""), false);
}

console.log("moderation-targets: all assertions passed");
