/**
 * What state a listing submission is in, and what that allows.
 *
 * Legacy's labels are kept where legacy has one
 * (`LISTING_SUBMISSION_STATUS_LABELS`, club_store.py:80). Two differ on
 * purpose:
 *
 * - `draft` and `changes_requested` do not exist there at all, because legacy
 *   has no draft and its admin can only approve.
 * - Legacy calls the end of the road "Rejected", against a status nothing ever
 *   sets. Ours is "Declined", because the button says Decline and a label that
 *   disagrees with the button it came from is the interface contradicting
 *   itself.
 *
 * Pure so both sides can ask it the same question: the owner's card on
 * /account, and the admin's queue.
 */

export const SUBMISSION_STATUSES = [
  "draft", "review_pending", "changes_requested", "approved", "declined", "cancelled",
] as const;

export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export function isSubmissionStatus(value: string): value is SubmissionStatus {
  return (SUBMISSION_STATUSES as readonly string[]).includes(value);
}

export const STATUS_LABELS: Record<SubmissionStatus, string> = {
  draft: "Not sent yet",
  review_pending: "Awaiting admin approval",
  changes_requested: "Changes needed",
  approved: "Approved and live",
  declined: "Declined",
  cancelled: "Cancelled",
};

/** Which of the house tones a status chip takes. No new colours. */
export type StatusTone = "neutral" | "warn" | "good" | "bad";

export const STATUS_TONES: Record<SubmissionStatus, StatusTone> = {
  draft: "neutral",
  review_pending: "warn",
  changes_requested: "warn",
  approved: "good",
  declined: "bad",
  cancelled: "neutral",
};

/**
 * The tabs on the admin queue, in the order an admin works.
 *
 * Waiting first because it is the only one with a job attached, and the count
 * beside it is the reason to open the page at all.
 */
export const QUEUE_TABS: { key: SubmissionStatus | "all"; label: string }[] = [
  { key: "review_pending", label: "Waiting" },
  { key: "changes_requested", label: "Sent back" },
  { key: "approved", label: "Approved" },
  { key: "declined", label: "Declined" },
  { key: "all", label: "All" },
];

/** Editable by the person who started it: before sending, and after it comes back. */
export function ownerCanEdit(status: string): boolean {
  return status === "draft" || status === "changes_requested";
}

export function ownerCanSubmit(status: string): boolean {
  return ownerCanEdit(status);
}

/** Cancellable until it is decided. A decided one is history, not a live thing. */
export function ownerCanCancel(status: string): boolean {
  return status === "draft" || status === "changes_requested" || status === "review_pending";
}

/**
 * Startable again: one that is over, either way.
 *
 * Not a draft, which is already editable, and not one in the queue, which
 * somebody is reading. An approved one is a club now and is managed, not
 * relisted. Starting again makes a new draft carrying everything they wrote;
 * it never reopens the old row, because a decline is a record of a decision
 * and a row that could quietly become a draft again would erase it.
 */
export function ownerCanRestart(status: string): boolean {
  return status === "declined" || status === "cancelled";
}

/** An admin acts on exactly one state. Everything else is already answered. */
export function adminCanReview(status: string): boolean {
  return status === "review_pending";
}

export function isFinished(status: string): boolean {
  return status === "approved" || status === "declined" || status === "cancelled";
}

/**
 * The one sentence the owner's card leads with.
 *
 * Says what happened and what to do next, which is the whole job of this
 * screen: somebody who submitted a listing three weeks ago and heard nothing
 * should not have to work out whether the ball is with them.
 */
export function ownerNextStep(
  status: string,
  detail: { note?: string; reason?: string; resume?: string } = {},
): string {
  switch (status) {
    case "draft":
      return detail.resume
        ? `You stopped at ${detail.resume}. Pick up where you left off.`
        : "Finish it whenever you like. Nothing is sent until you say so.";
    case "review_pending":
      return "It is with us. We will email you when somebody has looked at it.";
    case "changes_requested":
      return detail.note
        ? `We need a couple of changes: ${detail.note}`
        : "We need a couple of changes before this can go live.";
    case "approved":
      return "It is live. Your club page is in the directory.";
    case "declined":
      return detail.reason
        ? `We could not list this one: ${detail.reason} You can start again from it, `
          + "with everything you typed still there."
        : "We could not list this one. You can start again from it, with everything "
          + "you typed still there.";
    case "cancelled":
      return "You stopped this one. Start again from it whenever you like, with "
        + "everything you typed still there.";
    default:
      return "";
  }
}
