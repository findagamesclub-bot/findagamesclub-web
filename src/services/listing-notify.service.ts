import "server-only";

import { sendEmail } from "@/lib/email/send";
import * as templates from "@/lib/email/templates";
import { deliver, siteUrl } from "./mail-recipient.service";
import { findSiteSettings } from "@/repositories/siteSettings.repository";
import type { SubmissionRow, SubmissionListRow } from "@/repositories/submissions.repository";

/**
 * The emails a listing generates.
 *
 * Legacy sends none of them, so somebody who listed their club on a Sunday
 * heard nothing until it appeared in the directory. Every one of these answers
 * a question they would otherwise have to email the contact address to ask.
 *
 * Apart from the writes, for the same reason every other notify service is:
 * a mail failure must never undo an approval that has already made a club.
 * Nothing here is awaited for a result and nothing throws.
 */

type Row = SubmissionRow | SubmissionListRow;

const listingUrl = (id: number) => `${siteUrl()}/list-your-club/${id}`;
const reviewUrl = (id: number) => `${siteUrl()}/admin/submissions/${id}`;

/**
 * They have sent it. Tell them we have it, and tell us it is there.
 *
 * `answered` is whether this is a club coming back after we sent it back,
 * which is different news to both sides. To them, "we have your listing" for
 * changes they spent an evening making reads as though nobody noticed; to us,
 * "new listing" for one we had already read and returned puts an admin back at
 * the top of something they know, with no hint they were the one who asked.
 */
export async function received(row: Row, ownerName: string, answered = false) {
  await deliver(row.owner_id, (name) => (answered
    ? templates.listingResubmitted({
      name,
      clubName: row.club_name || "your club",
      url: listingUrl(row.id),
    })
    : templates.listingReceived({
      name,
      clubName: row.club_name || "your club",
      url: listingUrl(row.id),
    })));

  // And the one that goes to us. Without it the queue is only found by
  // somebody remembering to open it, which is how a listing sits for a
  // fortnight.
  try {
    const settings = await findSiteSettings();
    const to = (settings?.contact_email ?? "").trim();
    if (!to) return;

    const forUs = {
      clubName: row.club_name || "Untitled listing",
      city: row.city,
      ownerName: ownerName || "Somebody",
      url: reviewUrl(row.id),
    };

    await sendEmail({
      to,
      ...(answered
        ? templates.listingResubmittedAdmin(forUs)
        : templates.listingSubmittedAdmin(forUs)),
    });
  } catch (error) {
    console.error("[listing] the queue notice did not send", error);
  }
}

export async function changesRequested(row: Row, note: string) {
  await deliver(row.owner_id, (name) => templates.listingChangesRequested({
    name,
    clubName: row.club_name || "your club",
    note,
    url: listingUrl(row.id),
  }));
}

export async function declined(row: Row, reason: string) {
  await deliver(row.owner_id, (name) => templates.listingDeclined({
    name,
    clubName: row.club_name || "your club",
    reason,
    // Their own list rather than the listing itself: the declined one is not
    // editable, and the way back is the Start again button beside it.
    url: `${siteUrl()}/account/listings`,
  }));
}

export async function approved(row: Row, slug: string) {
  await deliver(row.owner_id, (name) => templates.listingApproved({
    name,
    clubName: row.club_name || "your club",
    url: `${siteUrl()}/clubs/${slug}`,
    consoleUrl: `${siteUrl()}/clubs/${slug}/manage`,
  }));
}

/**
 * Tell us a request has gone.
 *
 * Only for one that had reached the queue. A draft nobody ever saw leaving is
 * not news to anybody.
 */
export async function withdrawn(row: Row, ownerName: string) {
  try {
    const settings = await findSiteSettings();
    const to = (settings?.contact_email ?? "").trim();
    if (!to) return;

    await sendEmail({
      to,
      ...templates.listingWithdrawnAdmin({
        clubName: row.club_name || "A listing",
        city: row.city,
        ownerName: ownerName || "The club",
        url: `${siteUrl()}/admin/submissions`,
      }),
    });
  } catch (error) {
    console.error("[listing] the withdrawal notice did not send", error);
  }
}

/**
 * A club has left the directory, or come back.
 *
 * One message to the site contact address rather than one per admin. The bell
 * tells each of them; this is what still works when there are a hundred.
 */
export async function clubPaused(
  club: { name: string; city: string; slug: string; ownerId?: string | null },
  paused: boolean,
  /** Who pressed it. The club hears nothing about its own doing. */
  actorId?: string,
) {
  // Only when somebody else moved it: an admin today, the lapse job in Stage 5.
  // Same condition as the trigger in 0110, so the bell and the inbox cannot
  // disagree about who did what.
  if (club.ownerId && club.ownerId !== actorId) {
    await deliver(club.ownerId, (name) => (paused
      ? templates.listingPaused({
        name,
        clubName: club.name,
        url: `${siteUrl()}/clubs/${club.slug}/manage/listing/review`,
      })
      : templates.listingResumed({
        name,
        clubName: club.name,
        url: `${siteUrl()}/clubs/${club.slug}`,
      })));
  }

  try {
    const settings = await findSiteSettings();
    const to = (settings?.contact_email ?? "").trim();
    if (!to) return;

    const forUs = {
      clubName: club.name,
      city: club.city,
      url: `${siteUrl()}/clubs/${club.slug}`,
    };

    await sendEmail({
      to,
      ...(paused ? templates.clubPausedAdmin(forUs) : templates.clubResumedAdmin(forUs)),
    });
  } catch (error) {
    console.error("[listing] the pause notice did not send", error);
  }
}
