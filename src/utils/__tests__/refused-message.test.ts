import assert from "node:assert/strict";

import { refusedMessage } from "../listing-draft";

// The client's own case: thirteen fields, one of them empty, and a toast that
// said "Some of that needs another look" without saying which. The one real
// message was sitting under Age groups in the same grey as ordinary guidance.
{
  assert.equal(
    refusedMessage({ ages: "Add at least one age group before continuing." }, "fallback"),
    "Add at least one age group before continuing.",
    "one problem is named outright",
  );
}

{
  const many = refusedMessage({
    ages: "Add at least one age group before continuing.",
    formats: "Add at least one club format before continuing.",
    memberCount: "The member count has to be a whole number.",
  }, "fallback");
  assert.equal(many, "3 things need another look. They are marked below.",
    "several are counted, and the fields carry the detail");
}

{
  // Nothing to say about a field means the caller's own sentence stands. This
  // is the path a database refusal takes, which is not about a field at all.
  assert.equal(refusedMessage(undefined, "Could not save that."), "Could not save that.");
  assert.equal(refusedMessage({}, "Could not save that."), "Could not save that.");
}

{
  // An entry with nothing in it is not a problem. A blank string here would
  // otherwise become a toast with no words in it.
  assert.equal(refusedMessage({ ages: "", formats: "   " }, "fallback"), "fallback");
  assert.equal(
    refusedMessage({ ages: "", formats: "Add at least one club format before continuing." },
      "fallback"),
    "Add at least one club format before continuing.",
    "and it does not count toward the plural",
  );
}

console.log("refused-message: all assertions passed");
