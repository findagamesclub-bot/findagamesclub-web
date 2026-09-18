import "server-only";

import * as repo from "@/repositories/clubs.repository";
import * as taxonomy from "@/repositories/taxonomy.repository";
import * as notify from "@/services/listing-notify.service";
import * as sections from "@/repositories/listingSections.repository";
import { parseProfileStep, type FieldErrors } from "@/utils/listing-draft";
import {
  contentReading, pricingReading, profileColumns, scheduleReading,
} from "@/utils/listing-payload";
import {
  listingChecks, stepDone, stepStatus, type ReadinessInput,
} from "@/utils/listing-readiness";
import { geocodeUk } from "./geocode.service";

/**
 * The listing editor's writes.
 *
 * One save per step rather than legacy's single payload for everything. Legacy
 * can send the lot because every field falls back to the value already on the
 * record, so a partial payload never blanks anything; ours is split by table,
 * which gets the same property and lets a step say which part of itself failed.
 */

export type SaveResult =
  | { ok: true }
  | { ok: false; error?: string; errors?: FieldErrors };

export async function saveProfileStep(clubId: number, form: FormData): Promise<SaveResult> {
  const parsed = parseProfileStep(form);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };

  const v = parsed.value;
  try {
    // The same reading the public builder stores on a submission, so a club
    // that arrived through the queue and one edited here are shaped identically.
    await repo.updateClubProfile(clubId, profileColumns(v));

    // Formats live in their own table, so they are their own write. Replaced
    // whole rather than merged: the picker sends everything it holds, and a
    // format removed in the browser has to disappear here too.
    await taxonomy.replaceClubTaxonomy(clubId, "formats", v.formats);

    // The trigger in 0083 has flagged the club if the postcode or the address
    // moved. Placing it is done here rather than in the form, because a form
    // that could send a latitude could pin a club anywhere.
    await placeIfMoved(clubId);
  } catch (error) {
    return refusal(error);
  }

  return { ok: true };
}

/**
 * Turn a database refusal into something worth reading.
 *
 * Every guard in 0086 raises a code and then says why in plain words, so the
 * message after the colon is already written for the person who caused it.
 */
function refusal(error: unknown): SaveResult {
  const message = error instanceof Error ? error.message : "";

  // Anything we do not recognise is a bug in here, not in what the club typed.
  // The message is the only evidence of it, so it goes to the server log rather
  // than being swallowed behind "that did not save".
  console.error("[listing] save refused:", message || error);

  if (message.includes("NOT_PERMITTED") || message.includes("row-level security")) {
    return { ok: false, error: "You do not have permission to edit this listing." };
  }
  if (message.includes("TOO_MANY_IMAGES")) {
    return { ok: false, error: "Ten photos at most. Remove one and try again." };
  }
  if (message.includes("CLUB_HAS_LIVE_EVENTS")) {
    const many = /CLUB_HAS_LIVE_EVENTS \((\d+)\)/.exec(message)?.[1];
    return {
      ok: false,
      error: `${many === "1" ? "An event" : `${many ?? "Some"} events`} coming up `
        + `${many === "1" ? "has" : "have"} places taken. Call `
        + `${many === "1" ? "it" : "them"} off first, so the people coming are told, `
        + "then pause the listing.",
    };
  }
  if (message.includes("CLUB_NOT_LIVE")) {
    return { ok: false, error: "This listing is not live, so there is nothing to pause." };
  }
  if (message.includes("CLUB_NOT_PAUSED")) {
    return {
      ok: false,
      error: "This listing was not paused by you. An admin took it down, so an admin puts it back.",
    };
  }
  for (const code of ["SESSION_HAS_BOOKINGS", "TIER_IN_USE", "CATEGORY_HAS_POSTS"]) {
    if (message.includes(code)) {
      const said = message.split(`${code}: `)[1];
      return { ok: false, error: said ? said.replace(/\.$/, "") + "." : "That cannot be removed yet." };
    }
  }
  // In development the cause goes on screen as well as in the log. A generic
  // message is right for a member and useless for whoever has to fix it.
  const detail = process.env.NODE_ENV === "development" && message ? ` [${message}]` : "";
  return {
    ok: false,
    error: `That did not save. Try again, and tell us if it keeps happening.${detail}`,
  };
}

/**
 * Step 2: what the club plays, what it has, how it takes money, and its photos.
 *
 * Four taxonomies through the one definer function, then the photos and the
 * social links, then the board's categories. Each is a replace rather than a
 * merge, so the form must send everything it holds; that is legacy's shape too,
 * whose payload carries the whole array every time.
 */
