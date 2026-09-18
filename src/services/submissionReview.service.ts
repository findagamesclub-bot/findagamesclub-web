import "server-only";

import * as repo from "@/repositories/submissions.repository";
import { submissionRefusal } from "@/utils/submission-refusals";
import { QUEUE_TABS, STATUS_LABELS, STATUS_TONES } from "@/utils/submission-status";
import { eventLabel, eventTone } from "@/utils/submission-history";
import { recipient } from "@/services/mail-recipient.service";
import * as notify from "./listing-notify.service";

/**
 * The admin side of the listing queue.
 *
 * Legacy has approve and nothing else, so a listing that was nearly right sat
 * in the queue forever. Sending one back with a note and declining one with a
 * reason are both new, agreed before this stage, and both are refusals the
 * database enforces rather than the screen.
 *
 * Every write here is followed by an email, and never gated on it: a mail
 * failure must not undo an approval that has already created a club.
 */

export const QUEUE_PER_PAGE = 25;

export type QueueRow = {
  id: number;
  status: string;
  statusLabel: string;
  tone: string;
  clubName: string;
  city: string;
  submittedAt: string | null;
  updatedAt: string;
  clubId: number | null;
  note: string;
  reason: string;
  /** Set when this was started again from a listing that ended. */
  restartedFrom: number | null;
  /**
   * How many times this one has been sent back.
   *
   * The number a reviewer actually wants on a row: it says how much work this
   * listing has already had. "Second attempt" counts submission rows, which is
   * a different and much less useful fact, and read as the round count to the
   * client on a listing that had been round four times.
   */
  sentBack: number;
  /**
   * What replaced this one, when the club started again from it.
   *
   * A decline stays in the Declined tab, because it is a decision somebody took
   * and a club coming back should not be able to erase it. But a row that reads
   * only "Declined" next to a club that is now live in the directory is the
   * queue telling a reviewer something that stopped being true, so the row says
   * what became of it.
   */
  supersededBy: { id: number; statusLabel: string } | null;
  /**
   * What the club is doing now, for a request that became one.
   *
   * The queue said "Approved and live" about a club that had taken itself out
   * of the directory. The request is approved and stays approved; whether the
   * club is live is a different question and the row has to answer both.
   */
  clubStatus: string;
};

function toRow(row: repo.SubmissionListRow): QueueRow {
  return {
    id: row.id,
    status: row.status,
    statusLabel: STATUS_LABELS[row.status as keyof typeof STATUS_LABELS] ?? row.status,
    tone: STATUS_TONES[row.status as keyof typeof STATUS_TONES] ?? "neutral",
    clubName: row.club_name || "Untitled listing",
    city: row.city,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
    clubId: row.club_id,
    note: row.review_note,
    reason: row.decline_reason,
    restartedFrom: row.restarted_from,
    clubStatus: row.club?.status ?? "",
    sentBack: 0,
    supersededBy: null,
  };
}

export type QueueFilters = {
  status: string; query: string; sort: string; page: number;
};

/**
 * What the tabs and the search box put in the address.
 *
 * `state`, `q` and `sort` are the names `UrlFilterBar` writes everywhere else,
 * so the queue's address reads like the bookings tab's rather than inventing
 * its own vocabulary.
 */
export function readQueueFilters(
  params: Record<string, string | string[] | undefined>,
): QueueFilters {
  const one = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  const status = one("state") || "review_pending";
  const sort = one("sort") || "oldest";
  return {
    status: QUEUE_TABS.some((t) => t.key === status) ? status : "review_pending",
    query: one("q").slice(0, 80),
    sort: sort === "newest" ? "newest" : "oldest",
    page: Math.max(1, Number(one("page")) || 1),
  };
}

/**
 * One page of the queue, with the count on every tab.
 *
 * Two waves, not seven: the page of rows and the five counts go together, and
 * the counts are index counts rather than rows loaded to be measured. At five
 * thousand submissions this is the same cost as at five.
 */
export async function getQueue(filters: QueueFilters) {
  const from = (filters.page - 1) * QUEUE_PER_PAGE;

  const [page, counts] = await Promise.all([
    repo.findSubmissionsPage({
      status: filters.status, query: filters.query, sort: filters.sort,
      from, to: from + QUEUE_PER_PAGE - 1,
    }),
    repo.countSubmissionsByStatus(QUEUE_TABS.map((t) => t.key)),
  ]);

  // One wave over the ids on this page, not one query per row. Both usually
  // come back small or empty.
  const ids = page.rows.map((row) => row.id);
  const [successors, sendBacks] = await Promise.all([
    repo.findSuccessors(ids).catch(() => []),
    repo.countSendBacks(ids).catch(() => new Map<number, number>()),
  ]);
  const replacedBy = new Map(successors.map((row) => [row.restarted_from, row]));

  return {
    rows: page.rows.map((row) => {
      const next = replacedBy.get(row.id);
      return {
        ...toRow(row),
        sentBack: sendBacks.get(row.id) ?? 0,
        supersededBy: next
          ? {
            id: next.id,
            statusLabel: (STATUS_LABELS[next.status as keyof typeof STATUS_LABELS]
              ?? next.status).toLowerCase(),
          }
          : null,
      };
    }),
    total: page.total,
    page: filters.page,
    perPage: QUEUE_PER_PAGE,
    counts,
  };
}

