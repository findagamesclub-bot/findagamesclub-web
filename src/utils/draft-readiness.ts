import type { ReadinessInput } from "./listing-readiness";

/**
 * The eight readiness checks, answered from a draft instead of from a club.
 *
 * The review step and the admin's review screen both show the same checklist,
 * and it has to say the same thing on both. `listingChecks` already takes a
 * plain shape rather than a club, precisely so a submission could be measured
 * with it: this is the adapter, and nothing about the checks themselves moves.
 */
export function readinessFromPayload(
  payload: Record<string, unknown>,
): ReadinessInput {
  const club = (payload.club ?? {}) as Partial<{
    name: string; city: string; summary: string | null; description: string | null;
    venue_name: string | null; venue_postcode: string | null; venue_address: string | null;
    website_url: string | null; contact_email: string | null; ages: string | null;
    member_count: number | null; tables_available: number | null;
  }>;
  const strings = (key: string): string[] =>
    Array.isArray(payload[key]) ? (payload[key] as unknown[]).map(String) : [];

  const tiers = Array.isArray(payload.tiers)
    ? (payload.tiers as { is_basic?: boolean; price?: string }[]) : [];
  const loyalty = (payload.loyalty ?? {}) as { enabled?: boolean };

  const sessions = Array.isArray(payload.sessions)
    ? (payload.sessions as { day?: string; time?: string; label?: string }[]) : [];

  return {
    name: club.name ?? null,
    city: club.city ?? null,
    summary: club.summary ?? null,
    description: club.description ?? null,
    formats: strings("formats"),

    venueName: club.venue_name ?? null,
    postcode: club.venue_postcode ?? null,
    venueAddress: club.venue_address ?? null,
    website: club.website_url ?? null,

    contactEmail: club.contact_email ?? null,

    ages: club.ages ?? null,
    memberCount: club.member_count ?? null,
    tablesAvailable: club.tables_available ?? null,

    featuredGames: strings("games"),
    facilities: strings("facilities"),
    paymentMethods: strings("payment_methods"),

    // The same two questions the live editor asks its own tables: is there a
    // tier people join on with a price against it, and is the points scheme
    // switched on. A draft has no tables to ask, so the payload answers.
    basicMembershipPriced: tiers.some(
      (t) => t.is_basic === true && String(t.price ?? "").trim() !== ""),
    loyaltyReady: loyalty.enabled === true,

    sessions: sessions.map((s) => ({ day: s.day, time: s.time, label: s.label })),
  };
}
