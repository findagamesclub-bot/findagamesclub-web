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

export function fromParam(from: string | string[] | undefined): string | null {
  const source = Array.isArray(from) ? from[0] : from;
  return source === "my-clubs" || source === "my-events" || source === "club-events"
    ? source
    : null;
}

export function backTarget(
  from: string | string[] | undefined,
  club: { slug: string; name: string },
): BackTarget {
  switch (fromParam(from)) {
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
