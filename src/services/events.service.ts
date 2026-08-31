import "server-only";

import * as repo from "@/repositories/events.repository";
import * as clubsRepo from "@/repositories/clubs.repository";
import { formatPrice } from "@/utils/format";
import { amountOf } from "@/utils/cart-pricing";
import { hasEnded, toEventSummary } from "@/utils/event-summary";
import { londonNow } from "@/utils/dates";
import type { ClubEventSummary } from "@/types/clubDetail";
import { findOrigin } from "./location.service";
import { gameKey } from "@/utils/similar-clubs";
import { haversineMiles } from "@/utils/geo";
import { splitFacets } from "@/utils/facets";
import { fold } from "@/utils/text";
import {
  matchesAll, optionsFrom, orderDays,
  type EventFilters, type EventSort, type EventTiming,
} from "@/utils/event-filters";
import type { EventListResult, EventSummary } from "@/types/eventList";

/**
 * Events across the whole directory.
 *
 * Ordered by how soon they are when looking forward, and how recent when
 * looking back — a past list starting with the oldest would open on something
 * from last year.
 */

type Row = Awaited<ReturnType<typeof repo.findEvents>>[number];

function toSummary(row: Row): EventSummary {
  const club = (row as unknown as {
    clubs: {
      slug: string; name: string; city: string; logo_url: string | null;
      latitude: number | null; longitude: number | null;
      club_images: { src: string; alt: string; position: number }[] | null;
      club_formats: { formats: { label: string } | null }[] | null;
    };
  }).clubs;

  const image = [...(club.club_images ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((i) => ({ src: i.src, alt: i.alt }))[0] ?? null;

  const results = (row as unknown as {
    club_event_results: { rank: number | null; member_name: string; army: unknown }[] | null;
  }).club_event_results ?? [];

  const first = [...results].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))[0];
  const army = first?.army && typeof first.army === "object"
    ? ((first.army as Record<string, unknown>).factionLabel as string) ?? null
    : null;

  // "From £24", not "£24": an event can sell four ticket types and the club's
  // own price field only ever holds one figure. The cheapest is the honest one.
  const ticketPrices = ((row as unknown as {
    club_event_ticket_types: { price: string | null }[] | null;
  }).club_event_ticket_types ?? [])
    .map((t) => ({ label: formatPrice(t.price), amount: amountOf(t.price) }))
    .filter((t) => t.label && t.amount > 0)
    .sort((a, b) => a.amount - b.amount);

  // Legacy filters the day from the event's own start date, not the club's
  // meeting nights — a Saturday tournament at a Thursday club is a Saturday.
  const weekday = row.start_date
    ? new Date(row.start_date).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" })
    : null;

  return {
    id: row.id,
    legacyId: row.legacy_id,
    title: row.title,
    summary: row.summary,
    startDate: row.start_date,
    startTime: row.start_time,
    endDate: row.end_date,
    endTime: row.end_time,
    eventType: row.event_type,
    price: formatPrice(row.price ?? ""),
    fromPrice: ticketPrices[0]?.label ?? formatPrice(row.price ?? ""),
    roundCount: row.round_count,
    ticketsAvailable: row.tickets_available,
    venueName: row.venue_name,
    venue: {
      name: row.venue_name,
      address: row.venue_address,
      postcode: row.venue_postcode,
    },
    featuredGames: row.featured_games ?? [],
    // event_type is the first of event_types in legacy, kept for the card.
    eventTypes: (row.event_types ?? []).length
      ? row.event_types ?? []
      : row.event_type ? [row.event_type] : [],
    formats: row.formats ?? [],
    facilities: row.facilities ?? [],
    weekday,
    hasEnded: hasEnded(row.end_date, row.start_date, row.end_time),
    club: { slug: club.slug, name: club.name, city: club.city, logoUrl: club.logo_url },
    coordinates:
      club.latitude !== null && club.longitude !== null
        ? { latitude: club.latitude, longitude: club.longitude }
        : null,
    distanceMiles: null,
    clubFormats: (club.club_formats ?? []).map((f) => f.formats?.label ?? "").filter(Boolean),
    image,
    winner: first ? { name: first.member_name, army } : null,
  };
}

export type EventListFilters = EventFilters & {
  /** "all" is for the hero, which describes the whole set rather than a tab. */
  when?: EventTiming;
  /** Kept as its own param: the chip strip predates the filter bar. */
  game?: string;
  location?: string;
  withinMiles?: string;
  sort?: EventSort;
};

