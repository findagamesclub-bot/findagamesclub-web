import "server-only";

import * as receipts from "@/repositories/receipts.repository";
import * as templates from "@/lib/email/templates";
import { deliver, siteUrl } from "./mail-recipient.service";
import { orderTotalLabel } from "@/utils/order-total";
import { nightLabel } from "@/utils/dates";
import { formatPrice } from "@/utils/format";

/**
 * Merchandise and coaching confirmations.
 *
 * Both are read back from the row rather than built from the form: the club's
 * tier discount and the points redemption are computed inside the definer
 * function, so the browser never knew the real total.
 *
 * Kept apart from clubExtras-writes so a mail failure can never fail the order.
 */

const money = (n: number) => `£${n.toFixed(2)}`;

export async function notifyOrdered(orderId: number) {
  try {
    const row = await receipts.findOrderReceipt(orderId);
    if (!row?.clubs) return;
    const club = row.clubs;
    const items = row.club_merchandise_order_items ?? [];

    await deliver(row.profile_id, (name) =>
      templates.merchandiseOrdered({
        name,
        clubName: club.name,
        reference: `Order #${row.id}`,
        lines: items.map((line) => ({
          label: line.quantity > 1 ? `${line.name} × ${line.quantity}` : line.name,
          // A club can leave an item unpriced, and £0.00 would read as free.
          value: orderTotalLabel({ total: line.line_total, lines: [{ price: line.price }] }, money),
        })),
        total: orderTotalLabel({ total: row.total, lines: items }, money),
        pointsSpent: row.loyalty_points_spent,
        url: `${siteUrl()}/account/orders`,
      }),
    );
  } catch (error) {
    console.error("order confirmation failed", { orderId, error });
  }
}

export async function notifyCoachingBooked(bookingId: number) {
  try {
    const row = await receipts.findCoachingReceipt(bookingId);
    const slot = row?.club_coaching_slots;
    if (!row || !slot?.clubs) return;
    const club = slot.clubs;

    const when = [
      nightLabel(slot.slot_date),
      [slot.start_time, slot.end_time].filter(Boolean).join(" to "),
    ].filter(Boolean).join(", ");

    await deliver(row.profile_id, (name) =>
      templates.coachingBooked({
        name,
        clubName: club.name,
        title: slot.title,
        when,
        coachingType: slot.coaching_type.replace(/-/g, " "),
        // "Ask the club" rather than £0.00: an unpriced slot is not a free one.
        price: formatPrice(slot.price) ?? "Ask the club",
        url: `${siteUrl()}/clubs/${club.slug}/coaching`,
      }),
    );
  } catch (error) {
    console.error("coaching confirmation failed", { bookingId, error });
  }
}
