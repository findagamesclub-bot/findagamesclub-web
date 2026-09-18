import "server-only";

import * as repo from "@/repositories/submissions.repository";
import { parseProfileStep, type FieldErrors } from "@/utils/listing-draft";
import {
  contentReading, pricingReading, profileColumns, scheduleReading,
} from "@/utils/listing-payload";
import { readinessFromPayload } from "@/utils/draft-readiness";
import { listingChecks, stepDone, stepStatus, type Check } from "@/utils/listing-readiness";
import { resumeLabel } from "@/utils/listing-steps";
import { ownerNextStep, STATUS_LABELS, STATUS_TONES } from "@/utils/submission-status";
import { eventLabel, eventTone } from "@/utils/submission-history";
import type { HistoryEntry } from "@/services/submissionReview.service";
import { submissionRefusal } from "@/utils/submission-refusals";
import * as notify from "./listing-notify.service";

/**
 * Listing a club that does not exist yet.
 *
 * The five steps are the Stage 2 builder's, reading the form through the same
 * `listing-payload` functions the live editor uses. What differs is only where
 * it lands: a jsonb payload on a submission rather than the club's own tables.
 *
 * Legacy has no draft at all. Its builder holds the steps in memory and submits
 * at the end, so closing the tab loses everything. Keeping it is the one
 * departure this stage makes on the public side, agreed before build, because
 * the person this flow is for is filling it in on a phone between games.
 */

export type SaveResult =
  | { ok: true }
  | { ok: false; error?: string; errors?: FieldErrors };

export type ListingCard = {
  id: number;
  status: string;
  statusLabel: string;
  tone: string;
  clubName: string;
  city: string;
  /** What to do next, in a sentence. Never carries the admin's own words. */
  next: string;
  /**
   * What the admin actually wrote, kept apart from the sentence above.
   *
   * Free text somebody typed has no length anybody controls, and folding a
   * 600-character reason into the next-step line ran a card down the page. It
   * renders through `LongText`, the same as everywhere else free text lands.
   */
  said: string;
  /** Where they stopped, for a draft. */
  resume: string;
  lastStep: string;
  /** Set once approved. */
  clubId: number | null;
  /** Its address once live, so the card can open the console it belongs in. */
  clubSlug: string;
  /**
   * What the club itself is doing now, which is a different question from what
   * happened to the request.
   *
   * The card read the submission's `approved` and said "It is live. Your club
   * page is in the directory" about a club that had paused itself. A request is
   * approved forever; a listing is live only while it is.
   */
  clubStatus: string;
  /**
   * Everything that has happened to this listing, for the dialog behind the
   * card rather than on its face.
   *
   * The card grew: a status line, the attempt before it, the admin's reason and
   * two blocks of guidance, all stacked, and a row of cards is only as tidy as
   * its tallest. Three lines and a button is the shape; the rest is one click
   * away, which is rule 5 of the checklist.
   */
  history: HistoryEntry[];
  /** 1 for a first go, 2 upwards for one started again from an earlier try. */
  attempt: number;
  /**
   * The attempt this one replaced, folded in rather than shown beside it.
   *
   * Two cards carrying the same club name, one Declined and one Awaiting
   * approval, reads as the same listing having been duplicated. It is the
   * previous try, and it belongs on the card that replaced it.
   */
  from: { statusLabel: string; on: string; reason: string } | null;
  updatedAt: string;
};

function toCard(row: repo.SubmissionListRow): ListingCard {
  const resume = resumeLabel(row.last_step);
  return {
    id: row.id,
    status: row.status,
    statusLabel: STATUS_LABELS[row.status as keyof typeof STATUS_LABELS] ?? row.status,
    tone: STATUS_TONES[row.status as keyof typeof STATUS_TONES] ?? "neutral",
    clubName: row.club_name || "Your club",
    city: row.city,
    next: ownerNextStep(row.status, { resume }),
    said: row.status === "changes_requested" ? row.review_note
      : row.status === "declined" ? row.decline_reason : "",
    resume,
    lastStep: row.last_step,
    clubId: row.club_id,
    clubSlug: row.club?.slug ?? "",
    clubStatus: row.club?.status ?? "",
    history: [],
    attempt: 1,
    from: null,
    updatedAt: row.updated_at,
  };
}

