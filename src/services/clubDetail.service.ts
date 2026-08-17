import "server-only";

import * as repo from "@/repositories/clubs.repository";
import { formatMeeting } from "@/utils/format";
import type { ClubDetail, ClubEventSummary } from "@/types/clubDetail";

type Row = Awaited<ReturnType<typeof repo.findClubDetail>>;

export async function getClubDetail(slug: string): Promise<ClubDetail | null> {
  const row = await repo.findClubDetail(slug);
  return row ? toDetail(row) : null;
}

const byPosition = <T extends { position?: number | null }>(items: T[] = []) =>
  [...items].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

/** An event is over once its end date has passed; undated events stay upcoming. */
function hasEnded(endDate: string | null, startDate: string | null): boolean {
  const last = endDate ?? startDate;
  if (!last) return false;
  const today = new Date().toISOString().slice(0, 10);
  return last < today;
}

function toDetail(row: NonNullable<Row>): ClubDetail {
  const sessions = byPosition(row.club_sessions ?? []);
  const first = sessions[0];

  const events: ClubEventSummary[] = (row.club_events ?? [])
    .map((e) => ({
      id: e.id,
      slug: e.legacy_id,
      title: e.title,
      summary: e.summary,
      startDate: e.start_date,
      startTime: e.start_time,
      endDate: e.end_date,
      eventType: e.event_type,
      price: e.price,
      roundCount: e.round_count,
      ticketsAvailable: e.tickets_available,
      venueName: e.venue_name,
      hasEnded: hasEnded(e.end_date, e.start_date),
    }))
    .sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""));

  const reviews = (row.club_reviews ?? []).map((r) => ({
    id: r.id,
    authorName: r.author_name,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.created_at,
  }));

  const reviewSummary = reviews.length
    ? {
        average: reviews.reduce((n, r) => n + r.rating, 0) / reviews.length,
        count: reviews.length,
      }
    : null;

  return {
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
      label: p.label,
      price: p.price,
      notes: p.notes,
    })),
    announcements: (row.club_announcements ?? [])
      .map((a) => ({ message: a.message, createdAt: a.created_at }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    membershipTiers: byPosition(row.club_membership_tiers ?? []).map((t) => ({
      key: t.tier_key,
      label: t.label,
      price: t.price,
      priceDuration: t.price_duration,
      description: t.description,
      isBasic: t.is_basic,
      benefits: Array.isArray(t.benefits) ? (t.benefits as string[]) : [],
    })),

    upcomingEvents: events.filter((e) => !e.hasEnded),
    pastEvents: events.filter((e) => e.hasEnded).reverse(),

    reviews,
    reviewSummary,
  };
}
