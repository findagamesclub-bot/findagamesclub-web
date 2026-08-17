import "server-only";

import * as repo from "@/repositories/clubs.repository";
import * as taxonomy from "@/repositories/taxonomy.repository";
import { resolveOrigin } from "@/services/location.service";
import { formatMeeting } from "@/utils/format";
import { haversineMiles, parseLocation } from "@/utils/geo";
import type { ClubSummary } from "@/types/club";

/** Business rules for clubs. Filters and sorts mirror the existing site exactly. */

export const PAGE_SIZE = 12;

/** Values and labels both taken from the legacy app's SORT_LABELS map. */
export const SORT_OPTIONS = [
  { value: "relevance", label: "Recommended" },
  { value: "distance", label: "Nearest first" },
  { value: "next-session", label: "Soonest next session" },
  { value: "members", label: "Most members" },
  { value: "newest", label: "Newest clubs" },
  { value: "rating", label: "Best rated" },
  { value: "reviews", label: "Most reviewed" },
  { value: "membership-price", label: "Lowest membership price" },
] as const;

export const WITHIN_MILES_OPTIONS = ["10", "15", "20", "30", "50", "100"] as const;
export const REVIEW_RATING_OPTIONS = ["4", "3", "2"] as const;

export type ClubFilters = {
  q?: string;
  city?: string;
  format?: string;
  day?: string;
  location?: string;
  withinMiles?: string;
  reviewRating?: string;
  sort?: string;
  page?: number;
};

export type ClubListResult = {
  clubs: ClubSummary[];
  total: number;
  page: number;
  pageSize: number;
  origin: { label: string } | null;
};

type SessionRow = { club_id: number; day: string; time: string; label: string };
type GameRow = { club_id: number; games: { slug: string; label: string } | null };

const DAY_INDEX = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export async function listClubs(filters: ClubFilters = {}): Promise<ClubListResult> {
  const page = Math.max(1, filters.page ?? 1);

  // Pull the whole active set: 11 clubs today, and distance/rating sorting has
  // to happen across all of them before paging, not within a page.
  const { rows } = await repo.findActiveClubs({
    city: filters.city,
    format: filters.format,
    day: filters.day,
    limit: 500,
  });

  const ids = rows.map((r) => r.id);
  const [sessions, games, reviews, , locations] = await Promise.all([
    repo.findSessionsForClubs(ids),
    repo.findGamesForClubs(ids),
    repo.findReviewAggregates(),
    Promise.resolve(null),
    filters.location ? repo.findClubLocations() : Promise.resolve([]),
  ]);

  const prices = await monthlyPrices(rows);
  const sessionsByClub = groupBy(sessions as SessionRow[]);
  const gamesByClub = groupBy(games as unknown as GameRow[]);

  let matched = rows;

  // Search matches a club's games and facilities only — not its name, town or
  // summary. Terms are comma-separated, so "warhammer terrain" is one phrase
  // while "warhammer, terrain" is two that must both match. Runs against the
  // club's original spellings, so "warhammer 40k" and "aos" still work.
  const terms = (filters.q ?? "")
    .toLowerCase()
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  if (terms.length) {
    matched = matched.filter((c) => terms.every((t) => c.search_haystack.includes(t)));
  }

  if (filters.reviewRating) {
    const min = Number(filters.reviewRating);
    matched = matched.filter((c) => (reviews.get(c.id)?.average ?? 0) >= min);
  }

  const origin = filters.location ? resolveOrigin(filters.location, locations) : null;
  const distances = new Map<number, number>();

  if (origin) {
    for (const club of matched) {
      if (club.latitude == null || club.longitude == null) continue;
      distances.set(club.id, haversineMiles(origin.latitude, origin.longitude, club.latitude, club.longitude));
    }
    if (filters.withinMiles) {
      const limit = Number(filters.withinMiles);
      matched = matched.filter((c) => (distances.get(c.id) ?? Infinity) <= limit);
    }
  }

  // Sorting by distance without a place to measure from is meaningless, so the
  // legacy app quietly falls back to relevance. Match that.
  const effectiveSort =
    filters.sort === "distance" && !origin ? "relevance" : filters.sort ?? (origin ? "distance" : "relevance");

  matched = sortClubs(matched, effectiveSort, {
    distances,
    reviews,
    prices,
    sessions: sessionsByClub,
    locationRank: rankByLocation(matched, filters.location),
  });

  const total = matched.length;
  const pageRows = matched.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return {
    clubs: pageRows.map((row) =>
      toSummary(row, sessionsByClub.get(row.id) ?? [], gamesByClub.get(row.id) ?? [], distances.get(row.id)),
    ),
    total,
    page,
    pageSize: PAGE_SIZE,
    origin: origin ? { label: origin.label } : null,
  };
}

