import "server-only";

import * as receipts from "@/repositories/receipts.repository";
import * as templates from "@/lib/email/templates";
import { deliver, siteUrl } from "./mail-recipient.service";
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
