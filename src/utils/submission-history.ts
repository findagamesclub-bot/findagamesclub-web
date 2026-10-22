import type { StatusTone } from "./submission-status";

/**
 * How one thing that happened to a listing reads.
 *
 * Neutral wording on purpose, because the same list is shown to the admin who
 * sent it back and to the club it was sent back to. "Sent back" is true from
 * both sides; "you sent it back" is true from one and wrong from the other, and
 * two vocabularies for one list is the interface contradicting itself.
 *
 * The verbs match the buttons that cause them, which is the rule the status
 * labels already follow: the button says Decline, so the line says Declined.
 */

export const EVENT_LABELS: Record<string, string> = {
  submitted: "Sent in",
  payment_pending: "Waiting to be paid for",
  changes_requested: "Sent back",
  approved: "Approved",
  declined: "Declined",
  cancelled: "Taken back",
  restarted: "Started again",
  // What has happened to the club SINCE it went live (0215). The timeline
  // used to stop at the approval, so a club a site admin had taken down read
  // as approved and nothing else, and the back and forth that followed was in
  // the database with nowhere to see it.
  suspended: "Taken down by an admin",
  restored: "Put back",
  review_asked: "The club says it is settled",
  review_kept: "Looked at again, staying down",
};

/** The house tones, so a history dot and a status chip agree about colour. */
export const EVENT_TONES: Record<string, StatusTone> = {
  submitted: "neutral",
  payment_pending: "warn",
  changes_requested: "warn",
  approved: "good",
  declined: "bad",
  cancelled: "neutral",
  restarted: "neutral",
  suspended: "bad",
  restored: "good",
  // The club's turn is over and ours has started, which is the same weight a
  // listing waiting on us already has.
  review_asked: "warn",
  review_kept: "bad",
};

export function eventLabel(kind: string): string {
  return EVENT_LABELS[kind] ?? kind;
}

export function eventTone(kind: string): StatusTone {
  return EVENT_TONES[kind] ?? "neutral";
}

/**
 * The one line above the list, saying what shape it is.
 *
 * A listing that went round three times is a different thing from one that
 * arrived and was approved, and the reviewer's question on opening it is which
 * of those they are looking at. Counting the times it was sent back answers
 * that in four words, so nobody has to read six rows to find out.
 *
 * It also has to say when the list is not the whole story. Every real history
 * begins with the listing being sent in, or started again from one that ended.
 * Anything else at the top means the beginning is missing: the listing was
 * already finished before 0107 existed, and the single `review_note` column it
 * had until then kept only the last ask. Saying so is the honest thing, and it
 * is better than the alternative, which is a panel that says nothing has been
 * asked for above a decline with a reason on it. That shipped.
 */
export function historySummary(kinds: string[]): string {
  if (kinds.length === 0) return "";

  const back = kinds.filter((kind) => kind === "changes_requested").length;
  const sent = kinds.filter((kind) => kind === "submitted").length;
  // What happened after it went live is its own sentence. Folding it into the
  // round count would say a listing had been sent back more times than it was.
  const down = kinds.filter((kind) => kind === "suspended").length;
  const since = down === 0 ? ""
    : down === 1 ? " It has been taken down once since."
      : ` It has been taken down ${down} times since.`;

  // A history can now begin with the club waiting to pay, which is a real
  // beginning and not a missing one.
  const first = kinds[0];
  const partial = first !== "submitted" && first !== "restarted"
    && first !== "payment_pending";
  const missing = "Only the last thing that happened was kept for this one. "
    + "Anything asked for before it was not recorded.";

  if (back === 0) {
    if (partial) return `${missing}${since}`;
    return (sent > 1 ? `Sent in ${sent} times.` : "Nothing has been asked for yet.")
      + since;
  }

  const rounds = back === 1
    ? "Sent back once. Everything asked for is below."
    : `Sent back ${back} times. Everything asked for is below.`;

  return (partial ? `${missing} ${rounds}` : rounds) + since;
}