function sortClubs(
  clubs: repo.ClubRow[],
  sort: string,
  ctx: {
    distances: Map<number, number>;
    reviews: Map<number, { average: number; count: number }>;
    prices: Map<number, number>;
    sessions: Map<number, SessionRow[]>;
    locationRank: Map<number, number>;
  },
): repo.ClubRow[] {
  const rows = [...clubs];
  const now = new Date();
  const todayIndex = now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // (days until, start time) for the soonest session. A session that already
  // finished today rolls to next week, same as the legacy key.
  const nextSession = (id: number): [number, number] => {
    let best: [number, number] = [Infinity, Infinity];
    for (const slot of ctx.sessions.get(id) ?? []) {
      const dayIndex = DAY_INDEX.indexOf(slot.day);
      if (dayIndex === -1) continue;
      let daysUntil = (dayIndex - todayIndex + 7) % 7;
      const times = [...String(slot.time ?? "").matchAll(/(\d{1,2}):(\d{2})/g)];
      const start = times[0] ? Number(times[0][1]) * 60 + Number(times[0][2]) : Infinity;
      const end = times[1] ? Number(times[1][1]) * 60 + Number(times[1][2]) : null;
      if (daysUntil === 0 && end !== null && end <= nowMinutes) daysUntil = 7;
      if (daysUntil < best[0] || (daysUntil === best[0] && start < best[1])) best = [daysUntil, start];
    }
    return best;
  };

  switch (sort) {
    case "distance":
      return rows.sort((a, b) => (ctx.distances.get(a.id) ?? Infinity) - (ctx.distances.get(b.id) ?? Infinity));
    case "next-session":
      return rows.sort((a, b) => {
        const [ad, at] = nextSession(a.id);
        const [bd, bt] = nextSession(b.id);
        return ad - bd || at - bt || a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      });
    case "members":
      return rows.sort(
        (a, b) =>
          (b.member_count ?? 0) - (a.member_count ?? 0) ||
          a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
      );
    case "newest":
      // Clubs with a known date first, newest first; unknown dates last.
      return rows.sort((a, b) => {
        const av = a.legacy_created_at, bv = b.legacy_created_at;
        if (!av && !bv) return a.name.localeCompare(b.name);
        if (!av) return 1;
        if (!bv) return -1;
        return bv.localeCompare(av);
      });
    case "rating":
      return rows.sort(
        (a, b) =>
          (ctx.reviews.get(b.id)?.average ?? 0) - (ctx.reviews.get(a.id)?.average ?? 0) ||
          (ctx.reviews.get(b.id)?.count ?? 0) - (ctx.reviews.get(a.id)?.count ?? 0) ||
          a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
      );
    case "reviews":
      return rows.sort(
        (a, b) =>
          (ctx.reviews.get(b.id)?.count ?? 0) - (ctx.reviews.get(a.id)?.count ?? 0) ||
          (ctx.reviews.get(b.id)?.average ?? 0) - (ctx.reviews.get(a.id)?.average ?? 0) ||
          a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
      );
    case "membership-price":
      return rows.sort(
        (a, b) =>
          (ctx.prices.get(a.id) ?? Infinity) - (ctx.prices.get(b.id) ?? Infinity) ||
          a.name.localeCompare(b.name),
      );
    default:
      // Matches the legacy relevance key exactly:
      //   (locationRank, distance, !spotlight, city, name)
      return rows.sort(
        (a, b) =>
          (ctx.locationRank.get(a.id) ?? 3) - (ctx.locationRank.get(b.id) ?? 3) ||
          (ctx.distances.get(a.id) ?? Infinity) - (ctx.distances.get(b.id) ?? Infinity) ||
          Number(b.spotlight) - Number(a.spotlight) ||
          a.city.toLowerCase().localeCompare(b.city.toLowerCase()) ||
          a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
      );
  }
}

export async function getFilterOptions() {
  const [formats, cities, days] = await Promise.all([
    taxonomy.findFormats(),
    taxonomy.findCities(),
    taxonomy.findMeetingDays(),
  ]);
  return {
    formats,
    cities,
    days,
    sorts: SORT_OPTIONS.map((s) => ({ ...s })),
    withinMiles: [...WITHIN_MILES_OPTIONS],
    reviewRatings: [...REVIEW_RATING_OPTIONS],
  };
}

/**
 * Cheapest membership expressed per month. Yearly prices divide by 12, and a
 * tier with no recognised duration is ignored — same rule the legacy app uses,
 * so the ordering matches.
 */