/**
 * Everything this person has ever started, one card per club.
 *
 * A listing somebody started again from is not a listing of its own any more,
 * it is the previous attempt at the one that replaced it. Rendering both left
 * two cards with the same club name side by side, one Declined and one Awaiting
 * approval, which reads as the same thing having been duplicated. The old one
 * folds into the new one instead, carrying the reason it ended, which is the
 * part still worth having while fixing it.
 *
 * Done over their own rows rather than asked of the database: somebody has a
 * handful of listings, not a thousand, and this is one pass over a list already
 * in hand.
 */
export async function getMyListings(profileId: string): Promise<ListingCard[]> {
  const rows = await repo.findMySubmissions(profileId);

  // One query for every card's history. Somebody has a handful of listings, not
  // a page of them, so this is cheaper than a query per card and cheaper still
  // than the card fetching when its dialog opens.
  const events = await repo
    .findSubmissionEventsMany(rows.map((row) => row.id))
    .catch(() => []);
  const story = new Map<number, HistoryEntry[]>();
  for (const row of events) {
    const entry: HistoryEntry = {
      id: row.id,
      kind: row.kind,
      label: eventLabel(row.kind),
      tone: eventTone(row.kind),
      body: row.body,
      // Which admin is not the club's business; our side of every message says
      // "we".
      who: "",
      on: row.created_at,
    };
    story.set(row.submission_id, [...(story.get(row.submission_id) ?? []), entry]);
  }
  const byId = new Map(rows.map((row) => [row.id, row]));
  const previousOf = (row: repo.SubmissionListRow) =>
    (row.restarted_from ? byId.get(row.restarted_from) ?? null : null);

  const replaced = new Set(
    rows.map((row) => row.restarted_from).filter((id): id is number => id !== null));

  return rows.filter((row) => !replaced.has(row.id)).map((row) => {
    const previous = previousOf(row);

    // How many goes this is, by walking back up the chain. The seen set is not
    // for a cycle the database can produce, it is because a loop that follows a
    // column somebody else could one day write should not be able to hang.
    const seen = new Set<number>();
    let attempt = 1;
    let step = previous;
    while (step && !seen.has(step.id)) {
      seen.add(step.id);
      attempt += 1;
      step = previousOf(step);
    }

    return {
      ...toCard(row),
      history: story.get(row.id) ?? [],
      attempt,
      from: previous
        ? {
          statusLabel: (STATUS_LABELS[previous.status as keyof typeof STATUS_LABELS]
            ?? previous.status).toLowerCase(),
          on: previous.reviewed_at ?? previous.updated_at,
          reason: previous.decline_reason,
        }
        : null,
    };
  });
}

/**
 * The one worth putting a card on /account for.
 *
 * Only ever the live one: a listing that was approved, declined or cancelled is
 * history, and a card saying "pick up where you left off" on something that is
 * already a club would send somebody back into a form they finished.
 */
export async function getResumeCard(profileId: string): Promise<ListingCard | null> {
  const row = await repo.findMyLivestSubmission(profileId);
  return row ? toCard(row) : null;
}

/**
 * Start one, or hand back the empty one they already have.
 *
 * Pressing the button twice, or refreshing the page it lands on, would
 * otherwise leave a trail of blank listings nobody can tell apart. A draft with
 * no name on it is not a listing anybody started so much as a button they
 * pressed, so there is only ever one of those at a time. A named draft is real
 * work and never reused: somebody listing a second club keeps the first.
 */
export async function startListing(profileId: string): Promise<number> {
  const mine = await repo.findMySubmissions(profileId).catch(() => []);
  const blank = mine.find(
    (row) => row.status === "draft" && !row.club_name.trim() && !row.city.trim());
  if (blank) return blank.id;

  const row = await repo.startSubmission({
    club_name: "", city: "", payload: {}, last_step: "profile",
  });
  return row.id;
}

export async function getDraft(id: number) {
  return repo.findSubmission(id);
}

/**
 * The eight checks, measured from the draft.
 *
 * The same function the live editor's stepper calls, so a submission and a club
 * are held to one standard and the admin's review screen can show the reader
 * exactly what the club was shown.
 */
export function draftReadiness(payload: Record<string, unknown>): {
  checks: Check[]; status: Record<number, string>; done: Record<number, boolean>;
} {
  const input = readinessFromPayload(payload);
  return {
    checks: listingChecks(input),
    status: stepStatus(input),
    done: stepDone(input),
  };
}