export async function listEvents(params: EventListFilters = {}): Promise<EventListResult> {
  const all = (await repo.findEvents({ limit: 500 })).map(toSummary);

  const upcoming = all.filter((e) => !e.hasEnded);
  const past = all.filter((e) => e.hasEnded);

  // Options come from the whole set, not the filtered one, so choosing a city
  // does not empty the game list and strand somebody with no way back.
  const options = { ...optionsFrom(all), days: orderDays(optionsFrom(all).days) };

  let events =
    params.when === "past" ? past
    : params.when === "all" ? [...upcoming, ...past]
    : upcoming;

  const terms = splitFacets(params.q ?? "").map(fold).filter(Boolean);
  events = events.filter((e) => matchesAll(e, params, terms));

  if (params.game) {
    const wanted = gameKey(params.game);
    events = events.filter((e) => e.featuredGames.some((g) => gameKey(g) === wanted));
  }

  const wantedPlace = (params.location ?? "").trim();
  const locations = wantedPlace ? await clubsRepo.findClubLocations() : [];
  const origin = wantedPlace ? await findOrigin(wantedPlace, locations) : null;

  // Same rule as the club directory: a place we cannot place returns nothing
  // and says so, rather than quietly listing events three counties away.
  if (wantedPlace && !origin) {
    return {
      events: [], upcomingCount: upcoming.length, pastCount: past.length,
      games: gameLabels(all), options, origin: null, locationUnresolved: true,
    };
  }

  if (origin) {
    events = events.map((e) => ({
      ...e,
      distanceMiles: e.coordinates
        ? haversineMiles(origin.latitude, origin.longitude,
                         e.coordinates.latitude, e.coordinates.longitude)
        : null,
    }));
    if (params.withinMiles) {
      const limit = Number(params.withinMiles);
      events = events.filter((e) => e.distanceMiles !== null && e.distanceMiles <= limit);
    }
  }

  // Sorting by distance with nothing to measure from is meaningless; legacy
  // falls back rather than erroring, so match it.
  const sort: EventSort =
    params.sort === "distance" && !origin ? "date" : params.sort ?? "date";

  events = sortEvents(events, sort, params.when === "past");

  return {
    events,
    upcomingCount: upcoming.length,
    pastCount: past.length,
    games: gameLabels(all),
    options,
    origin: origin ? { label: origin.label } : null,
    locationUnresolved: false,
  };
}

/**
 * One filter per game, not per spelling. The longest label wins, since
 * "Warhammer 40,000" reads better as a filter than "warhammer 40k".
 */
function gameLabels(events: EventSummary[]): string[] {
  const byKey = new Map<string, string>();
  for (const label of events.flatMap((e) => e.featuredGames)) {
    const key = gameKey(label);
    const held = byKey.get(key);
    if (!held || label.length > held.length) byKey.set(key, label);
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}

function sortEvents(events: EventSummary[], sort: EventSort, past: boolean): EventSummary[] {
  const byDate = (a: EventSummary, b: EventSummary) =>
    (a.startDate ?? "").localeCompare(b.startDate ?? "") ||
    (a.startTime ?? "").localeCompare(b.startTime ?? "");

  const sorted = [...events];
  if (sort === "distance") {
    sorted.sort((a, b) => (a.distanceMiles ?? Infinity) - (b.distanceMiles ?? Infinity) || byDate(a, b));
    return sorted;
  }
  // Relevance has no score of its own here, so it means "soonest" — the same
  // thing legacy falls back to once its club ranking has nothing to rank on.
  sorted.sort(byDate);
  // A past list starting with the oldest would open on something from years ago.
  return past ? sorted.reverse() : sorted;
}

/** How many past events fill one page of the club's events page. */
export const CLUB_EVENTS_PAGE = 12;

/**
 * One page of a club's own events.
 *
 * Past events page; upcoming ones do not, because a club with forty nights
 * already announced wants them all on one screen and nobody has that many.
 */
export async function getClubEventsPage(
  clubId: number,
  params: { past: boolean; page: number; size?: number },
): Promise<{ events: ClubEventSummary[]; total: number }> {
  const size = params.size ?? (params.past ? CLUB_EVENTS_PAGE : 200);
  const from = (Math.max(1, params.page) - 1) * size;
  const { rows, total } = await repo.findClubEventsPage(clubId, {
    past: params.past,
    today: londonNow().date,
    from,
    to: from + size - 1,
  });
  return { events: rows.map(toEventSummary), total };
}
