import { fold } from "./text";
import type { EventSummary } from "@/types/eventList";

/**
 * The event directory's filter rules, ported from legacy.
 *
 * Every matcher here mirrors one in club_store.py so the two apps agree about
 * what a filter means: `_matches_event_search` (12555), `_matches_event_day`
 * (12595), `_matches_event_type` (12604), `_matches_event_featured_game`
 * (12612), `_matches_event_facility` (12620) and `_matches_event_date_range`
 * (12635).
 *
 * Legacy compares exactly on tags and by substring on search. Kept, with one
 * departure: everything is folded first, so "Pokémon" and "pokemon" behave the
 * same here as they do in the club directory.
 */

export const EVENT_TIMINGS = ["upcoming", "past", "all"] as const;
export type EventTiming = (typeof EVENT_TIMINGS)[number];

export const EVENT_SORTS = ["date", "distance", "relevance"] as const;
export type EventSort = (typeof EVENT_SORTS)[number];

export const WITHIN_MILES = ["5", "10", "20", "50", "100"];

export type EventFilters = {
  q?: string;
  city?: string;
  format?: string;
  days?: string[];
  eventType?: string;
  featuredGame?: string;
  facility?: string;
  dateFrom?: string;
  dateTo?: string;
};

const same = (a: string | null | undefined, b: string) => fold(a ?? "") === fold(b);

/** Legacy searches the event AND its club's games and facilities. */
export function matchesSearch(event: EventSummary, terms: string[]): boolean {
  if (!terms.length) return true;
  const haystack = fold(
    [
      event.title,
      event.summary ?? "",
      event.club.name,
      event.club.city,
      ...event.featuredGames,
      ...event.eventTypes,
      ...event.formats,
      ...event.facilities,
      ...event.clubFormats,
    ].join(" "),
  );
  return terms.every((term) => haystack.includes(fold(term)));
}

export function matchesDay(event: EventSummary, days: string[]): boolean {
  if (!days.length) return true;
  return Boolean(event.weekday && days.some((d) => same(event.weekday, d)));
}

export function matchesTag(values: string[], wanted: string | undefined): boolean {
  if (!wanted) return true;
  return values.some((v) => same(v, wanted));
}

/** An undated event is excluded once a range is asked for — legacy returns False. */
export function matchesDateRange(event: EventSummary, from?: string, to?: string): boolean {
  if (!from && !to) return true;
  if (!event.startDate) return false;
  if (from && event.startDate < from) return false;
  if (to && event.startDate > to) return false;
  return true;
}

export function matchesAll(event: EventSummary, filters: EventFilters, terms: string[]): boolean {
  return (
    matchesSearch(event, terms) &&
    (!filters.city || same(event.club.city, filters.city)) &&
    (!filters.format || matchesTag(event.clubFormats.concat(event.formats), filters.format)) &&
    matchesDay(event, filters.days ?? []) &&
    matchesTag(event.eventTypes, filters.eventType) &&
    matchesTag(event.featuredGames, filters.featuredGame) &&
    matchesTag(event.facilities, filters.facility) &&
    matchesDateRange(event, filters.dateFrom, filters.dateTo)
  );
}

/** Sorted lists of every value present, so a filter never offers a dead end. */
export function optionsFrom(events: EventSummary[]) {
  const uniq = (values: string[]) => {
    const byFold = new Map<string, string>();
    for (const v of values) {
      const trimmed = v.trim();
      if (trimmed) byFold.set(fold(trimmed), trimmed);
    }
    return [...byFold.values()].sort((a, b) => a.localeCompare(b));
  };

  return {
    cities: uniq(events.map((e) => e.club.city)),
    eventTypes: uniq(events.flatMap((e) => e.eventTypes)),
    featuredGames: uniq(events.flatMap((e) => e.featuredGames)),
    facilities: uniq(events.flatMap((e) => e.facilities)),
    formats: uniq(events.flatMap((e) => e.clubFormats.concat(e.formats))),
    days: uniq(events.map((e) => e.weekday ?? "")),
  };
}

const DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

/** Weekday names sort as a week, not alphabetically. */
export function orderDays(days: string[]): string[] {
  return [...days].sort((a, b) => DAY_ORDER.indexOf(fold(a)) - DAY_ORDER.indexOf(fold(b)));
}
