import "server-only";

import { sendEmail } from "@/lib/email/send";
import * as templates from "@/lib/email/templates";
import { deliver, siteUrl } from "./mail-recipient.service";
import { findSiteSettings } from "@/repositories/siteSettings.repository";
import {
  findClubForNotice, findClubSuspension, findEventForNotice, findEventSuspension,
} from "@/repositories/adminListings.repository";
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
  await deliver(row.owner_id, "club-request", (name) => (answered
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
  await deliver(row.owner_id, "listing-changes-needed", (name) => templates.listingChangesRequested({
    name,
    clubName: row.club_name || "your club",
    note,
    url: listingUrl(row.id),
  }));
}

export async function declined(row: Row, reason: string) {
  await deliver(row.owner_id, "listing-declined", (name) => templates.listingDeclined({
    name,
    clubName: row.club_name || "your club",
    reason,
    // Their own list rather than the listing itself: the declined one is not
    // editable, and the way back is the Start again button beside it.
    url: `${siteUrl()}/account/listings`,
  }));
}

export async function approved(row: Row, slug: string) {
  await deliver(row.owner_id, "listing-approved", (name) => templates.listingApproved({
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
    await deliver(club.ownerId, paused ? "listing-paused" : "listing-resumed", (name) => (paused
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

/**
 * An admin has taken a listing down, or put it back.
 *
 * Its own function rather than a flag on `clubPaused`, for the reason the
 * template is its own template: a pause is the club reading about their own
 * decision and this is them reading about ours. The reason travels with it,
 * because a letter saying something happened and not why costs somebody a
 * reply to learn the one thing they opened it for.
 */
export async function clubSuspended(
  clubId: number, down: boolean, actorId?: string,
) {
  const club = await findClubForNotice(clubId).catch(() => null);
  if (!club?.owner_id) return;
  // An admin suspending their own club hears nothing about their own doing.
  // Same test the trigger in 0188 uses, so the bell and the inbox cannot
  // disagree about who did what.
  if (club.owner_id === actorId) return;

  const reason = down ? await reasonFor(clubId) : "";

  await deliver(club.owner_id, down ? "listing-suspended" : "listing-restored",
    (name) => (down
      ? templates.listingSuspended({
        name, clubName: club.name, reason,
        url: `${siteUrl()}/clubs/${club.slug}/manage/listing/review`,
      })
      : templates.listingRestored({
        name, clubName: club.name, url: `${siteUrl()}/clubs/${club.slug}`,
      })));
}

export async function eventSuspended(
  eventId: number, down: boolean, actorId?: string,
) {
  const event = await findEventForNotice(eventId).catch(() => null);
  const club = (event as { clubs?: { slug: string; name: string; owner_id: string | null } } | null)?.clubs;
  if (!event || !club?.owner_id || club.owner_id === actorId) return;

  const reason = down ? (await findEventSuspension(eventId).catch(() => null))?.[0]?.reason ?? "" : "";

  await deliver(club.owner_id, down ? "event-taken-down" : "event-put-back",
    (name) => (down
      ? templates.eventTakenDown({
        name, clubName: club.name, eventTitle: event.title, reason,
        url: `${siteUrl()}/clubs/${club.slug}/manage/events/${event.id}`,
      })
      : templates.eventPutBack({
        name, clubName: club.name, eventTitle: event.title,
        url: `${siteUrl()}/clubs/${club.slug}/events/${event.legacy_id}`,
      })));
}

/**
 * Read back after the write, never echoed from the form.
 *
 * The function trims and caps what it stores, so quoting the argument would
 * put a slightly different sentence in the letter from the one on the banner.
 */
async function reasonFor(clubId: number) {
  const rows = await findClubSuspension(clubId).catch(() => null);
  return (rows?.[0]?.reason ?? "").trim();
}
