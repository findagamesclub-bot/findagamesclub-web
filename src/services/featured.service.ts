import "server-only";

import { unstable_cache } from "next/cache";

import * as repo from "@/repositories/featured.repository";
import * as notify from "./featured-notify.service";
import { billingRefusal } from "@/utils/billing-refusals";
import { londonNow } from "@/utils/dates";

export type FeaturedResult = { ok: true } | { ok: false; error: string };

export const FEATURED_TAG = "featured-clubs";

/**
 * Who leads the homepage.
 *
 * The same answer for every visitor and read on the busiest page in the app, so
 * it is cached for a minute and tagged. Sessionless underneath, because
 * `unstable_cache` cannot contain `cookies()` and the Supabase server client
 * reads them.
 */
const readFeatured = unstable_cache(
  async (limit: number) => repo.findFeaturedClubs(limit).catch(() => []),
  ["featured-clubs"],
  { revalidate: 60, tags: [FEATURED_TAG] },
);

export async function getFeaturedClubs(limit = 6) {
  return readFeatured(limit);
}

export async function getSlots() {
  return repo.findSlots().catch(() => []);
}

export async function getClubsForPicker() {
  return repo.findClubsForPicker().catch(() => []);
}

/**
 * Book a slot, and tell the club it is on one.
 *
 * The bell is 0155's trigger, so it fires whatever writes the row. The email is
 * here, because nothing in SQL sends one. It is deliberately after the write
 * and deliberately not awaited for a result: a bounced message must never turn
 * a booked slot into "could not book that".
 */
export async function featureClub(params: {
  club: number; from: string; to: string | null;
  pricePence: number | null; note: string;
}): Promise<FeaturedResult & { slotId?: number }> {
  let slotId: number;
  try {
    slotId = await repo.featureClub(params);
  } catch (error) {
    return { ok: false, error: billingRefusal(error) };
  }

  try {
    // The row rather than the form: `feature_club` fills in the end date from
    // the configured duration and the price from the settings when neither was
    // typed, so the email would otherwise quote figures nobody agreed to.
    const held = await repo.findSlot(slotId);
    if (held?.club) {
      await notify.featuredBooked(
        { slug: held.club.slug, name: held.club.name, ownerId: held.club.owner_id },
        held.starts_on, held.ends_on, held.price_pence,
        held.starts_on <= todayIso());
    }
  } catch (error) {
    console.error("[featured] could not write to the club about a new slot", error);
  }
  // Handed back so a booking made in answer to a club's request can be tied to
  // it. The slot is the answer, so the request is marked against this id rather
  // than the admin pressing a second button to say what they just did.
  return { ok: true, slotId };
}

/**
 * Take a slot down, and say so when it had not finished.
 *
 * Read before the delete, because the row is gone afterwards and the owner's
 * address hangs off the club. A slot that already ended says nothing: the owner
 * was told when it ended and telling them again because somebody tidied the
 * list is the site inventing news. 0155's trigger draws the same line.
 */
export async function unfeatureClub(slot: number): Promise<FeaturedResult> {
  let held: Awaited<ReturnType<typeof repo.findSlot>> = null;
  try {
    held = await repo.findSlot(slot);
  } catch (error) {
    console.error("[featured] could not read a slot before removing it", error);
  }

  try {
    await repo.unfeatureClub(slot);
  } catch (error) {
    return { ok: false, error: billingRefusal(error) };
  }

  try {
    if (held?.club && held.ends_on >= todayIso()) {
      await notify.featuredRemoved(
        { slug: held.club.slug, name: held.club.name, ownerId: held.club.owner_id },
        held.ends_on);
    }
  } catch (error) {
    console.error("[featured] could not write to the club about a removed slot", error);
  }
  return { ok: true };
}

/** A London day, like every other date in this app. */
const todayIso = () => londonNow().date;

/**
 * The clubs wearing the badge today, which is not the same list as the
 * homepage's.
 *
 * "Featured" on a card is a claim that somebody paid for a placement. The
 * directory and the club page were both reading `clubs.spotlight` for it,
 * which is an editorial pick an admin can set on any club, so a club with no
 * booking at all read as featured. The client found that in the directory.
 *
 * `spotlight` keeps the job 0113 gave it: filling the homepage row before
 * anything has been sold, so the front page is not empty on day one. It just
 * does not get to say somebody paid.
 *
 * Cached and tagged with the slots themselves, so booking or removing one
 * clears this in the same breath rather than leaving a badge up for a minute
 * after the slot went.
 */
const readLiveFeatured = unstable_cache(
  async (today: string) => repo.findLiveFeaturedClubIds(today).catch((error): number[] => {
    // Logged rather than swallowed. An empty list here takes the badge off
    // every club, which looks exactly like "nobody is featured today" and is
    // the quietest possible way for this to break.
    console.error("[featured] the live slots did not load", error);
    return [];
  }),
  ["live-featured-clubs"],
  { revalidate: 60, tags: [FEATURED_TAG] },
);

export async function getLiveFeaturedClubIds(): Promise<number[]> {
  // The London day, because a slot runs on London days and a boundary read in
  // the server's timezone puts a slot's last evening in the wrong day. The
  // same helper every other date on this page already goes through.
  return readLiveFeatured(todayIso());
}
