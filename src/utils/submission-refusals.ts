/**
 * What the database refuses when somebody is listing a club, in plain words.
 *
 * Same shape as `event-refusals.ts`: the trigger raises a code, this turns it
 * into a sentence that says what happened and what to do next. Pure, so the
 * wording can be checked without a database.
 */
const MESSAGES: [string, string][] = [
  ["SUBMISSION_NEEDS_NAME", "Your club needs a name before you can send it."],
  ["SUBMISSION_NEEDS_CITY", "Say which town or city the club is in."],
  ["SUBMISSION_NOT_EDITABLE", "This one is with us already, so it cannot be changed."],
  ["SUBMISSION_FINISHED", "This one has already been decided."],
  ["SUBMISSION_NOT_FOUND", "That listing is not here any more."],
  ["SUBMISSION_NOT_RESTARTABLE",
   "Only a listing that is over can be started again. This one is still going."],
  ["SUBMISSION_NOT_IN_REVIEW",
   "Somebody has already answered this one. Reload to see where it got to."],
  ["REVIEW_NEEDS_NOTE", "Say what needs changing, so they know what to fix."],
  ["DECLINE_NEEDS_REASON", "Give a reason. It is what they will be told."],
];

export function submissionRefusal(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");

  const match = MESSAGES.find(([code]) => raw.includes(code));
  if (match) return match[1];

  // A policy turned the write into nothing, which is the shape of somebody
  // reaching for a listing that is not theirs.
  if (raw.includes("NOT_PERMITTED") || raw.includes("row-level security")) {
    return "That listing is not yours to change.";
  }

  console.error("[submissions] unexpected refusal:", raw);
  return "Could not save that. Try again.";
}
