import "server-only";

import * as repo from "@/repositories/bookings.repository";
import * as notify from "./booking-notify.service";
import * as lfgRepo from "@/repositories/lookingForGames.repository";

/**
 * Creating and cancelling a table booking.
 *
 * Validation deliberately reproduces legacy's order and wording
 * (club_store.py:3224-3279), because the copy a member reads is written against
 * it. The database enforces the same rules again — capacity, weekday, past
 * dates, the one-booking-per-date clash — so a race or a crafted request lands
 * on a constraint rather than a wrong booking.
 */

/** A seat race. Two members took the same table index; the loser retries. */
const SEAT_TAKEN = "23505";
const MAX_ATTEMPTS = 4;

type Result =
  | { ok: true; bookingId: number; tableIndex: number; price: string; postWithdrawn: boolean }
  | { ok: false; error: string };

/** Postgres exceptions from the guard trigger, in the member's words. */
function messageFor(raw: string): string {
  if (raw.includes("BOOKING_NO_TABLES")) return "No tables are left for that session.";
  if (raw.includes("BOOKING_SESSION_PAST")) return "Bookings must be for today or a future club session.";
  if (raw.includes("BOOKING_SESSION_WRONG_DAY")) return "That booking session is not available for this club.";
  if (raw.includes("BOOKING_SESSION_NOT_FOUND")) return "That booking session is not available for this club.";
  if (raw.includes("BOOKING_CLOSED")) return "This club is not accepting bookings yet.";
  // Raised by club_bookings_price when a points request cannot be honoured.
  if (raw.includes("NOT_ENOUGH_POINTS")) return "You do not have that many points.";
  if (raw.includes("OVER_REDEMPTION_CAP")) {
    return "Points cannot cover that much of this booking. Lower the number and try again.";
  }
  if (raw.includes("NO_REDEMPTION")) return "This club does not take points off table bookings.";
  if (raw.includes("club_booking_participants_one_per_date")) return "You already have a booking for that club date.";
  if (raw.includes("NOT_PERMITTED")) return "Only approved club members can book tables for this club.";

  // Anything unrecognised is a bug, not a refusal we planned for. It reached a
  // member as "try again", and trying again did the same thing forever: an RLS
  // policy left over from Stage 3 hid behind this line for a whole round trip.
  console.error("[bookings] unexpected refusal:", raw);
  return "Could not book that table. Try again.";
}

export async function createBooking(params: {
  clubId: number;
  clubSessionId: number;
  sessionDate: string;
  gameTitle: string;
  notes?: string;
  opponentProfileId?: string | null;
  opponentName?: string;
  /** Points the member wants to put towards it. The trigger has final say. */
  redeemPoints?: number;
}): Promise<Result> {
  const gameTitle = params.gameTitle.trim();
  if (!gameTitle) return { ok: false, error: "Game title is required." };
  if (!params.clubSessionId || !params.sessionDate) {
    return { ok: false, error: "Choose an available session to book." };
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const row = await repo.insertBooking({
        club_id: params.clubId,
        club_session_id: params.clubSessionId,
        session_date: params.sessionDate,
        game_title: gameTitle.slice(0, 120),
        notes: (params.notes ?? "").trim().slice(0, 500),
        opponent_profile_id: params.opponentProfileId || null,
        opponent_name: (params.opponentName ?? "").trim().slice(0, 120),
        // A request, not an instruction. club_bookings_price() checks it
        // against the balance and the tier's cap and writes what it allows.
        // `loyalty_points_spent` arrived with 0043 and the generated types
        // predate it. Delete the cast once they are regenerated.
        ...({ loyalty_points_spent: Math.max(0, Math.floor(params.redeemPoints ?? 0)) } as object),
      });

      // You have your game now, so the advert comes down. Left up it could
      // never be accepted — taking up a post creates a booking in the poster's
      // name, and they already have one that night.
      let postWithdrawn = false;
      try {
        const cancelled = await lfgRepo.withdrawOwnPostsFor(
          params.clubId, row.booked_by, params.sessionDate);
        postWithdrawn = cancelled.length > 0;
      } catch (error) {
        console.error("could not withdraw a looking-for-game post", { error });
      }

      // After the post comes down, so a mail failure cannot leave an advert up.
      await notify.notifyBooked(row.id);

      return {
        ok: true,
        bookingId: row.id,
        tableIndex: row.table_index,
        price: `${row.price_currency} ${row.total_price}`,
        postWithdrawn,
      };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      const raw = err.message ?? "";

      // The seat index is chosen by a read that is racy on purpose. Losing it
      // means somebody took that table a moment ago, not that the member did
      // anything wrong, so pick the next free one and go again.
      if (err.code === SEAT_TAKEN && raw.includes("club_bookings_seat_uniq") && attempt < MAX_ATTEMPTS) {
        continue;
      }
      return { ok: false, error: messageFor(raw) };
    }
  }

  return { ok: false, error: "That session filled up while you were booking. Try another night." };
}

export async function cancelBooking(
  bookingId: number,
  reason?: string,
  club?: { name: string; slug: string },
) {
  try {
    // Cancelling frees a table, and a database trigger promotes the next person
    // off the waiting list. Deliberately not done here: a member cancelling
    // must not be able to fail because somebody else's promotion failed.
    const row = await repo.cancelBooking(bookingId, (reason ?? "").trim().slice(0, 300) || null);

    // The promotion already happened, inside the trigger, so nothing in this
    // request knows about it. Look for it and tell whoever now has a table —
    // they are committed to it without ever having asked.
    // Whoever holds the table, which is not always whoever cancelled it: a club
    // can call a game off and the member finds out by email.
    await notify.notifyCancelled(bookingId);

    if (club) await announcePromotion(row.club_session_id, row.session_date, club);

    return { ok: true as const };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    if (raw.includes("NOT_PERMITTED")) {
      return {
        ok: false as const,
        error: "That booking can no longer be cancelled. Club nights cannot be cancelled on the day.",
      };
    }
    // An unrecognised database error reaching a member as "try again" is a
    // dead end — trying again does the same thing. Keep the real one.
    console.error("booking cancellation failed", { bookingId, error });
    return { ok: false as const, error: "Could not cancel that booking. Try again." };
  }
}

/** Best effort, after the fact. Never allowed to fail a cancellation. */
async function announcePromotion(
  clubSessionId: number,
  sessionDate: string,
  club: { name: string; slug: string },
) {
  try {
    const promoted = await repo.findJustPromoted(clubSessionId, sessionDate);
    for (const entry of promoted) {
      // The session time and price live on the booking the trigger created, not
      // on the queue entry, so the email says when to turn up and what it costs.
      const booking = (entry as unknown as {
        club_bookings: { session_time: string; total_price: number; price_currency: string } | null;
      }).club_bookings;

      await notify.notifyPromoted({
        profileId: entry.requested_by,
        clubName: club.name,
        clubSlug: club.slug,
        sessionDate: entry.session_date,
        sessionTime: booking?.session_time ?? "",
        gameTitle: entry.game_title,
        price: booking ? `${booking.price_currency} ${booking.total_price}` : null,
      });
    }
  } catch (error) {
    console.error("could not announce a waitlist promotion", { clubSessionId, sessionDate, error });
  }
}
