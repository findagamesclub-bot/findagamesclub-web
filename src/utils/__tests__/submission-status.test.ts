import assert from "node:assert/strict";

import {
  LISTING_STEPS, isStep, nextStep, previousStep, resumeLabel, stepLabel, stepNumber,
} from "../listing-steps";
import {
  QUEUE_TABS, STATUS_LABELS, STATUS_TONES, SUBMISSION_STATUSES, adminCanReview,
  isFinished, isSubmissionStatus, ownerCanCancel, ownerCanEdit, ownerCanRestart,
  ownerNextStep,
} from "../submission-status";

// --- the steps ------------------------------------------------------------

{
  // Legacy's five, in legacy's order. Changing this changes both builders.
  assert.deepEqual(LISTING_STEPS.map((s) => s.slug),
    ["profile", "content", "pricing", "schedule", "review"]);
  assert.deepEqual(LISTING_STEPS.map((s) => s.label),
    ["Profile", "Content", "Pricing", "Schedule", "Review"]);
}

{
  assert.equal(isStep("pricing"), true);
  assert.equal(isStep("photos"), false, "an invented step is not a step");
  assert.equal(stepNumber("pricing"), 3);
  assert.equal(stepNumber("nonsense"), 0);
  assert.equal(stepLabel("schedule"), "Schedule");
  assert.equal(stepLabel("nonsense"), "");
}

{
  assert.equal(nextStep("profile"), "content");
  assert.equal(nextStep("review"), null, "nothing after the last one");
  assert.equal(previousStep("content"), "profile");
  assert.equal(previousStep("profile"), null, "nothing before the first one");
  assert.equal(nextStep("nonsense"), null);
  assert.equal(previousStep("nonsense"), null);
}

{
  assert.equal(resumeLabel("pricing"), "Step 3 of 5, Pricing");
  assert.equal(resumeLabel("profile"), "Step 1 of 5, Profile");
  // A row written before a step was renamed must not read "Step 0 of 5".
  assert.equal(resumeLabel("gone"), "Step 1 of 5, Profile");
  assert.equal(resumeLabel(""), "Step 1 of 5, Profile");
}

// --- the statuses ---------------------------------------------------------

{
  // Every status has a label and a tone, or a chip renders blank.
  for (const status of SUBMISSION_STATUSES) {
    assert.ok(STATUS_LABELS[status], `${status} has no label`);
    assert.ok(STATUS_TONES[status], `${status} has no tone`);
    assert.ok(ownerNextStep(status), `${status} has no sentence`);
  }
  assert.equal(isSubmissionStatus("payment_pending"), false,
    "Stage 5's status is not one of ours yet");
}

{
  // Legacy's wording where legacy has it.
  assert.equal(STATUS_LABELS.review_pending, "Awaiting admin approval");
  assert.equal(STATUS_LABELS.approved, "Approved and live");
  assert.equal(STATUS_LABELS.cancelled, "Cancelled");
  // And ours where it does not. The button says Decline, so the label does too.
  assert.equal(STATUS_LABELS.declined, "Declined");
}

{
  // Editable before it is sent and again when it comes back, never while it is
  // being looked at. This mirrors the RLS policy exactly; if one changes and
  // the other does not, the form saves nothing and says it saved.
  assert.deepEqual(SUBMISSION_STATUSES.filter(ownerCanEdit), ["draft", "changes_requested"]);
  assert.deepEqual(SUBMISSION_STATUSES.filter(ownerCanCancel),
    ["draft", "review_pending", "changes_requested"]);
  assert.deepEqual(SUBMISSION_STATUSES.filter(adminCanReview), ["review_pending"]);
  assert.deepEqual(SUBMISSION_STATUSES.filter(isFinished),
    ["approved", "declined", "cancelled"]);

  // Startable again is finished minus approved: an approved listing is a club
  // now, and is managed rather than relisted.
  assert.deepEqual(SUBMISSION_STATUSES.filter(ownerCanRestart),
    ["declined", "cancelled"]);

  // Never both at once. Editing reopens the row you are looking at; starting
  // again makes a new one, and offering the two side by side would be asking
  // somebody to choose between the same work in two places.
  for (const status of SUBMISSION_STATUSES) {
    assert.ok(!(ownerCanEdit(status) && ownerCanRestart(status)),
      `${status} offers both editing and starting again`);
  }
}

{
  // The three sentences that carry the admin's own words.
  assert.match(ownerNextStep("changes_requested", { note: "Add a postcode." }),
    /Add a postcode\./);
  assert.match(ownerNextStep("declined", { reason: "This is a shop." }), /This is a shop\./);
  assert.match(ownerNextStep("draft", { resume: "Step 3 of 5, Pricing" }), /Step 3 of 5, Pricing/);

  // And they still say something useful with nothing to quote.
  assert.ok(ownerNextStep("changes_requested").length > 0);
  assert.ok(ownerNextStep("declined").length > 0);
  assert.ok(ownerNextStep("draft").length > 0);

  // The two dead ends now say there is a way out, with or without a reason to
  // quote. This is the whole point of 0106: "Declined" with no next line left
  // somebody with an empty builder and thirteen fields to retype.
  for (const line of [ownerNextStep("declined"), ownerNextStep("cancelled"),
                      ownerNextStep("declined", { reason: "This is a shop." })]) {
    assert.match(line, /start again/i);
  }
}

{
  // Waiting leads, because it is the only tab with a job attached.
  assert.equal(QUEUE_TABS[0]!.key, "review_pending");
  assert.equal(QUEUE_TABS[QUEUE_TABS.length - 1]!.key, "all");
  for (const tab of QUEUE_TABS) {
    assert.ok(tab.key === "all" || isSubmissionStatus(tab.key), `${tab.key} is not a status`);
  }
}

console.log("submission-status: all assertions passed");
