import "server-only";

import * as repo from "@/repositories/eventEditor.repository";
import * as types from "@/repositories/eventTicketTypes.repository";
import { setTicketsAvailable } from "@/repositories/eventWrites.repository";
import { refusalOf, type Result } from "./eventEditor.service";
import {
  lockedFieldRefusal, removeTicketRefusal, ticketRefusal, ticketsAvailable,
  type TicketDraft,
} from "@/utils/event-tickets";

/**
 * What an event sells.
 *
 * Its own file rather than part of the editor, because it is the one part of
 * an event that people have already paid for: a sold ticket type cannot be
 * deleted, repriced or moved to a different audience, and most of what is
 * below is working out which of those is being attempted.
 */

/**
 * The whole ticket table at once.
 *
 * Rows are compared against what is there rather than replaced, because a
 * ticket type somebody holds cannot be deleted and re-inserted: the booking
 * points at its id.
 */
export async function saveTicketTypes(
  clubId: number, eventId: number, rows: TicketDraft[], tierKeys: string[],
): Promise<Result> {
  const refusal = ticketRefusal(rows, tierKeys);
  if (refusal) return { ok: false, error: refusal };

  const event = await repo.findEditableEvent(clubId, eventId);
  if (!event) return { ok: false, error: "That event is not here any more." };

  const before = new Map(event.ticketTypes.map((row) => [row.id, row]));
  const keeping = new Set(rows.map((row) => row.id).filter((id): id is number => id !== null));

  // A row somebody holds cannot go, so say so before anything is written.
  for (const [id, row] of before) {
    if (keeping.has(id)) continue;
    const stop = removeTicketRefusal(row.label, row.taken);
    if (stop) return { ok: false, error: stop };
  }

  // And a sold row cannot move underneath the people who bought it.
  for (const row of rows) {
    const was = row.id === null ? null : before.get(row.id);
    if (!was) continue;
    const stop = lockedFieldRefusal(
      { id: was.id, label: was.label, price: was.price,
        quantityAvailable: was.quantityAvailable, audience: was.audience,
        minimumTierKey: was.minimumTierKey },
      row, was.taken);
    if (stop) return { ok: false, error: stop };
  }

  const fields = (row: TicketDraft, position: number) => {
    const was = row.id === null ? null : before.get(row.id);
    // The imported events carry labels a club wrote by hand ("One place left
    // on the day"), and overwriting one with "Open to all" because somebody
    // fixed a typo in the name would be losing what they said.
    const keepLabel = was && was.audience === row.audience && was.audienceLabel;

    return {
      label: row.label.trim(),
      price: row.price.trim(),
      quantity_available: row.quantityAvailable,
      audience: row.audience,
      audience_label: keepLabel
        || (row.audience === "members" ? "Members only" : "Open to all"),
      minimum_tier_key: row.minimumTierKey || null,
      position,
    };
  };

  try {
    // Removals first, so closing "Standard" and opening a fresh "Standard" in
    // one save cannot collide on the label.
    await types.deleteTicketTypes(eventId, [...before.keys()].filter((id) => !keeping.has(id)));

    for (const [index, row] of rows.entries()) {
      if (row.id !== null) await types.updateTicketType(eventId, row.id, fields(row, index));
    }
    await types.insertTicketTypes(eventId,
      rows.map((row, index) => ({ row, index }))
        .filter((entry) => entry.row.id === null)
        .map((entry) => fields(entry.row, entry.index)));

    // Every card in the app reads that column, so it moves with the tickets.
    await setTicketsAvailable(clubId, eventId, ticketsAvailable(rows));

    return { ok: true, notice: "Saved." };
  } catch (error) {
    return { ok: false, error: refusalOf(error, "That did not save. Try again.") };
  }
}