async function monthlyPrices(clubs: repo.ClubRow[]): Promise<Map<number, number>> {
  const [rows, models] = await Promise.all([
    repo.findTierPricing(),
    repo.findPricingModels(clubs.map((c) => c.id)),
  ]);
  const amount = (value: unknown) => {
    const n = Number(String(value ?? "").replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const perMonth = (price: unknown, duration: unknown) => {
    const n = amount(price);
    if (n === null) return null;
    const d = String(duration ?? "").trim().toLowerCase();
    if (["month", "monthly"].includes(d)) return n;
    if (["year", "yearly", "annual", "annually"].includes(d)) return n / 12;
    return null;
  };

  const lowest = new Map<number, number>();
  const record = (clubId: number, value: number | null) => {
    if (value === null) return;
    const current = lowest.get(clubId);
    if (current === undefined || value < current) lowest.set(clubId, value);
  };

  for (const row of rows) {
    const options = Array.isArray(row.billing_options) ? row.billing_options : [];
    const candidates = options.length
      ? options.map((o) => {
          const opt = o as Record<string, unknown>;
          return perMonth(opt.price, opt.priceDuration ?? opt.cadence);
        })
      : [perMonth(row.price, row.price_duration)];

    for (const value of candidates) record(row.club_id, value);
  }

  // Older clubs price membership as free text rather than tiers. The period is
  // inferred from the wording, and one-off fees are skipped.
  const fromText = (text: string): number | null => {
    const folded = text.toLowerCase();
    if (folded.includes("one-off") || folded.includes("one off")) return null;
    const yearly = ["year", "annual", "/ yr", "/yr"].some((t) => folded.includes(t));
    const monthly = ["month", "monthly", "/ mo", "/mo"].some((t) => folded.includes(t));
    if (!yearly && !monthly) return null;
    const n = amount(text);
    return n === null ? null : yearly ? n / 12 : n;
  };

  for (const club of clubs) record(club.id, fromText(club.price_membership ?? ""));
  for (const model of models) {
    if (!model.label.toLowerCase().includes("membership")) continue;
    record(model.club_id, fromText(model.price ?? ""));
  }

  return lowest;
}

/**
 * How closely a club matches the typed location: exact postcode 0, district 1,
 * area or town 2, no match 3. Ranks before distance in the relevance sort.
 */
function rankByLocation(clubs: repo.ClubRow[], location?: string): Map<number, number> {
  const ranks = new Map<number, number>();
  if (!location?.trim()) {
    for (const c of clubs) ranks.set(c.id, 3);
    return ranks;
  }
  const parts = parseLocation(location);
  const lower = location.trim().toLowerCase();
  const squash = (v: string | null | undefined) => (v ?? "").replace(/\s+/g, "").toUpperCase();

  for (const c of clubs) {
    if (parts.clean && squash(c.venue_postcode) === parts.clean) ranks.set(c.id, 0);
    else if (parts.district && squash(c.venue_postcode_district) === parts.district) ranks.set(c.id, 1);
    else if (parts.area && squash(c.venue_postcode_area) === parts.area) ranks.set(c.id, 2);
    else if (c.city && lower && c.city.toLowerCase().includes(lower)) ranks.set(c.id, 2);
    else ranks.set(c.id, 3);
  }
  return ranks;
}

function groupBy<T extends { club_id: number }>(items: T[]): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const item of items) {
    const bucket = map.get(item.club_id);
    if (bucket) bucket.push(item);
    else map.set(item.club_id, [item]);
  }
  return map;
}

function toSummary(
  row: repo.ClubRow,
  sessions: SessionRow[],
  games: GameRow[],
  distanceMiles?: number,
): ClubSummary {
  const first = sessions[0];
  return {
    slug: row.slug,
    name: row.name,
    city: row.city,
    neighbourhood: row.neighbourhood || undefined,
    postcodeArea: row.venue_postcode_district || undefined,
    summary: row.summary || undefined,
    schedule: sessions.map((s) => ({ day: s.day, time: s.time, label: s.label })),
    meetingLabel: first ? formatMeeting(first.day, first.time) : null,
    // Zero means no table booking offered, not "none free tonight".
    tablesAvailable: row.tables_available || null,
    memberCount: row.member_count || null,
    fromPrice: row.price_drop_in,
    formats: [],
    featuredGames: games.map((g) => g.games?.label ?? "").filter(Boolean),
    facilities: [],
    distanceMiles: distanceMiles ?? null,
    isFeatured: row.spotlight,
  };
}
