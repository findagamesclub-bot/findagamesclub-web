import "server-only";

import * as repo from "@/repositories/billing.repository";
import { billingRefusal } from "@/utils/billing-refusals";
import { BILLING_TABS } from "@/utils/listing-billing";

export type BillingResult = { ok: true } | { ok: false; error: string };

const PER_PAGE = 25;

export async function getBillingSettings() {
  // A database with no settings row, or no settings table, is a database
  // mid-migration. Both answer "billing is off", which is the safe direction:
  // the owner's page says there is nothing to pay and the cron sends nobody a
  // letter about a charge that may not exist.
  //
  // The queue below deliberately does not do this. An admin looking at the
  // money must not be shown an empty list when the real answer is that we
  // could not read it, because nothing owed is exactly how money stops being
  // collected quietly.
  const row = await repo.findBillingSettings().catch(() => null);
  return row ?? {
    id: 1, enabled: false, currency: "GBP",
    monthly_price_pence: 1500, yearly_price_pence: 15000,
    grace_period_days: 7, reminder_days: [14, 3],
    featured_price_pence: 2000, featured_duration_days: 7,
    auto_hide_lapsed: false, provider_mode: "offline",
    payment_instructions_md: "", updated_at: "",
  };
}

/**
 * The price, for the pages anybody can read.
 *
 * Sessionless and narrow: three figures and the switch, nothing else off that
 * row. `getBillingSettings` is the admin's read and needs a session.
 */
export async function getPublicPrices() {
  const row = await repo.findPublicPrices().catch(() => null);
  return row ?? {
    enabled: false, currency: "GBP",
    monthly_price_pence: 0, yearly_price_pence: 0,
  };
}

export async function saveBillingSettings(
  patch: Parameters<typeof repo.saveBillingSettings>[0],
): Promise<BillingResult> {
  try {
    await repo.saveBillingSettings(patch);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: billingRefusal(error) };
  }
}

export type BillingFilters = { standing: string; query: string; page: number };

export function readBillingFilters(
  params: Record<string, string | string[] | undefined>,
): BillingFilters {
  const one = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  const standing = one("state") || "in_grace";
  const page = Math.max(1, Number(one("page")) || 1);
  return { standing, query: one("q"), page };
}

export async function getBillingQueue(filters: BillingFilters) {
  const from = (filters.page - 1) * PER_PAGE;

  const [page, counts] = await Promise.all([
    repo.findSubscriptionsPage({
      standing: filters.standing, query: filters.query,
      from, to: from + PER_PAGE - 1,
    }),
    repo.countSubscriptionsByStanding(BILLING_TABS.map((t) => t.key)),
  ]);

  return {
    rows: page.rows, total: page.total,
    page: filters.page, perPage: PER_PAGE, counts,
  };
}

/** The one number the admin rail's badge carries: money owed, right now. */
export async function countOverdue(): Promise<number> {
  const counts = await repo
    .countSubscriptionsByStanding(["in_grace", "lapsed", "awaiting_payment"])
    .catch(() => new Map<string, number>());
  return (counts.get("in_grace") ?? 0) + (counts.get("lapsed") ?? 0)
    + (counts.get("awaiting_payment") ?? 0);
}

export async function getSubscription(id: number) {
  return repo.findSubscription(id);
}

export async function getSubscriptionForClub(clubId: number) {
  return repo.findSubscriptionForClub(clubId);
}

export async function getPayments(subscriptionId: number) {
  return repo.findPayments(subscriptionId).catch(() => []);
}

/**
 * Write a payment down.
 *
 * The database does the arithmetic and the receipt is the service's half, so a
 * mail failure cannot undo money that has already been recorded.
 */
export async function recordPayment(params: {
  subscription: number; amountPence: number; method: string;
  paidAt: string | null; reference: string; note: string;
}): Promise<BillingResult> {
  try {
    await repo.recordPayment(params);
  } catch (error) {
    return { ok: false, error: billingRefusal(error) };
  }
  return { ok: true };
}
