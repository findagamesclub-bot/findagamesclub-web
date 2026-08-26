import "server-only";

import * as repo from "@/repositories/clubs.repository";
import { formatMeeting, formatPrice, formatPricingLabel } from "@/utils/format";
import { splitByDate, toEventSummary } from "@/utils/event-summary";
import { toMembershipTiers } from "@/utils/membership-tiers";
import { billingOptions } from "./payments.service";
import type { ClubDetail } from "@/types/clubDetail";

type Row = Awaited<ReturnType<typeof repo.findClubDetail>>;

export async function getClubDetail(slug: string): Promise<ClubDetail | null> {
  const row = await repo.findClubDetail(slug);
  return row ? toDetail(row) : null;
}

const byPosition = <T extends { position?: number | null }>(items: T[] = []) =>
  [...items].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

function toDetail(row: NonNullable<Row>): ClubDetail {
  const sessions = byPosition(row.club_sessions ?? []);
  const first = sessions[0];

  const events = splitByDate((row.club_events ?? []).map(toEventSummary));

  // A removed review is gone from the page and out of the average. Filtering
  // in SQL would drop the club when postgrest found no matching child rows.
  const reviews = (row.club_reviews ?? [])
    .filter((r) => !r.removed_at)
    .map((r) => ({
      id: r.id,
      authorId: r.author_profile_id,
      authorName: r.author_name,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.created_at,
      flaggedAt: r.flagged_at,
      flaggedByName: r.flagged_by_name,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const reviewSummary = reviews.length
    ? {
        average: reviews.reduce((n, r) => n + r.rating, 0) / reviews.length,
        count: reviews.length,
      }
    : null;

  return {
    id: row.id,
    ownerId: row.owner_id,
    slug: row.slug,
    name: row.name,
    city: row.city,
    neighbourhood: row.neighbourhood,
    country: row.country,
    summary: row.summary,
    description: row.description,
    logoUrl: row.logo_url,
    isFeatured: row.spotlight,
    announcement: row.announcement,

    venue: {
      // Deep-linking the address rather than the coordinates: a postcode is what
      // people actually type, and it survives a venue moving a few doors down.
      directionsUrl: (() => {
        const parts = [row.venue_name, row.venue_address, row.venue_postcode].filter(Boolean);
        return parts.length
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(", "))}`
          : null;
      })(),
      coordinates:
        row.latitude !== null && row.longitude !== null
          ? { latitude: row.latitude, longitude: row.longitude }
          : null,
      name: row.venue_name,
      address: row.venue_address,
      postcode: row.venue_postcode,
      district: row.venue_postcode_district,
    },
    contact: { email: row.contact_email, website: row.website_url },

    meetingLabel: first ? formatMeeting(first.day, first.time) : null,
    schedule: sessions.map((s) => ({ day: s.day, time: s.time, label: s.label })),
    // Zero means no table booking offered, not "none free tonight".
    tablesAvailable: row.tables_available || null,
    memberCount: row.member_count || null,
    fromPrice: row.price_drop_in,
    membershipPrice: row.price_membership,
    ages: row.ages,
    accessibility: row.accessibility ?? [],
    tags: row.tags ?? [],

    formats: (row.club_formats ?? []).map((f) => f.formats?.label ?? "").filter(Boolean),
    games: (row.club_games ?? []).map((g) => g.games?.label ?? "").filter(Boolean),
    facilities: (row.club_facilities ?? []).map((f) => f.facilities?.label ?? "").filter(Boolean),
    paymentMethods: (row.club_payment_methods ?? []).map((p) => p.payment_methods?.label ?? "").filter(Boolean),
    discussionCategories: byPosition(row.club_discussion_categories ?? []).map((d) => d.label),

    images: byPosition(row.club_images ?? []).map((i) => ({ src: i.src, alt: i.alt })),
    socialLinks: byPosition(row.club_social_links ?? []).map((l) => ({ label: l.label, url: l.url })),
    pricingModels: byPosition(row.club_pricing_models ?? []).map((p) => ({
      label: formatPricingLabel(p.label),
      price: formatPrice(p.price),
      notes: p.notes,
    })),
    announcements: (row.club_announcements ?? [])
      .map((a) => ({ message: a.message, createdAt: a.created_at }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    membershipTiers: toMembershipTiers(row.club_membership_tiers ?? []),

    upcomingEvents: events.upcoming,
    pastEvents: events.past,

    reviews,
    reviewSummary,
  };
}
