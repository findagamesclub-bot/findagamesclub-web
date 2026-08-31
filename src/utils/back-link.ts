/**
 * Where the back link on a club's own pages should point.
 *
 * Somebody arriving from their dashboard expects to go back to it, not to the
 * club's public page — landing somewhere they did not come from loses their
 * place in a list of four clubs. Carried in the URL rather than read from
 * history, so it still works on a refresh or a shared link.
 *
 * The sources are a fixed list on purpose. Taking a path from the query string
 * would mean any link into the app could point its own back button anywhere.
 */
export type BackTarget = { href: string; label: string };

/** Appended to links out of a dashboard so the return trip knows the way. */
export const FROM_MY_CLUBS = "?from=my-clubs";
export const FROM_MY_EVENTS = "?from=my-events";
export const FROM_CLUB_EVENTS = "?from=club-events";
export const FROM_EVENTS = "from=events";

export function fromParam(from: string | string[] | undefined): string | null {
  const source = Array.isArray(from) ? from[0] : from;
  return source === "my-clubs" || source === "my-events" || source === "club-events"
    || source === "events"
    ? source
    : null;
}

/**
 * Filters worth carrying back to the events directory.
 *
 * A fixed list, like the sources themselves. The path is always "/events"; only
 * these keys may be appended to it, so a crafted link cannot aim the back
 * button somewhere else or smuggle anything into the URL.
 */
const EVENT_FILTER_KEYS = [
  "when", "view", "q", "city", "format", "day", "eventType", "featuredGame",
  "facility", "withinMiles", "location", "dateFrom", "dateTo", "sort", "game", "month",
] as const;

/** Rebuilds the events search somebody left, so back does not lose their work. */
export function eventsSearch(query: Record<string, string | string[] | undefined>): string {
  const params = new URLSearchParams();
  for (const key of EVENT_FILTER_KEYS) {
    const raw = query[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value) params.set(key, value);
  }
  const search = params.toString();
  return search ? `?${search}` : "";
}

export function backTarget(
  from: string | string[] | undefined,
  club: { slug: string; name: string },
  /** The page's own search params, so an events trail keeps its filters. */
  query: Record<string, string | string[] | undefined> = {},
): BackTarget {
  switch (fromParam(from)) {
    case "events":
      return { href: `/events${eventsSearch(query)}`, label: "All events" };
    case "my-clubs":
      return { href: "/my-clubs", label: "My clubs" };
    case "my-events":
      return { href: "/my-events", label: "My events" };
    case "club-events":
      return { href: `/clubs/${club.slug}/events`, label: `${club.name} events` };
    default:
      return { href: `/clubs/${club.slug}`, label: club.name };
  }
}

/** Carries the trail one hop further, so a third page still knows the way home. */
export function carryFrom(from: string | string[] | undefined): string {
  const source = fromParam(from);
  return source ? `?from=${source}` : "";
}
