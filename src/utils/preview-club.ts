import { toMembershipTiers, type TierRow } from "./membership-tiers";
import { clubImageUrl, clubLogoUrl } from "./club-media";
import { formatMeeting, formatPrice } from "./format";
import type { ClubDetail } from "@/types/clubDetail";

/**
 * A submitted listing, in the shape the public club page already renders.
 *
 * The review screen read the payload as rows of labels and values, which
 * answers "is anything missing" and not "what will people see". The client
 * asked for the second: "a preview button so an admin can see how the listing
 * will look before confirming or sending back."
 *
 * A mapper rather than a second set of components, because a preview built out
 * of its own markup is a preview of itself. Everything downstream of this is
 * the club page's own `ClubHeader`, `ClubNights`, `ClubNoticeboard` and the
 * rest, so what an admin sees here cannot drift from what gets published. That
 * is the whole value of the screen: a preview that lies is worse than none.
 *
 * Pure, so it has no idea where the files live: `publicUrl` is passed in, the
 * same way `clubImageUrl` already takes it.
 */

type Row = Record<string, unknown>;

const text = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value);

const orNull = (value: unknown): string | null => text(value).trim() || null;

const rows = (value: unknown): Row[] =>
  Array.isArray(value) ? (value as Row[]).filter((r) => r && typeof r === "object") : [];

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(String).filter(Boolean) : [];

const count = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
};

export function previewClub(
  payload: Record<string, unknown>,
  slug: string,
  publicUrl: (bucket: string, path: string) => string,
): ClubDetail {
  const club = (payload.club ?? {}) as Row;
  const sessions = rows(payload.sessions);
  const first = sessions[0];

  const tiers = rows(payload.tiers).map((t, index) => ({
    tier_key: text(t.tier_key),
    label: text(t.label),
    price: orNull(t.price),
    price_duration: text(t.price_duration),
    description: orNull(t.description),
    is_basic: t.is_basic === true,
    // Position is the club's ladder and the payload keeps it as list order, so
    // the index IS the position. Dropping it would reorder the tier cards and
    // break `ticketBlockedReason`, which compares indexes in this list.
    position: index,
    benefits: t.benefits ?? {},
    billing_options: t.billing_options ?? [],
  })) satisfies TierRow[];

  const models = rows(payload.pricing_models).map((m) => ({
    label: text(m.label),
    price: formatPrice(text(m.price)),
    notes: text(m.notes),
  })).filter((m) => m.label);

  return {
    // Nothing on this page addresses the club by id, because there is no club:
    // the page is rendered from the payload and every interactive control is
    // left off. A zero here is louder than a plausible number if one ever
    // reaches a query by mistake.
    id: 0,
    ownerId: null,
    status: "active",
    claimable: false,
    slug,
    name: text(club.name) || "Untitled listing",
    city: text(club.city),
    neighbourhood: orNull(club.neighbourhood),
    country: text(club.country) || "United Kingdom",
    summary: orNull(club.summary),
    description: orNull(club.description),
    logoUrl: clubLogoUrl({ logoPath: text(payload.logo_path) || null }, publicUrl),
    logoPath: text(payload.logo_path) || null,
    isFeatured: false,
    announcement: null,

    venue: {
      name: orNull(club.venue_name),
      address: orNull(club.venue_address),
      postcode: orNull(club.venue_postcode),
      district: null,
      // A listing has not been geocoded yet: that happens on approval, from
      // the postcode. So the preview says where rather than drawing a pin in
      // the sea, and the map is left off the page entirely.
      coordinates: null,
      directionsUrl: null,
    },
    contact: {
      email: orNull(club.contact_email),
      website: orNull(club.website_url),
    },

    meetingLabel: first ? formatMeeting(text(first.day), text(first.time)) : null,
    schedule: sessions.map((s) => ({
      day: text(s.day), time: text(s.time), label: text(s.label),
    })),
    tablesAvailable: count(club.tables_available),
    memberCount: count(club.member_count),
    fromPrice: models[0]?.price ?? null,
    membershipPrice: null,
    ages: orNull(club.ages),
    accessibility: [],
    tags: [],

    formats: strings(payload.formats),
    games: strings(payload.games),
    facilities: strings(payload.facilities),
    paymentMethods: strings(payload.payment_methods),
    discussionCategories: rows(payload.categories).map((c) => text(c.label)).filter(Boolean),

    images: rows(payload.images).map((image) => ({
      src: clubImageUrl(
        { src: text(image.src), storagePath: text(image.storage_path) || null },
        publicUrl,
      ),
      alt: text(image.alt),
    })).filter((image) => image.src),
    socialLinks: rows(payload.social_links)
      .map((l) => ({ label: text(l.label), url: text(l.url) }))
      .filter((l) => l.label && l.url),
    pricingModels: models,
    // Dated from nothing, because a listing's notices have not been posted
    // yet: `approve_club_submission` inserts them on the day it is approved.
    // An empty `createdAt` is what `ClubNoticeboard` already draws as a note
    // with no date rather than one dated 1 January 1970.
    announcements: rows(payload.announcements)
      .map((a, index) => ({ id: index, message: text(a.message), createdAt: "" }))
      .filter((a) => a.message),
    membershipTiers: toMembershipTiers(tiers),

    // Nobody has reviewed a club that does not exist, and a review section
    // drawn empty would read as a club nobody rates rather than as one nobody
    // has been to yet.
    reviews: [],
    reviewSummary: null,
  };
}