/**
 * Save one step into the draft.
 *
 * Two round trips rather than one: the payload has to be merged, and PostgREST
 * cannot express `payload = payload || '{...}'` without a function of its own.
 * A form save is not a list, so the second trip buys simplicity at a cost
 * nobody is counting.
 */
export async function saveDraftStep(
  id: number, step: string, form: FormData,
): Promise<SaveResult> {
  const current = await repo.findSubmission(id);
  if (!current) return { ok: false, error: "That listing is not here any more." };

  const payload: Record<string, unknown> = { ...(current.payload ?? {}) };
  const patch: Record<string, unknown> = { last_step: step };

  if (step === "profile") {
    const parsed = parseProfileStep(form);
    if (!parsed.ok) return { ok: false, errors: parsed.errors };

    const columns = profileColumns(parsed.value);
    payload.club = columns;
    payload.formats = parsed.value.formats;
    // Kept out of the jsonb as well, so the admin queue can list and search
    // without reading a payload per row.
    patch.club_name = columns.name;
    patch.city = columns.city;

  } else if (step === "content") {
    const read = contentReading(form);
    payload.games = read.games;
    payload.facilities = read.facilities;
    payload.payment_methods = read.payment_methods;
    payload.images = read.images;
    payload.social_links = read.social_links;
    payload.categories = read.categories;

  } else if (step === "pricing") {
    const read = pricingReading(form);
    if (!read.ok) return { ok: false, error: read.error };
    payload.pricing_models = read.value.pricing_models;
    payload.tiers = read.value.tiers;
    payload.loyalty = read.value.loyalty;

  } else if (step === "schedule") {
    const read = scheduleReading(form);
    if (!read.ok) return { ok: false, error: read.error };
    payload.sessions = read.value.sessions;
    payload.announcements = read.value.announcements;

  } else {
    return { ok: false, error: "That step cannot be saved." };
  }

  patch.payload = payload;

  try {
    await repo.saveSubmissionDraft(id, patch);
  } catch (error) {
    return { ok: false, error: submissionRefusal(error) };
  }
  return { ok: true };
}

export async function submitListing(id: number, ownerName = ""): Promise<SaveResult> {
  // Read before, because afterwards every submission looks the same: a club
  // answering the changes we asked for is different news from one arriving,
  // and `review_pending` is all that is left once the write has happened.
  const before = await repo.findSubmission(id).catch(() => null);
  const answered = before?.status === "changes_requested";

  try {
    await repo.submitSubmission(id);
  } catch (error) {
    return { ok: false, error: submissionRefusal(error) };
  }

  // And again after, so the confirmation carries what was actually filed.
  const row = await repo.findSubmission(id).catch(() => null);
  if (row) void notify.received(row, ownerName, answered);

  return { ok: true };
}

/**
 * Delete one, rather than cancelling it.
 *
 * For a draft that was never sent. Nobody else has seen it, no queue counted
 * it, so a tombstone in the owner's own list is clutter. Anything that has
 * reached an admin is cancelled instead, which keeps the record.
 */
export async function deleteListing(id: number): Promise<SaveResult> {
  try {
    await repo.deleteSubmission(id);
  } catch (error) {
    return { ok: false, error: submissionRefusal(error) };
  }
  return { ok: true };
}

/**
 * Start again from one that is over.
 *
 * Returns the draft to open, which may be one they already started: pressing
 * the button twice is a double press, not a second attempt, and a second draft
 * would bury whatever they had already changed in the first.
 *
 * The old row is left exactly as it is. A decline is the record of a decision
 * somebody took, with a reason and a date, and reopening it would erase that.
 */
export async function restartListing(
  id: number,
): Promise<{ ok: true; draftId: number } | { ok: false; error: string }> {
  try {
    const draftId = await repo.restartSubmission(id);
    return { ok: true, draftId };
  } catch (error) {
    return { ok: false, error: submissionRefusal(error) };
  }
}

export async function cancelListing(id: number, ownerName = ""): Promise<SaveResult> {
  // Read before writing, because afterwards there is no way to tell whether
  // this was a draft nobody saw or a request somebody was part way through
  // reading. Only the second is worth an email.
  const before = await repo.findSubmission(id).catch(() => null);

  try {
    await repo.cancelSubmission(id);
  } catch (error) {
    return { ok: false, error: submissionRefusal(error) };
  }

  if (before && (before.status === "review_pending" || before.status === "changes_requested")) {
    void notify.withdrawn(before, ownerName);
  }

  return { ok: true };
}
