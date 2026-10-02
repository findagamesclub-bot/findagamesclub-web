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
}): Promise<FeaturedResult> {
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
  return { ok: true };
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