export async function saveContentStep(clubId: number, form: FormData): Promise<SaveResult> {
  const v = contentReading(form);

  try {
    await taxonomy.replaceClubTaxonomy(clubId, "games", v.games);
    await taxonomy.replaceClubTaxonomy(clubId, "facilities", v.facilities);
    await taxonomy.replaceClubTaxonomy(clubId, "payment_methods", v.payment_methods);

    await repo.replaceClubImages(clubId, v.images);
    await repo.replaceClubSocialLinks(clubId, v.social_links);
    await sections.saveCategories(clubId, v.categories);
  } catch (error) {
    return refusal(error);
  }

  // Only now the rows are gone, and never as a reason to fail the save: a file
  // left in the bucket is clutter nobody sees, and reporting the save as failed
  // over it would send somebody back to redo work that is already done.
  try {
    await repo.removeClubMedia(clubId, v.removed);
  } catch (error) {
    console.error("[listing] photos removed but their files stayed:", error);
  }

  return { ok: true };
}

/**
 * Step 4: the club's nights, its noticeboard and its booking rules.
 *
 * The nights go through the function in 0086 rather than a policy, because a
 * night with bookings on it must not be deleted and updating in place is what
 * keeps those bookings attached.
 */
export async function saveScheduleStep(clubId: number, form: FormData): Promise<SaveResult> {
  const read = scheduleReading(form);
  if (!read.ok) return { ok: false, error: read.error };

  try {
    await sections.saveSchedule(clubId, read.value.sessions);
    await repo.replaceClubAnnouncements(clubId,
      read.value.announcements.map((a) => a.message));
  } catch (error) {
    return refusal(error);
  }

  return { ok: true };
}

/**
 * Step 3: what it costs to walk in, and what it costs to join.
 *
 * The tiers go through the function in 0086, which refuses to remove one
 * anybody holds. `benefits` and `billing_options` ride back out of the form as
 * the JSON they went in as: this screen does not edit them yet, and a save that
 * did not carry them would quietly strip every perk the club has set up.
 */
export async function savePricingStep(clubId: number, form: FormData): Promise<SaveResult> {
  const read = pricingReading(form);
  if (!read.ok) return { ok: false, error: read.error };

  try {
    await sections.saveTiers(clubId, read.value.tiers);
    await repo.replaceClubPricingModels(clubId, read.value.pricing_models);
    await repo.setLoyaltyEnabled(clubId, read.value.loyalty.enabled);
  } catch (error) {
    return refusal(error);
  }

  return { ok: true };
}

/**
 * Put a moved club back on the map.
 *
 * Coordinates are not writable by anybody, so this goes through the admin
 * client, and only after the guarded update above has already succeeded: the
 * club has been proved editable by the person asking before anything
 * privileged happens.
 *
 * A failure is swallowed on purpose. The flag stays set, the old pin stays
 * where it was rather than being blanked, and the nightly sweep tries again.
 * Losing a map pin is not a reason to fail a save the club has already made.
 */
async function placeIfMoved(clubId: number): Promise<void> {
  try {
    const club = await repo.findClubForEditing(clubId);
    if (!club) return;

    if (!club.geocode_stale || !club.venue_postcode) return;

    const origin = await geocodeUk(club.venue_postcode);
    if (!origin) return;

    await repo.placeClub(clubId, origin.latitude, origin.longitude, origin.label ?? null);
  } catch {
    // Left flagged for the sweep.
  }
}

/** What the stepper and the review step read. Computed from saved data. */
export function readiness(input: ReadinessInput) {
  return {
    checks: listingChecks(input),
    status: stepStatus(input),
    done: stepDone(input),
  };
}

/**
 * Take the listing out of the directory for a while, and put it back.
 *
 * Legacy's own move, copied: `update_club` lets an owner set the listing
 * inactive and it drops out of the directory. Here it is a function rather than
 * a column the club can name, because a club that could write its own status
 * could approve itself out of `pending`.
 *
 * Owner or admin only. A manager edits the listing; taking the club off the
 * directory is not the same kind of act.
 */
export async function pauseListing(
  clubId: number,
  club?: { name: string; city: string; slug: string; ownerId?: string | null },
  actorId?: string,
): Promise<SaveResult> {
  try {
    await repo.pauseClub(clubId);
  } catch (error) {
    return refusal(error);
  }

  // Apart from the write and never awaited for a result: a mail failure must
  // not undo a pause that has already happened. The bell is a trigger, so it
  // fires whichever path moved the status.
  if (club) void notify.clubPaused(club, true, actorId);
  return { ok: true };
}

export async function resumeListing(
  clubId: number,
  club?: { name: string; city: string; slug: string; ownerId?: string | null },
  actorId?: string,
): Promise<SaveResult> {
  try {
    await repo.resumeClub(clubId);
  } catch (error) {
    return refusal(error);
  }

  if (club) void notify.clubPaused(club, false, actorId);
  return { ok: true };
}