/** The whole submission, payload included, for the review screen. */
export async function getSubmissionForReview(id: number) {
  return repo.findSubmission(id);
}

export type HistoryEntry = {
  id: number;
  kind: string;
  label: string;
  tone: string;
  /** The admin's own words, where the move carried any. */
  body: string;
  /** Who did it, on the screens where naming them helps. */
  who: string;
  on: string;
};

/**
 * Everything that has happened to one listing, oldest first.
 *
 * `names` is false for the club's own copy. Which admin pressed the button is
 * useful to the other admins and is noise to the club, whose side of every
 * message from us says "we".
 */
export async function getReviewHistory(
  id: number, { names = false }: { names?: boolean } = {},
): Promise<HistoryEntry[]> {
  const rows = await repo.findSubmissionEvents(id).catch(() => []);

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    label: eventLabel(row.kind),
    tone: eventTone(row.kind),
    body: row.body,
    who: names ? (row.actor?.full_name ?? "") : "",
    on: row.created_at,
  }));
}

export type Submitter = {
  name: string;
  email: string;
  joinedAt: string | null;
  /** Clubs already live under this account. */
  clubsOwned: number;
  /** Listings they have started here, this one included. */
  listings: number;
};

/**
 * Who is asking.
 *
 * The email comes from `auth.users` through the admin client, because that is
 * where it lives; everything else is an ordinary read. Admin-only by the time
 * it is called, since the page above it is.
 */
export async function getSubmitter(profileId: string): Promise<Submitter | null> {
  const [who, email] = await Promise.all([
    repo.findSubmitter(profileId).catch(() => null),
    recipient(profileId).catch(() => null),
  ]);
  if (!who) return null;
  return { ...who, email: email?.email ?? "" };
}

export type EarlierAttempt = {
  id: number;
  statusLabel: string;
  reason: string;
  note: string;
  on: string | null;
};

/**
 * The attempt this one was started again from.
 *
 * A club that was declined and has come back reads exactly like a new club, and
 * the reason it was turned down is the most useful thing a reviewer can have in
 * front of them. Only fetched when there is one, so the common case still costs
 * a single read.
 */
export async function getEarlierAttempt(
  restartedFrom: number | null,
): Promise<EarlierAttempt | null> {
  if (!restartedFrom) return null;

  const row = await repo.findSubmission(restartedFrom).catch(() => null);
  if (!row) return null;

  return {
    id: row.id,
    statusLabel: STATUS_LABELS[row.status as keyof typeof STATUS_LABELS] ?? row.status,
    reason: row.decline_reason,
    note: row.review_note,
    on: row.reviewed_at,
  };
}

export type ReviewResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * How long a note or a reason may be.
 *
 * The dialog stops at this too, but a browser cap is a courtesy and this is the
 * rule. It exists because a thousand words pasted into a note ran the review
 * screen off the bottom of itself, and because a note somebody has to read and
 * act on is a paragraph rather than an essay.
 */
const WORDS_LIMIT = 600;

function tooLong(value: string, what: string): string | null {
  return value.length > WORDS_LIMIT
    ? `That ${what} is too long. Keep it under ${WORDS_LIMIT} characters.`
    : null;
}

export async function requestChanges(id: number, note: string): Promise<ReviewResult> {
  const clean = note.trim();
  const long = tooLong(clean, "note");
  if (long) return { ok: false, error: long };

  try {
    await repo.requestSubmissionChanges(id, clean);
  } catch (error) {
    return { ok: false, error: submissionRefusal(error) };
  }

  // Read afterwards rather than before, so the email carries what was actually
  // written rather than what was about to be.
  const row = await repo.findSubmission(id).catch(() => null);
  if (row) void notify.changesRequested(row, clean);

  return { ok: true, message: "Sent back with your note." };
}

export async function decline(id: number, reason: string): Promise<ReviewResult> {
  const clean = reason.trim();
  const long = tooLong(clean, "reason");
  if (long) return { ok: false, error: long };

  try {
    await repo.declineSubmission(id, clean);
  } catch (error) {
    return { ok: false, error: submissionRefusal(error) };
  }

  const row = await repo.findSubmission(id).catch(() => null);
  if (row) void notify.declined(row, clean);

  return { ok: true, message: "Declined, and they have been told why." };
}

export async function approve(
  id: number,
): Promise<{ ok: true; slug: string; name: string } | { ok: false; error: string }> {
  let created: { club_id: number; slug: string; name: string };
  try {
    created = await repo.approveSubmission(id);
  } catch (error) {
    return { ok: false, error: submissionRefusal(error) };
  }

  const row = await repo.findSubmission(id).catch(() => null);
  if (row) void notify.approved(row, created.slug);

  return { ok: true, slug: created.slug, name: created.name };
}

/**
 * How many listings are waiting, for the badge on the rail.
 *
 * Its own function rather than reusing `getQueue`, because the rail is drawn on
 * every admin page and does not want a page of rows to put one number on a
 * label. An index count over `club_submissions_queue_idx`.
 */
export async function countWaitingSubmissions(): Promise<number> {
  const counts = await repo.countSubmissionsByStatus(["review_pending"]);
  return counts.get("review_pending") ?? 0;
}
