import type { StatusTone } from "./moderation-status";

/**
 * Money going back, in one vocabulary and one colour.
 *
 * The client, item 14: *"when showing the status of Refunded on coaching or
 * events or merchandise or table bookings, please show the tag in red in the
 * same style as above green and brown tags."*
 *
 * It was none of those things. Coaching drew a green chip, which says "settled,
 * nothing to worry about" about money leaving the club. Events drew grey
 * caption text joined to the cancellation reason with a middle dot, so it was
 * not a tag at all. Merchandise and table bookings had no refund to show.
 *
 * Worse, `RefundStatus` was declared twice with the same three values, once in
 * `door-list.ts` and once in `coaching-bookings-filter.ts`. Two copies of one
 * vocabulary match on the day they are written and drift the first time either
 * is touched, which is the whole of rule 11. Both now read this.
 */

export const REFUND_STATUSES = ["not_due", "due", "refunded"] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export const REFUND_LABELS: Record<RefundStatus, string> = {
  not_due: "Not due",
  due: "Refund due",
  refunded: "Refunded",
};

/**
 * What a refund status looks like, or nothing at all.
 *
 * `not_due` draws no tag on purpose: the overwhelming majority of rows are
 * owed nothing, and a "Not due" chip on every one of them is noise that makes
 * the two that matter harder to find.
 *
 * Red for `refunded`, which is the client's call and the right one. Green
 * means "this is settled and good"; a refund is money the club has given back,
 * and on a page whose job is counting takings it should read as a subtraction.
 * Brass stays on `due`, because that is work waiting rather than work done.
 */
export function refundTag(
  status: RefundStatus,
): { label: string; tone: StatusTone } | null {
  if (status === "not_due") return null;
  return {
    label: REFUND_LABELS[status],
    tone: status === "refunded" ? "refunded" : "waiting",
  };
}
