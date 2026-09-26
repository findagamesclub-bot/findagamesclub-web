import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createAnonClient } from "@/lib/supabase/anon";
import { callRpc, table } from "@/lib/supabase/table";

/**
 * Listing billing.
 *
 * Shimmed because 0111 to 0114 arrived after the last type generation. Every
 * row shape here is hand-written for that reason; regenerate `database.ts` and
 * these become ordinary typed queries.
 */

export type BillingSettingsRow = {
  id: number;
  enabled: boolean;
  currency: string;
  monthly_price_pence: number;
  yearly_price_pence: number;
  grace_period_days: number;
  reminder_days: number[];
  featured_price_pence: number;
  featured_duration_days: number;
  auto_hide_lapsed: boolean;
  provider_mode: string;
  payment_instructions_md: string;
  updated_at: string;
};

const SETTINGS_COLUMNS =
  `id, enabled, currency, monthly_price_pence, yearly_price_pence,
   grace_period_days, reminder_days, featured_price_pence, featured_duration_days,
   auto_hide_lapsed, provider_mode, payment_instructions_md, updated_at`;

export async function findBillingSettings(): Promise<BillingSettingsRow | null> {
  const rows = await table<BillingSettingsRow>("listing_billing_settings");
  const { data, error } = await rows.select(SETTINGS_COLUMNS).eq("id", 1).maybeSingle();
  if (error) throw new Error(`Failed to load the billing settings: ${error.message}`);
  return data;
}

/**
 * Change them.
 *
 * The zero-row pattern: the policy admits only an admin, and a filtered-out
 * update returns 204 with no error, so the absence of a row is the refusal.
 */
export async function saveBillingSettings(
  patch: Partial<Omit<BillingSettingsRow, "id" | "updated_at">>,
): Promise<BillingSettingsRow> {
  const rows = await table<BillingSettingsRow>("listing_billing_settings");
  const { data, error } = await rows
    .update(patch).eq("id", 1).select(SETTINGS_COLUMNS).maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("NOT_PERMITTED");
  return data;
}

/**
 * What listing a club costs, for a page a signed-out visitor reads.
 *
 * Through `listing_public_prices()` (0116) rather than the settings table,
 * which is `authenticated` only and holds bank details. Reading the table from
 * `/list-your-club` gave a signed-out organiser nothing, which fell back to the
 * defaults and told them listing was free while we were charging £15 a month.
 */
export type PublicPrices = {
  enabled: boolean;
  currency: string;
  monthly_price_pence: number;
  yearly_price_pence: number;
};

export async function findPublicPrices(): Promise<PublicPrices | null> {
  const supabase = createAnonClient();
  const { data, error } = await (supabase as unknown as {
    rpc(name: string, args: Record<string, unknown>): Promise<{
      data: PublicPrices[] | null; error: { message: string } | null;
    }>;
  }).rpc("listing_public_prices", {});

  if (error) throw new Error(`Failed to read what a listing costs: ${error.message}`);
  return data?.[0] ?? null;
}

export type SubscriptionRow = {
  id: number;
  club_id: number | null;
  submission_id: number | null;
  owner_id: string;
  plan_interval: string;
  status: string;
  price_pence: number;
  currency: string;
  current_period_start: string | null;
  current_period_end: string | null;
  grace_ends_on: string | null;
  standing: string;
  club?: { slug: string; name: string; city: string; status: string } | null;
  /**
   * Where the name comes from before there is a club.
   *
   * A subscription opened for a listing still at the payment desk has no
   * `club_id`, so every unpaid row rendered as "A listing not yet approved" and
   * an admin with ten of them could not tell which was which.
   */
  submission?: { club_name: string | null; city: string | null } | null;
  owner?: { full_name: string | null } | null;
};

const STANDING_COLUMNS =
  `id, club_id, submission_id, owner_id, plan_interval, status, price_pence,
   currency, current_period_start, current_period_end, grace_ends_on, standing,
   club:clubs(slug, name, city, status),
   submission:club_submissions(club_name, city),
   owner:profiles!owner_id(full_name)`;

/**
 * The admin's list, filtered and paged in SQL.
 *
 * Standing is a computed column on the view, so filtering on it is a filter
 * like any other rather than a pass in the browser. At five thousand clubs that
 * is the difference between a page and a download.
 */
