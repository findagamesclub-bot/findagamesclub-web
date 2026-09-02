/**
 * Searching, grouping and ordering a door list.
 *
 * Pure, so the three questions a club asks of this list can be tested without
 * a browser: who is this person in front of me, how many of this ticket type
 * are coming, and what came in most recently.
 */

export type Attendee = {
  id: number;
  reference: string;
  fullName: string;
  email: string;
  total: number;
  currency: string;
  createdAt: string;
  tickets: number;
  summary: string;
  /** Distinct ticket type labels on this booking. */
  types: string[];
};

export const ATTENDEE_SORTS = ["name", "newest", "value"] as const;
export type AttendeeSort = (typeof ATTENDEE_SORTS)[number];

const fold = (value: string) => value.trim().toLowerCase();

/** Every ticket type on the list, with how many bookings include it. */
export function typeCounts(attendees: Attendee[]): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const a of attendees) {
    for (const label of a.types) counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function filterAttendees(
  attendees: Attendee[],
  params: { query?: string; type?: string; sort?: AttendeeSort },
): Attendee[] {
  const needle = fold(params.query ?? "");
  const type = params.type && params.type !== "all" ? params.type : null;

  const rows = attendees.filter((a) => {
    if (type && !a.types.includes(type)) return false;
    if (!needle) return true;
    // Name, email and reference: the three things somebody at the door has.
    return fold(a.fullName).includes(needle)
      || fold(a.email).includes(needle)
      || fold(a.reference).includes(needle);
  });

  const sort = params.sort ?? "name";
  return [...rows].sort((a, b) => {
    if (sort === "newest") return b.createdAt.localeCompare(a.createdAt);
    if (sort === "value") return b.total - a.total;
    // Name, then newest, so one person's several bookings keep a stable order
    // rather than shuffling every render.
    return a.fullName.localeCompare(b.fullName) || b.createdAt.localeCompare(a.createdAt);
  });
}
