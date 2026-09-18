import assert from "node:assert/strict";
import {
  EVENT_LABELS, EVENT_TONES, eventLabel, eventTone, historySummary,
} from "../submission-history";

{
  // Every kind the database may write has a label and a tone. A missing one
  // renders the raw column value, which is how "changes_requested" ends up on
  // somebody's screen.
  const KINDS = ["submitted", "changes_requested", "approved", "declined",
                 "cancelled", "restarted"];
  for (const kind of KINDS) {
    assert.ok(EVENT_LABELS[kind], `${kind} has no label`);
    assert.ok(EVENT_TONES[kind], `${kind} has no tone`);
    assert.doesNotMatch(eventLabel(kind), /_/, `${kind} leaks the column value`);
  }

  // And an unknown one degrades to itself rather than to blank.
  assert.equal(eventLabel("teleported"), "teleported");
  assert.equal(eventTone("teleported"), "neutral");
}

{
  // The line the reviewer reads first. Three rounds is the case that started
  // this: the screen showed the third note and nothing else.
  assert.match(historySummary(["submitted"]), /Nothing has been asked for yet/);
  assert.match(
    historySummary(["submitted", "changes_requested", "submitted"]),
    /Sent back once/);
  assert.match(
    historySummary(["submitted", "changes_requested", "submitted",
                    "changes_requested", "submitted", "declined"]),
    /Sent back 2 times/);

  // Sent in twice with nothing asked for is a club that withdrew and came back,
  // which is not a reviewer being ignored.
  assert.match(historySummary(["submitted", "cancelled", "submitted"]), /Sent in 2 times/);

  // Nothing at all draws nothing.
  assert.equal(historySummary([]), "");
}

{
  // A history that does not begin with the listing arriving is one 0107
  // backfilled from a row that was already finished, so what is on screen is
  // the end of a story whose middle was overwritten. Saying "nothing has been
  // asked for yet" above a decline with a reason on it is the interface
  // contradicting itself, and it shipped once.
  for (const kinds of [["declined"], ["approved"], ["changes_requested"], ["cancelled"]]) {
    assert.match(historySummary(kinds), /Only the last thing/,
      `${kinds[0]} alone does not admit the record is partial`);
    assert.doesNotMatch(historySummary(kinds), /Nothing has been asked for yet/);
  }

  // And a partial one that has since gone round says both things.
  const partial = historySummary(["declined", "changes_requested", "submitted"]);
  assert.match(partial, /Only the last thing/);
  assert.match(partial, /Sent back once/);

  // A complete history never claims to be missing anything.
  assert.doesNotMatch(
    historySummary(["submitted", "changes_requested", "submitted", "approved"]),
    /Only the last thing/);
  assert.doesNotMatch(historySummary(["restarted", "submitted"]), /Only the last thing/);
}

console.log("submission-history: all assertions passed");