export async function findSubscriptionsPage(params: {
  standing: string; query: string; from: number; to: number;
}): Promise<{ rows: SubscriptionRow[]; total: number }> {
  const view = await table<SubscriptionRow>("listing_subscription_standing");
  let query = view.select(STANDING_COLUMNS, { count: "exact" });

  if (params.standing !== "all") query = query.eq("standing", params.standing);

  const term = params.query.trim().replace(/[%,()]/g, " ").trim();
  if (term) query = query.ilike("clubs.name", `%${term}%`);

  const { data, error, count } = await query
    .order("current_period_end", { ascending: true, nullsFirst: true })
    .range(params.from, params.to);

  if (error) throw new Error(`Failed to load the subscriptions: ${error.message}`);
  return { rows: data ?? [], total: count ?? 0 };
}

/** One index count per tab, which costs the same at five thousand as at five. */
export async function countSubscriptionsByStanding(
  keys: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  await Promise.all(keys.map(async (key) => {
    const view = await table<SubscriptionRow>("listing_subscription_standing");
    let query = view.select("id", { count: "exact" });
    if (key !== "all") query = query.eq("standing", key);
    const { count } = await query.range(0, 0);
    counts.set(key, count ?? 0);
  }));

  return counts;
}

export async function findSubscription(id: number): Promise<SubscriptionRow | null> {
  const view = await table<SubscriptionRow>("listing_subscription_standing");
  const { data, error } = await view.select(STANDING_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Failed to load that subscription: ${error.message}`);
  return data;
}

/** The club's own, for the console's billing page. */
export async function findSubscriptionForClub(
  clubId: number,
): Promise<SubscriptionRow | null> {
  const view = await table<SubscriptionRow>("listing_subscription_standing");
  const { data, error } = await view
    .select(STANDING_COLUMNS)
    .eq("club_id", clubId)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to load that club's billing: ${error.message}`);
  return data;
}

export type PaymentRow = {
  id: number;
  amount_pence: number;
  currency: string;
  paid_at: string;
  method: string;
  reference: string;
  note: string;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
};

export async function findPayments(subscriptionId: number): Promise<PaymentRow[]> {
  const rows = await table<PaymentRow>("listing_payments");
  const { data, error } = await rows
    .select(`id, amount_pence, currency, paid_at, method, reference, note,
             period_start, period_end, created_at`)
    .eq("subscription_id", subscriptionId)
    .order("paid_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) throw new Error(`Failed to load the payments: ${error.message}`);
  return data ?? [];
}

export const recordPayment = (params: {
  subscription: number; amountPence: number; method: string;
  paidAt: string | null; reference: string; note: string;
}) => callRpc<number>("record_listing_payment", {
  p_subscription: params.subscription,
  p_amount_pence: params.amountPence,
  p_method: params.method,
  p_paid_at: params.paidAt,
  p_reference: params.reference,
  p_note: params.note,
});

/** The cron's three questions, asked one stage at a time. */
export type DueRow = {
  subscription_id: number; club_id: number | null; owner_id: string;
  club_name: string; club_slug: string; period_end: string;
  days_left: number; price_pence: number; plan_interval: string;
};

/**
 * Everything the cron touches runs as the service role.
 *
 * It has to. `listing_subscriptions_due` and `expire_listing_subscription` are
 * both revoked from `anon` and `authenticated`, the settings are readable only
 * by `authenticated`, and a cron request carries no session at all: it is a
 * machine with a bearer token. Read through the cookie client it was `anon`,
 * so every call failed, every `catch` swallowed it, and the job reported a
 * clean no-op every night while doing nothing. Nobody was ever reminded and
 * nothing ever lapsed.
 *
 * Safe because the route proves the caller with `CRON_SECRET` before it gets
 * here, and because none of this takes user input.
 */
export async function findDueAsJob(stage: string): Promise<DueRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .rpc("listing_subscriptions_due" as never, { p_stage: stage } as never);
  if (error) throw new Error(`Failed to ask who is due: ${error.message}`);
  return (data ?? []) as DueRow[];
}

export async function findBillingSettingsAsJob(): Promise<BillingSettingsRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("listing_billing_settings" as never)
    .select(SETTINGS_COLUMNS).eq("id", 1).maybeSingle();
  if (error) throw new Error(`Failed to read the billing settings: ${error.message}`);
  return (data ?? null) as BillingSettingsRow | null;
}

export async function expireSubscriptionAsJob(id: number): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .rpc("expire_listing_subscription" as never, { p_subscription: id } as never);
  if (error) throw new Error(`Failed to close a subscription: ${error.message}`);
}
