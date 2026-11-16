"use server";

import { revalidatePath } from "next/cache";

import { getCurrentProfile } from "@/services/auth.service";
import {
  correctPayment, getSubscription, recordPayment, saveBillingSettings,
  setPaymentRefund,
} from "@/services/billing.service";
import * as notify from "@/services/billing-notify.service";

export type BillingState = { error?: string; notice?: string };

/**
 * Record a payment somebody sent us.
 *
 * The role is re-checked here even though the layout redirects: the layout
 * draws the console, it does not guard the write, and the function underneath
 * refuses a non-admin as well.
 */
export async function recordPaymentAction(
  _prev: BillingState, data: FormData,
): Promise<BillingState> {
  const viewer = await getCurrentProfile();
  if (!viewer || viewer.role !== "admin") {
    return { error: "Only an admin can record a payment." };
  }

  const subscription = Number(data.get("subscription") ?? 0);
  if (!subscription) return { error: "That subscription is not here any more." };

  // Pounds on the form, pence in the database. Parsed here rather than trusted:
  // a figure the browser can name is a figure the browser can choose.
  const pounds = Number(String(data.get("amount") ?? "").replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(pounds) || pounds <= 0) {
    return { error: "Put in how much was paid." };
  }

  const result = await recordPayment({
    subscription,
    amountPence: Math.round(pounds * 100),
    method: String(data.get("method") ?? "other"),
    paidAt: String(data.get("paidAt") ?? "") || null,
    reference: String(data.get("reference") ?? ""),
    note: String(data.get("note") ?? ""),
  });
  if (!result.ok) return { error: result.error };

  // Read afterwards, so the receipt carries the period the payment actually
  // bought rather than one worked out twice.
  const after = await getSubscription(subscription).catch(() => null);
  if (after?.club?.slug) {
    void notify.paymentReceived(
      { slug: after.club.slug, name: after.club.name, ownerId: after.owner_id },
      Math.round(pounds * 100), after.current_period_end);
  }

  revalidatePath("/admin/billing");
  revalidatePath(`/admin/billing/${subscription}`);
  revalidatePath("/admin", "layout");
  // A payment can put a club back in the directory and can move a submission
  // into the review queue, so both of those lists are stale now.
  revalidatePath("/clubs");
  revalidatePath("/admin/submissions");
  if (after?.club?.slug) revalidatePath(`/clubs/${after.club.slug}`, "layout");

  return { notice: "Recorded. They have been emailed a receipt." };
}

export async function saveBillingSettingsAction(
  _prev: BillingState, data: FormData,
): Promise<BillingState> {
  const viewer = await getCurrentProfile();
  if (!viewer || viewer.role !== "admin") {
    return { error: "Only an admin can change the billing settings." };
  }

  // "£15", "15.00" and "1,500" are all a price somebody typed. "not a price" is
  // not, and the first version of this said it was: stripping the letters left
  // an empty string, `Number("")` is 0, so a typo set every monthly listing to
  // free under a toast that said Saved.
  const pence = (key: string) => {
    const raw = String(data.get(key) ?? "").trim().replace(/[£,\s]/g, "");
    return /^\d+(\.\d{1,2})?$/.test(raw) ? Math.round(Number(raw) * 100) : null;
  };

  const whole = (key: string) => {
    const raw = String(data.get(key) ?? "").trim();
    return /^\d+$/.test(raw) ? Number(raw) : null;
  };

  // Named one at a time, because "Prices have to be numbers" over three boxes
  // leaves somebody hunting for which one.
  const prices = new Map<string, number>();
  for (const [key, label] of [
    ["monthly", "A month"], ["yearly", "A year"],
    ["featuredPrice", "A featured slot"],
  ] as const) {
    const value = pence(key);
    if (value === null) {
      return { error: `${label} has to be an amount in pounds, like 15 or 15.00.` };
    }
    prices.set(key, value);
  }
  const monthly = prices.get("monthly") as number;
  const yearly = prices.get("yearly") as number;
  const featured = prices.get("featuredPrice") as number;

  const days = whole("grace");
  if (days === null) {
    return { error: "The grace period has to be a whole number of days, like 7." };
  }

  const slotDays = whole("featuredDays");
  if (slotDays === null || slotDays < 1) {
    return { error: "Slot length has to be at least one day." };
  }

  // "14, 3" or "14 3" both mean the same thing to somebody typing it. Something
  // typed that yields no days at all is a typo, not a request for silence:
  // quietly writing 14, 3 over it would tell them they had set something they
  // had not. An empty box is the request for silence.
  const typed = String(data.get("reminders") ?? "").trim();
  const reminders = typed
    .split(/[^0-9]+/).map(Number).filter((n) => Number.isFinite(n) && n > 0);
  if (typed && reminders.length === 0) {
    return { error: "Remind them has to be days before it runs out, like 14, 3." };
  }

  const result = await saveBillingSettings({
    enabled: data.get("enabled") === "on",
    auto_hide_lapsed: data.get("autoHide") === "on",
    monthly_price_pence: monthly,
    yearly_price_pence: yearly,
    featured_price_pence: featured,
    featured_duration_days: slotDays,
    grace_period_days: days,
    reminder_days: reminders,
    payment_instructions_md: String(data.get("instructions") ?? ""),
  });
  if (!result.ok) return { error: result.error };

  revalidatePath("/admin/billing");
  revalidatePath("/admin", "layout");
  return { notice: "Saved. New listings are billed on these from now on." };
}

/**
 * Put a recorded payment right, and record a refund on it (0233, item 18).
 *
 * One action for both halves because it is one dialog: the admin opens a
 * payment, fixes what is wrong with it and says whether money went back. They
 * are kept apart on the ledger, which is where the distinction matters.
 */
export async function correctPaymentAction(
  _prev: BillingState, data: FormData,
): Promise<BillingState> {
  const viewer = await getCurrentProfile();
  if (!viewer || viewer.role !== "admin") {
    return { error: "Only an admin can change a payment." };
  }

  const payment = Number(data.get("payment") ?? 0);
  const subscription = Number(data.get("subscription") ?? 0);
  if (!payment) return { error: "That payment is not here any more." };

  // Pounds on the form, pence in the database, parsed rather than trusted.
  // Stripping non-digits turns a typo into zero, which is how a mistyped price
  // once saved as free, so the shape is tested before it is read.
  const typed = String(data.get("amount") ?? "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(typed)) {
    return { error: "Put in how much was paid, in pounds and pence." };
  }

  const corrected = await correctPayment({
    payment,
    amountPence: Math.round(Number(typed) * 100),
    method: String(data.get("method") ?? "other"),
    paidAt: String(data.get("paidAt") ?? "") || null,
    reference: String(data.get("reference") ?? ""),
    note: String(data.get("note") ?? ""),
  });
  if (!corrected.ok) return { error: corrected.error };

  const refundStatus = String(data.get("refundStatus") ?? "").trim();
  if (refundStatus) {
    const went = await setPaymentRefund({
      payment,
      status: refundStatus,
      method: String(data.get("refundMethod") ?? ""),
      note: String(data.get("refundNote") ?? ""),
    });
    if (!went.ok) return { error: went.error };
  }

  revalidatePath("/admin/billing");
  if (subscription) revalidatePath(`/admin/billing/${subscription}`);

  return { notice: refundStatus === "refunded"
    ? "Payment corrected and the refund recorded."
    : "Payment corrected." };
}
