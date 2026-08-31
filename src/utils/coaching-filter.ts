import type { MyCoaching } from "@/services/myActivity.service";

export type CoachingFilter = "all" | "upcoming" | "unpaid" | "past";
export type CoachingSort = "soonest" | "club" | "recent";

const fold = (value: string) => value.trim().toLowerCase();

const inGroup = (session: MyCoaching, filter: CoachingFilter) => {
  if (filter === "all") return true;
  if (filter === "upcoming") return !session.past && !session.cancelled;
  if (filter === "unpaid") return !session.past && !session.cancelled && !session.paid;
  return session.past || session.cancelled;
};

/** Search, filter and sort the member's coaching in one pass. */
export function filterCoaching(
  sessions: MyCoaching[],
  { query = "", filter = "all", sort = "soonest" }: {
    query?: string;
    filter?: CoachingFilter;
    sort?: CoachingSort;
  },
): MyCoaching[] {
  const needle = fold(query);

  const kept = sessions.filter((session) => {
    if (!inGroup(session, filter)) return false;
    if (!needle) return true;
    return (
      fold(session.title).includes(needle) ||
      fold(session.club.name).includes(needle) ||
      fold(session.kind).includes(needle)
    );
  });

  return kept.sort((a, b) => {
    if (sort === "club") {
      return a.club.name.localeCompare(b.club.name) || a.date.localeCompare(b.date);
    }
    if (sort === "recent") return b.date.localeCompare(a.date);
    // Soonest: what is still to come, in order, then history newest first.
    // A cancelled session is history even if its date has not arrived — it is
    // not something the member is going to.
    const behind = (s: MyCoaching) => Number(s.past || s.cancelled);
    if (behind(a) !== behind(b)) return behind(a) - behind(b);
    return behind(a) ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date);
  });
}

/** Sessions still to come that have not been paid for. */
/**
 * Sessions still to come. The sidebar badge and the "Coming up" tab ask the
 * same question, and each used to answer it with its own copy of the rule.
 */
export function countUpcoming(sessions: MyCoaching[]): number {
  return sessions.filter((session) => !session.past && !session.cancelled).length;
}

export function countUnpaid(sessions: MyCoaching[]): number {
  return sessions.filter((s) => !s.past && !s.cancelled && !s.paid).length;
}
