import type { CoachingSlot } from "@/types/clubExtras";

/**
 * Coaching sessions, as a club and its members sort through them.
 *
 * Each tab answers one question rather than belonging to a partition, and the
 * question that was missing is the one the client asked: which of these can
 * somebody book right now. A session carries two independent facts, the status
 * the club set and a date that goes by on its own, and the tabs only ever read
 * the first. So a club with a year of coaching behind it opened Open and found
 * seven sessions, six of them weeks past, which reads as a status going wrong.
 *
 * `active` is status open AND still to come, in the client's own words "live to
 * be booked". It replaced an `open` tab that meant the status alone: a session
 * that is open and over needs no tab of its own, because Past is already the
 * tab for it.
 *
 * `closed` and `cancelled` are the two things a club DID to a session. `past`
 * is the thing nobody did. Those three and `active` do not add up to `all` and
 * are not meant to: a session that was open and has happened is in All and in
 * Past and in neither of the club's two acts.
 *
 * `mine` and `topay` cut across every one of them, because they are about the
 * person reading rather than about the session. They only make sense to
 * somebody holding a place, so the calendar shows them only when there is one.
 *
 * Both screens are handed the same list. The club page used to ask for
 * sessions from today onwards and the console for all of them, so the two
 * disagreed about how much coaching a club had ever done and a member had no
 * way back to the session they had been on. Both carry the history now and
 * both open on `active`.
 */

export type SlotFilter =
  | "all" | "active" | "closed" | "cancelled" | "mine" | "topay" | "past";
export type SlotSort = "soonest" | "latest";

const fold = (value: string) => value.trim().toLowerCase();

/**
 * Has the day gone by?
 *
 * A London day in, never `new Date()`: a club night is a London day on both
 * sides of this app, and the browser's clock is the wrong one to ask. Without
 * a day nothing is past, which is what a screen that cannot say what today is
 * gets: the question goes unanswered rather than guessed.
 */
const isPast = (slot: CoachingSlot, today: string) =>
  Boolean(today) && slot.date < today;

export function countCoachingSlots(slots: CoachingSlot[], today = "") {
  return {
    all: slots.length,
    past: slots.filter((slot) => isPast(slot, today)).length,
    // What a member can book and what the club is actually running. With no
    // day in hand every open session counts, which is right: a caller that
    // passes none is handing over a list with nothing past in it.
    active: slots.filter((slot) => slot.status === "open" && !isPast(slot, today)).length,
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
  { query = "", filter = "all", sort = "soonest", today = "" }: {
    query?: string; filter?: SlotFilter; sort?: SlotSort; today?: string;
  },
): CoachingSlot[] {
  const needle = fold(query);

  const matches = (slot: CoachingSlot) => {
    if (filter === "all") return true;
    if (filter === "active") return slot.status === "open" && !isPast(slot, today);
    if (filter === "mine") return Boolean(slot.mine);
    if (filter === "topay") return Boolean(slot.mine && !slot.mine.paid);
    if (filter === "past") return isPast(slot, today);
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
