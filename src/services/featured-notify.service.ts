import "server-only";

import * as templates from "@/lib/email/templates";
import { deliver, siteUrl } from "./mail-recipient.service";
import { formatPence } from "@/utils/format";
import { shortDate } from "@/utils/dates";

/**
 * The emails a featured slot generates.
 *
 * Apart from the writes, for the reason every other notify service is: a mail
 * failure must never undo a slot that has already been booked. Nothing here is
 * awaited for a result and nothing throws.
 *
 * The bell for all three is a trigger or a definer function in 0155. This is
 * only the inbox half, because nothing in SQL has ever sent an email.
 */

/** `shortDate` answers null on anything it cannot read, and an email cannot. */
const day = (iso: string | null | undefined, fallback: string) =>
  (iso ? shortDate(iso.slice(0, 10)) : null) ?? fallback;

const clubUrl = (slug: string) => `${siteUrl()}/clubs/${slug}`;

export type FeaturedClub = { slug: string; name: string; ownerId: string | null };

export async function featuredBooked(
  club: FeaturedClub, from: string, to: string, pricePence: number, live: boolean,
) {
  if (!club.ownerId) return;
  await deliver(club.ownerId, "featured-booked", (name) => templates.featuredBooked({
    name,
    clubName: club.name,
    from: day(from, "today"),
    to: day(to, "the end of the slot"),
    amount: formatPence(pricePence),
    live,
    url: clubUrl(club.slug),
  }));
}

export async function featuredEnded(
  club: FeaturedClub, from: string, to: string,
) {
  if (!club.ownerId) return;
  await deliver(club.ownerId, "featured-ended", (name) => templates.featuredEnded({
    name,
    clubName: club.name,
    from: day(from, "its start"),
    to: day(to, "its end"),
    url: clubUrl(club.slug),
  }));
}

export async function featuredRemoved(club: FeaturedClub, to: string) {
  if (!club.ownerId) return;
  await deliver(club.ownerId, "featured-removed", (name) => templates.featuredRemoved({
    name,
    clubName: club.name,
    to: day(to, "later"),
    url: clubUrl(club.slug),
  }));
}
