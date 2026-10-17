/**
 * A club's own featured slots, split into the three questions they answer.
 *
 * The client asked for "upcoming featured bookings, as well as current live
 * bookings ... and do not see past bookings", which is one list read three
 * ways rather than three reads: a slot is past, live or to come according to
 * today, and that is a reading of two dates the page already has.
 *
 * Dates are London days on both sides (`london_day` in SQL, `londonNow().date`
 * here) and ISO days sort as text, so the comparison is a plain string one.
 * Never `new Date()`, which reads the server's own zone and puts a slot's last
 * evening in the wrong day.
 */
export type SlotDates = { startsOn: string; endsOn: string };

export type SlotWindow = "live" | "upcoming" | "past";

export function slotWindow(slot: SlotDates, today: string): SlotWindow {
  if (slot.endsOn < today) return "past";
  if (slot.startsOn > today) return "upcoming";
  return "live";
}

export function splitSlots<T extends SlotDates>(slots: T[], today: string): {
  live: T[]; upcoming: T[]; past: T[];
} {
  const live: T[] = [];
  const upcoming: T[] = [];
  const past: T[] = [];

  // Sorted here rather than trusted from the caller, so the three lists read
  // the same way whichever order the rows arrived in.
  for (const slot of [...slots].sort((a, b) => a.startsOn.localeCompare(b.startsOn))) {
    const where = slotWindow(slot, today);
    (where === "live" ? live : where === "upcoming" ? upcoming : past).push(slot);
  }

  // The ones to come read soonest first, because the next one is the one being
  // waited on. Finished ones read newest first, because "what did we last
  // have" is the question somebody opens that group for.
  past.reverse();
  return { live, upcoming, past };
}

/**
 * How many open asks a club may hold at once.
 *
 * 0204 is the authority and raises `TOO_MANY_ASKS` at the same number; this
 * copy only decides whether the form is offered, so the screen does not invite
 * a sixth ask it knows will be refused. The two have to move together.
 */
export const MAX_FEATURED_ASKS = 5;
