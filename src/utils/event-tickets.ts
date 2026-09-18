/**
 * What a club may say about a ticket type.
 *
 * Split from `event-draft.ts` because the tickets are edited in their own
 * dialog and saved on their own: an event with a typo in its summary should
 * not stop somebody fixing a price, and a bad ticket row should not lose the
 * rest of the form.
 *
 * Legacy's two silent behaviours are both refusals here. It drops a duplicate
 * label without a word (`_normalise_event_ticket_types`, club_store.py:15481)
 * and turns a blank quantity into 0, which every reader treats as sold out
 * (15511). A club that typed two "Standard" rows, or left the box empty
 * meaning "as many as turn up", had no way to find out.
 */

/**
 * Legacy's own two values, not ours (`_normalise_ticket_audience`,
 * club_store.py:15500). It accepts "public", "open", "everyone" and several
 * more, and stores every one of them as "all". Every reader in this app
 * compares against "all", so writing anything else means a ticket open to
 * everybody is open to nobody.
 */
export const TICKET_AUDIENCES = ["all", "members"] as const;
export type TicketAudience = (typeof TICKET_AUDIENCES)[number];

export type TicketDraft = {
  id: number | null;
  label: string;
  price: string;
  /** Null is "no cap". Zero is a real answer: nobody can book this one. */
  quantityAvailable: number | null;
  audience: TicketAudience;
  minimumTierKey: string;
};

/** How many of this type are already spoken for, for the row's own label. */
export type TicketSold = { taken: number };

const fold = (value: string) => value.trim().toLowerCase();

export function ticketRefusal(
  rows: TicketDraft[], tierKeys: string[],
): string | null {
  if (!rows.length) return null;

  const seen = new Set<string>();
  for (const row of rows) {
    const label = row.label.trim();
    if (!label) return "Every ticket needs a name.";
    if (label.length > 60) return `"${label.slice(0, 20)}…" is too long for a ticket name.`;

    if (seen.has(fold(label))) {
      return `You have two tickets called "${label}". Give them different names.`;
    }
    seen.add(fold(label));

    if (row.quantityAvailable !== null) {
      if (!Number.isInteger(row.quantityAvailable) || row.quantityAvailable < 0) {
        return `How many ${label} tickets there are has to be a whole number.`;
      }
      if (row.quantityAvailable > 100000) {
        return `${label} has more tickets than any hall holds. Check the number.`;
      }
    }

    if (row.minimumTierKey && !tierKeys.includes(row.minimumTierKey)) {
      return `${label} is set to a membership tier your club no longer offers.`;
    }
    // A tier gate on a ticket anybody can buy does nothing, and reads on the
    // event page as a restriction that is not enforced.
    if (row.minimumTierKey && row.audience !== "members") {
      return `${label} is open to everybody, so a membership tier on it would do nothing.`;
    }
  }

  return null;
}

/** "12 of 40 sold", "12 sold", or nothing when none have gone. */
export function soldLabel(taken: number, quantityAvailable: number | null): string | null {
  if (!taken) return null;
  return quantityAvailable === null ? `${taken} sold` : `${taken} of ${quantityAvailable} sold`;
}

/**
 * Why this row cannot be removed.
 *
 * The same refusal the database raises (`TICKET_TYPE_SOLD`, 0090), said in the
 * browser so the club learns it before pressing the button rather than after.
 */
export function removeTicketRefusal(label: string, taken: number): string | null {
  if (!taken) return null;
  return `${taken} ${taken === 1 ? "person holds" : "people hold"} a ${label} ticket, `
    + "so it cannot be removed. Set how many are left to what has gone to close it.";
}

/**
 * What a sold type may still be changed to.
 *
 * Price, audience and tier are what somebody agreed to when they booked, so
 * they are frozen once one has gone. The quantity may only go up, or down to
 * exactly what is taken.
 */
export function lockedFieldRefusal(
  before: TicketDraft, after: TicketDraft, taken: number,
): string | null {
  if (!taken) return null;

  if (before.price.trim() !== after.price.trim()) {
    return `${before.label} has been sold, so its price cannot change. `
      + "Add a new ticket type instead.";
  }
  if (before.audience !== after.audience || before.minimumTierKey !== after.minimumTierKey) {
    return `${before.label} has been sold, so who it is for cannot change.`;
  }
  if (after.quantityAvailable !== null && after.quantityAvailable < taken) {
    return `${taken} ${before.label} ${taken === 1 ? "ticket has" : "tickets have"} gone, `
      + "so there cannot be fewer than that.";
  }
  return null;
}

/**
 * The event's own capacity, which legacy computes rather than storing
 * (club_store.py:14786). A club that caps nothing has no total to show.
 */
export function ticketsAvailable(rows: TicketDraft[]): number | null {
  if (!rows.length) return null;
  if (rows.some((row) => row.quantityAvailable === null)) return null;
  return rows.reduce((sum, row) => sum + (row.quantityAvailable ?? 0), 0);
}
