import "server-only";

import * as repo from "@/repositories/events.repository";
import { formatPrice } from "@/utils/format";
import { londonToday } from "./bookingCalendar.service";
import { gameKey } from "@/utils/similar-clubs";
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
      slug: string; name: string; city: string;
      latitude: number | null; longitude: number | null;
      club_images: { src: string; alt: string; position: number }[] | null;
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

  const end = row.end_date || row.start_date;

  return {
    id: row.id,
    legacyId: row.legacy_id,
    title: row.title,
    summary: row.summary,
    startDate: row.start_date,
    startTime: row.start_time,
    endDate: row.end_date,
    eventType: row.event_type,
    price: formatPrice(row.price ?? ""),
    roundCount: row.round_count,
    ticketsAvailable: row.tickets_available,
    venueName: row.venue_name,
    featuredGames: row.featured_games ?? [],
    // Compared as calendar dates, not instants: an event running today has not
    // ended, whatever the clock says.
    hasEnded: !end || end < londonToday(),
    club: { slug: club.slug, name: club.name, city: club.city },
    coordinates:
      club.latitude !== null && club.longitude !== null
        ? { latitude: club.latitude, longitude: club.longitude }
        : null,
    image,
    winner: first ? { name: first.member_name, army } : null,
  };
}

export async function listEvents(params: {
  /** "all" is for the hero, which describes the whole set rather than a tab. */
  when?: "upcoming" | "past" | "all";
  game?: string;
} = {}): Promise<EventListResult> {
  const all = (await repo.findEvents({ limit: 500 })).map(toSummary);

  const upcoming = all.filter((e) => !e.hasEnded);
  const past = all.filter((e) => e.hasEnded);

  upcoming.sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""));
  past.sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""));

  let events =
    params.when === "past" ? past
    : params.when === "all" ? [...upcoming, ...past]
    : upcoming;

  if (params.game) {
    const wanted = gameKey(params.game);
    events = events.filter((e) => e.featuredGames.some((g) => gameKey(g) === wanted));
  }

  // One filter per game, not per spelling. The longest label wins, since
  // "Warhammer 40,000" reads better as a filter than "warhammer 40k".
  const byKey = new Map<string, string>();
  for (const label of all.flatMap((e) => e.featuredGames)) {
    const key = gameKey(label);
    const held = byKey.get(key);
    if (!held || label.length > held.length) byKey.set(key, label);
  }
  const games = [...byKey.values()].sort((a, b) => a.localeCompare(b));

  return { events, upcomingCount: upcoming.length, pastCount: past.length, games };
}
