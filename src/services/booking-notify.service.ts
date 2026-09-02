import "server-only";

import * as receipts from "@/repositories/receipts.repository";
import * as templates from "@/lib/email/templates";
import { deliver, siteUrl } from "./mail-recipient.service";
import * as memberships from "@/repositories/memberships.repository";
import { nightLabel } from "@/utils/dates";
import { formatPrice } from "@/utils/format";

/**
 * Table booking emails.
 *
 * Legacy sends none at all — it writes an in-app message from a synthetic
 * "{Club} admin" sender that nobody reads (club_store.py:16468). A table is a
 * commitment on a date, at a price, so it belongs in an inbox next to the
 * event tickets that already land there.
 *
 * Kept apart from bookings.service so a mail failure can never fail the
 * booking that triggered it. Every function swallows its own errors.
 */

const money = (n: number, currency: string) =>
  formatPrice(`${currency} ${n.toFixed(2)}`) ?? `${n.toFixed(2)}`;

export async function notifyBooked(bookingId: number) {
  try {
    const row = await receipts.findBookingReceipt(bookingId);
    if (!row?.clubs) return;
    const club = row.clubs;

    await deliver(row.booked_by, (name) =>
      templates.tableBooked({
        name,
        clubName: club.name,
        night: nightLabel(row.session_date),
        time: row.session_time ?? "",
        gameTitle: row.game_title,
        tableIndex: row.table_index,
        price: money(row.total_price, row.price_currency),
        pointsSpent: row.loyalty_points_spent,
        opponentName: row.opponent_name,
        url: `${siteUrl()}/clubs/${club.slug}/bookings`,
      }),
    );
  } catch (error) {
    console.error("booking confirmation failed", { bookingId, error });
  }
}

/**
 * Told to whoever holds the table, which is not always whoever cancelled it:
 * the club can call a game off, and the member finds out here.
 */
export async function notifyCancelled(bookingId: number) {
  try {
    const row = await receipts.findBookingReceipt(bookingId);
    if (!row?.clubs) return;
    const club = row.clubs;

    await deliver(row.booked_by, (name) =>
      templates.tableCancelled({
        name,
        clubName: club.name,
        night: nightLabel(row.session_date),
        url: `${siteUrl()}/clubs/${club.slug}/bookings`,
      }),
    );
  } catch (error) {
    console.error("cancellation email failed", { bookingId, error });
  }
}

export async function notifyPromoted(params: {
  profileId: string;
  clubName: string;
  clubSlug: string;
  sessionDate: string;
  sessionTime: string;
  gameTitle: string;
  price?: string | null;
}) {
  await deliver(params.profileId, (name) =>
    templates.tablePromoted({
      name,
      clubName: params.clubName,
      night: nightLabel(params.sessionDate),
      time: params.sessionTime,
      gameTitle: params.gameTitle,
      price: formatPrice(params.price ?? ""),
      url: `${siteUrl()}/clubs/${params.clubSlug}/bookings`,
    }),
  );
}

/**
 * The poster, when somebody takes up their advert.
 *
 * Same reasoning as notifyPromoted: accept_looking_for_game books the table in
 * the POSTER's name, so they are committed to a night and a price at a moment
 * they were not looking. The bell (0052) tells them too; this is the half that
 * reaches somebody who is not on the site.
 */
export async function notifyGameFound(bookingId: number, opponentName: string) {
  try {
    const row = await receipts.findBookingReceipt(bookingId);
    if (!row?.clubs) return;
    const club = row.clubs;

    await deliver(row.booked_by, (name) =>
      templates.gameFound({
        name,
        clubName: club.name,
        opponentName: opponentName.trim() || "Another member",
        gameTitle: row.game_title,
        night: nightLabel(row.session_date),
        time: row.session_time ?? "",
        price: money(row.total_price, row.price_currency),
        url: `${siteUrl()}/clubs/${club.slug}/bookings`,
      }),
    );
  } catch (error) {
    console.error("game found notification failed", { bookingId, error });
  }
}

/**
 * The club, when a member puts an advert up.
 *
 * Goes to the owner's account address rather than anything on the post, and
 * never to an owner advertising at their own club: nobody is told about their
 * own doing, the same rule the trigger applies.
 */
export async function notifyClubOfLookingForGame(params: {
  clubId: number;
  clubSlug: string;
  clubName: string;
  posterId: string;
  memberName: string;
  gameTitle: string;
  sessionDate: string;
  sessionTime: string;
  notes?: string | null;
}) {
  try {
    const club = await memberships.findClubBasics(params.clubId);
    if (!club?.owner_id || club.owner_id === params.posterId) return;

    await deliver(club.owner_id, () =>
      templates.lookingForGameForOwner({
        clubName: params.clubName,
        memberName: params.memberName.trim() || "A member",
        gameTitle: params.gameTitle,
        night: nightLabel(params.sessionDate),
        time: params.sessionTime,
        notes: params.notes,
        url: `${siteUrl()}/clubs/${params.clubSlug}/bookings`,
      }),
    );
  } catch (error) {
    console.error("looking-for-game notification failed", { clubId: params.clubId, error });
  }
}
