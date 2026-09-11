import type { CoachingSlot } from "@/types/clubExtras";

/**
 * Coaching sessions, as a club sorts through its own.
 *
 * Every session is in exactly one of the three status groups, so those tabs add
 * up to All and nothing hides. "Full" is deliberately not a group: a full
 * session is still open, and the club's next move on it is to close it or put
 * another one up, which is a different question from the one these tabs ask.
 *
 * `mine` and `topay` cut across the statuses rather than joining them, because
 * they are about the person reading: which of these have I taken a place on,
 * and which have I not paid for. They only make sense to somebody holding one,
 * so the calendar shows them only when there is something in them.
 */

export type SlotFilter = "all" | "open" | "closed" | "cancelled" | "mine" | "topay";
export type SlotSort = "soonest" | "latest";

const fold = (value: string) => value.trim().toLowerCase();

export function countCoachingSlots(slots: CoachingSlot[]) {
  return {
    all: slots.length,
    open: slots.filter((slot) => slot.status === "open").length,
    closed: slots.filter((slot) => slot.status === "closed").length,
    cancelled: slots.filter((slot) => slot.status === "cancelled").length,
    // The viewer's own places. Nobody sees anybody else's, so these two are
    // about the person reading rather than about the club.
    mine: slots.filter((slot) => slot.mine).length,
    topay: slots.filter((slot) => slot.mine && !slot.mine.paid).length,
  };
}

export function filterCoachingSlots(
  slots: CoachingSlot[],
  { query = "", filter = "all", sort = "soonest" }: {
    query?: string; filter?: SlotFilter; sort?: SlotSort;
  },
): CoachingSlot[] {
  const needle = fold(query);

  const matches = (slot: CoachingSlot) => {
    if (filter === "all") return true;
    if (filter === "mine") return Boolean(slot.mine);
    if (filter === "topay") return Boolean(slot.mine && !slot.mine.paid);
    return slot.status === filter;
  };

  const kept = slots.filter((slot) => matches(slot)
    // The title and what it says, because a club searching for "beginner" is
    // as likely to have written it in the description as in the name.
    && (!needle || fold(`${slot.title} ${slot.description ?? ""}`).includes(needle)));

  return [...kept].sort((a, b) => {
    const order = a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime);
    return sort === "latest" ? -order : order;
  });
}
