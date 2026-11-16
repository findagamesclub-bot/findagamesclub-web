import type { StatusTone } from "./moderation-status";

/**
 * One vocabulary for money, across all six sections.
 *
 * The client, item 16: the recording of payments and refunds "is different for
 * each section currently". It was different in the database and it was
 * different in words too — a table booking said "Paid on the door", a shop
 * order said "Marked paid", coaching said nothing at all about a refund. 0233
 * made the storage one shape; this is the other half, so a line of history
 * reads the same wherever somebody meets it.
 *
 * The state is stored in the section's own vocabulary and turned into English
 * here, once. Storing the English would mean translating it twice the first
 * time a label changes, and the two copies would disagree about the rows
 * written in between.
 */

export const MONEY_SCOPES = [
  "booking", "coaching", "event", "order", "membership", "listing",
] as const;
export type MoneyScope = (typeof MONEY_SCOPES)[number];

export type MoneyEventKind = "payment" | "refund" | "status" | "note";

export type MoneyEvent = {
  id: number;
  entityId: number;
  /** "booker" or "opponent" on a table booking, empty everywhere else. */
  side: string;
  kind: MoneyEventKind;
  state: string;
  method: string;
  note: string;
  /** When the money moved, which is not always when it was written down. */
  at: string;
  /** False when a person typed it, which the screen draws differently. */
  automatic: boolean;
  author: string;
};

const WORDS: Record<string, string> = {
  // Payments, in each section's own words.
  unpaid: "Marked unpaid",
  paid: "Marked paid",
  paid_on_the_door: "Paid on the door",
  paid_in_advance: "Paid in advance",
  recorded: "Payment recorded",
  subscription: "Subscription paid",
  featured: "Featured slot paid",
  // Refunds.
  not_due: "No refund due",
  due: "Refund due",
  refund_due: "Refund due",
  refunded: "Refunded",
  // Everything else that happens to an order or a ledger row.
  placed: "Order placed",
  fulfilled: "Order fulfilled",
  cancelled: "Cancelled",
  corrected: "Payment corrected",
};

/**
 * A method is stored as the section stored it.
 *
 * Billing writes keys (`bank_transfer`), the booking screens write what the
 * club typed ("Cash"). Both end up here, so the key is unpicked and whatever
 * somebody typed is left exactly as they typed it.
 */
export function tidyMethod(method: string): string {
  const said = (method ?? "").trim();
  if (!said) return "";
  if (!said.includes("_")) return said;
  const words = said.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The sentence. A note is whatever was typed; everything else is derived. */
export function moneyEventLine(event: MoneyEvent): string {
  if (event.kind === "note") return event.note;

  const head = WORDS[event.state] ?? event.state;
  const how = tidyMethod(event.method);
  // "Refunded by bank transfer". A payment that carries no method says
  // nothing rather than trailing an empty "by".
  return how ? `${head} by ${how}` : head;
}

/** The note under the line, when there is one and it is not the line itself. */
export function moneyEventNote(event: MoneyEvent): string {
  return event.kind === "note" ? "" : (event.note ?? "").trim();
}

/**
 * What it looks like.
 *
 * Red for money going out, green for money coming in, and the rest quiet. Same
 * call `refundTag` already made and the client's own: a refund on a page whose
 * job is counting takings should read as a subtraction.
 */
export function moneyEventTone(event: MoneyEvent): StatusTone | null {
  if (event.kind === "refund") {
    if (event.state === "refunded") return "refunded";
    if (event.state === "due" || event.state === "refund_due") return "waiting";
    return null;
  }
  if (event.kind === "payment") {
    return event.state === "unpaid" ? null : "kept";
  }
  return null;
}

/**
 * How money moved, for every dialog that asks.
 *
 * It was a `const METHODS` inside the table booking's dialog and nothing else
 * had one. A second copy in the coaching dialog would have matched on the day
 * it was written and drifted the first time either was touched, which is rule
 * 11 and the reason this file exists at all.
 *
 * Deliberately not the billing section's `PAYMENT_METHODS`: that one is keys
 * an admin picks for our own invoicing (`bank_transfer`, `cheque`), and this
 * is what a club says happened at the door.
 */
export const PAYMENT_WAYS = [
  "Cash", "Card", "Bank transfer", "PayPal", "Other",
] as const;

/** Which side of a table booking a line is about, for a list that shows both. */
export const SIDE_LABELS: Record<string, string> = {
  booker: "Booked by",
  opponent: "Opponent",
};
