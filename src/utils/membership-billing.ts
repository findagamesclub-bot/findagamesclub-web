/**
 * Membership billing maths.
 *
 * Pure — no database, no server-only. These are the rules that decide what a
 * club is owed, so they need to be testable on their own rather than only
 * through a page render.
 */

import { addMonths, addYears } from "./dates";
import { formatPrice } from "./format";
import { amountOf } from "./cart-pricing";
import type { BillingOption, MembershipPayment, PaymentStanding } from "@/types/payment";

const PAYABLE = new Set(["month", "year", "one-off"]);

/** A tier with no price, or "free"/"TBC" in the box, is not chargeable. */
function isPayable(price: string): boolean {
  const clean = price.trim().toLowerCase();
  if (!clean) return false;
  return !["free", "0", "£0", "tbc", "n/a", "pay what you can"].includes(clean);
}

export function billingOptions(raw: unknown, fallbackPrice: string, fallbackDuration: string): BillingOption[] {
  const list = Array.isArray(raw) ? raw : [];
  const parsed = list
    .map((o) => {
      const row = o as Record<string, unknown>;
      const cadence = String(row.cadence ?? row.priceDuration ?? "").trim().toLowerCase();
      return {
        id: String(row.id ?? ""),
        label: String(row.label ?? ""),
        // Raw here, so isPayable still sees what the club typed. Formatted
        // below, once it is known to be a real price.
        price: String(row.price ?? ""),
        cadence,
      };
    })
    .filter((o) => o.id && PAYABLE.has(o.cadence) && isPayable(o.price));

  // "GBP 30" is what the importer stored; "£30" is what a person reads.
  if (parsed.length) {
    return parsed.map((o) => ({ ...o, price: formatPrice(o.price) ?? o.price }));
  }

  // Older clubs carry a bare price with no options list.
  const cadence = fallbackDuration.trim().toLowerCase();
  if (!isPayable(fallbackPrice) || !PAYABLE.has(cadence)) return [];
  return [{
    id: cadence,
    label: cadence === "one-off" ? "One-off" : `Per ${cadence}`,
    price: formatPrice(fallbackPrice) ?? fallbackPrice,
    cadence,
  }];
}

/**
 * Where a membership stands on the tier it holds RIGHT NOW.
 *
 * Derived rather than stored: a "paid through" column and a payments table
 * disagree the moment anyone corrects a mistake, and then nobody knows which
 * is true.
 *
 * Scoped to the current tier, and to money taken since that tier was assigned.
 * Legacy cleared tierPaidThroughAt on every tier change (club_store.py:11945)
 * so credit never carried across tiers — without both filters a member who
 * paid a year on Basic reads as paid up after being moved to Premium, and the
 * club never asks for the difference. The assigned-at filter is what stops
 * Basic -> Premium -> Basic resurrecting the first Basic payments.
 */
export function standing(
  payments: MembershipPayment[],
  tierKey: string | null,
  tierAssignedAt: string | null,
): PaymentStanding {
  const since = tierAssignedAt ? new Date(tierAssignedAt).getTime() : null;
  const current = payments.filter(
    (p) =>
      p.tierKey === tierKey &&
      (since === null || new Date(p.recordedAt).getTime() >= since),
  );

  const settledOneOff = current.some((p) => p.priceDuration === "one-off");

  // Compare as dates, not strings: Postgres can hand back "+00" or "Z" and a
  // string sort would order those differently from the instants they name.
  const ends = current
    .map((p) => p.periodEnd)
    .filter((v): v is string => Boolean(v))
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  const paidThrough = ends.length ? ends[ends.length - 1]! : null;

  return {
    paidThrough,
    overdue: Boolean(paidThrough) && new Date(paidThrough!).getTime() < Date.now(),
    settledOneOff,
  };
}

/**
 * What the yearly option saves against paying monthly.
 *
 * The most useful thing a price list can say and the one thing it was not
 * saying: £100 a year against £10 a month is two months free, and nobody
 * should have to do that arithmetic in their head to see it.
 *
 * Returns null when there is nothing to compare, or when the yearly price is
 * not actually cheaper. A club is allowed to price its year higher, and a
 * "save -£30" badge would be worse than no badge.
 */
export function yearlySaving(
  options: BillingOption[],
): { amount: number; percent: number } | null {
  const monthly = options.find((o) => o.cadence === "month");
  const yearly = options.find((o) => o.cadence === "year");
  if (!monthly || !yearly) return null;

  const perMonth = amountOf(monthly.price);
  const perYear = amountOf(yearly.price);
  if (perMonth <= 0 || perYear <= 0) return null;

  const full = perMonth * 12;
  const saved = full - perYear;
  if (saved <= 0) return null;

  return { amount: saved, percent: Math.round((saved / full) * 100) };
}

/** "£8.33 a month" for a yearly price, so the two can be compared directly. */
export function perMonth(options: BillingOption[]): string | null {
  const yearly = options.find((o) => o.cadence === "year");
  const value = yearly ? amountOf(yearly.price) / 12 : 0;
  return value > 0 ? `£${value.toFixed(2)} a month` : null;
}
