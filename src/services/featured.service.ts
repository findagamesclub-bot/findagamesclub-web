import "server-only";

import { unstable_cache } from "next/cache";

import * as repo from "@/repositories/featured.repository";
import { billingRefusal } from "@/utils/billing-refusals";

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

export async function featureClub(params: {
  club: number; from: string; to: string | null;
  pricePence: number | null; note: string;
}): Promise<FeaturedResult> {
  try {
    await repo.featureClub(params);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: billingRefusal(error) };
  }
}

export async function unfeatureClub(slot: number): Promise<FeaturedResult> {
  try {
    await repo.unfeatureClub(slot);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: billingRefusal(error) };
  }
}
