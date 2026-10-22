/**
 * Everything a club has paid us, in one list.
 *
 * The client's words: *"Payments recorded look to be empty for Didcot, should
 * this not show featured booking payments also? Should this show regular
 * listing billing payments plus featured listing payments?"*
 *
 * Yes, and the panel read one of the two. A club that has never been charged
 * for its listing and has paid for three homepage weeks was told "Nothing
 * recorded yet", which is the screen contradicting the slot list directly
 * above it. The admin's own dialog for recording a featured payment says, in
 * those words, "The club sees this" about the note it takes; until now the
 * club saw none of it.
 *
 * Pure, so what counts as a payment is one rule both sides can be held to.
 */

export type ClubPaymentKind = "listing" | "featured";

export type ClubPayment = {
  /** Unique across the two sources, which number their rows separately. */
  key: string;
  kind: ClubPaymentKind;
  amountPence: number;
  currency: string;
  /** The day we recorded the money, which is what a receipt is dated by. */
  on: string;
  method: string;
  reference: string;
  note: string;
  /** What the money bought, where that is a span of dates. */
  covers: { from: string; to: string } | null;
};

/** A subscription payment, as `listing_payments` holds it. */
export type ListingPaymentLike = {
  id: number;
  amount_pence: number;
  currency: string;
  paid_at: string;
  method: string;
  reference: string;
  period_start: string | null;
  period_end: string | null;
};

/** A homepage week, as the club's own billing page already reads it. */
export type FeaturedSlotLike = {
  id: number;
  startsOn: string;
  endsOn: string;
  pricePence: number;
  currency: string;
  paidAt: string | null;
  paymentMethod: string;
  paymentNote: string;
};

const day = (value: string) => value.slice(0, 10);

/**
 * A slot only counts once the money is in.
 *
 * 0191 settled that a featured week is a placement sold and settled offline,
 * so a booked slot is not a receipt and must not appear in a list headed
 * "what you have paid". The panel above this one already says a slot is NOT
 * PAID YET; this one answers a different question and has to keep to it.
 *
 * A slot given away is not a payment either: there was nothing to settle, and
 * a £0 line in a receipt list is a receipt for nothing.
 */
export const slotIsPaid = (slot: FeaturedSlotLike) =>
  Boolean(slot.paidAt) && slot.pricePence > 0;

export function clubPayments(
  listing: ListingPaymentLike[], slots: FeaturedSlotLike[],
): ClubPayment[] {
  const fromListing: ClubPayment[] = listing.map((row) => ({
    key: `listing-${row.id}`,
    kind: "listing",
    amountPence: row.amount_pence,
    currency: row.currency,
    on: day(row.paid_at),
    method: row.method,
    reference: row.reference,
    note: "",
    covers: row.period_start && row.period_end
      ? { from: day(row.period_start), to: day(row.period_end) }
      : null,
  }));

  const fromSlots: ClubPayment[] = slots.filter(slotIsPaid).map((slot) => ({
    key: `featured-${slot.id}`,
    kind: "featured",
    amountPence: slot.pricePence,
    currency: slot.currency,
    on: day(slot.paidAt!),
    method: slot.paymentMethod,
    reference: "",
    note: slot.paymentNote,
    // The week it bought, which is the slot's own dates rather than a billing
    // period: a homepage week is not a subscription.
    covers: { from: day(slot.startsOn), to: day(slot.endsOn) },
  }));

  // Newest first, and the key breaks the tie so two payments recorded on one
  // day come back in the same order every render. 0130 paid for a tie-break
  // that did not.
  return [...fromListing, ...fromSlots].sort(
    (a, b) => b.on.localeCompare(a.on) || b.key.localeCompare(a.key));
}

/** What the two kinds are called where a line has to say which it is. */
export const PAYMENT_KIND_LABELS: Record<ClubPaymentKind, string> = {
  listing: "Listing",
  featured: "Homepage week",
};
