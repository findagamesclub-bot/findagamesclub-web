import "server-only";

import { createClient } from "@/lib/supabase/server";
import { callRpc, table, type TableRow } from "@/lib/supabase/table";
import type { TablesInsert } from "@/types/database";

/**
 * A payment row, including the correction mark 0195 adds.
 *
 * Hand-written against the generated row rather than read through the typed
 * client, because `edited_at` is 0195's and `src/types/database.ts` has not
 * been regenerated since 0151. `check:columns` is right to refuse a select
 * naming a column its schema has never heard of.
 */
export type PaymentRow =
  Pick<TableRow<"club_membership_payments">,
       "id" | "membership_id" | "club_id" | "tier_key" | "tier_label"
       | "billing_option_label" | "price" | "price_duration"
       | "period_start_at" | "period_end_at" | "note" | "created_at">
  & { edited_at: string | null }
  // 0233. A renewal can be refunded now, which it never could before: the
  // generated types predate the columns, so they ride on top the same way
  // `edited_at` has since 0195.
  & { refund_status: string; refunded_at: string | null;
      refund_method: string; refund_note: string };

const COLUMNS =
  "id, membership_id, club_id, tier_key, tier_label, billing_option_label, price, "
  + "price_duration, period_start_at, period_end_at, note, created_at, edited_at, "
  + "refund_status, refunded_at, refund_method, refund_note";

/** Every payment recorded against one club, newest first. */
export async function findPaymentsForClub(clubId: number) {
  const payments = await table<PaymentRow>("club_membership_payments");
  const { data, error } = await payments
    .select(COLUMNS)
    .eq("club_id", clubId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load payments: ${error.message}`);
  return data ?? [];
}

export async function findPaymentsForMembership(membershipId: number) {
  const payments = await table<PaymentRow>("club_membership_payments");
  const { data, error } = await payments
    .select(COLUMNS)
    .eq("membership_id", membershipId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load payments: ${error.message}`);
  return data ?? [];
}

/** Payments for several of the viewer's memberships at once. */
export async function findPaymentsForMemberships(membershipIds: number[]) {
  if (!membershipIds.length) return [];
  const payments = await table<PaymentRow>("club_membership_payments");
  const { data, error } = await payments
    .select(COLUMNS)
    .in("membership_id", membershipIds)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load payments: ${error.message}`);
  return data ?? [];
}

export async function insertPayment(row: TablesInsert<"club_membership_payments">) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_membership_payments")
    .insert(row)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  // The insert policy is can_manage_club, and a blocked insert throws rather
  // than returning empty — but check anyway, the same way the updates do.
  if (!data) throw new Error("NOT_PERMITTED");
  return data;
}

/** One payment, for the club putting it right. */
export async function findPayment(id: number): Promise<PaymentRow | null> {
  const payments = await table<PaymentRow>("club_membership_payments");
  const { data, error } = await payments.select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Correct one, and prove it landed.
 *
 * RLS turns an update the caller may not make into zero rows and no error, so
 * checking `error` alone reports a blocked write as a success. The row comes
 * back and a missing one is the refusal.
 */
export async function updatePayment(id: number, patch: Record<string, unknown>) {
  const payments = await table<{ id: number }>("club_membership_payments");
  const { data, error } = await payments.update(patch).eq("id", id)
    .select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("NOT_PERMITTED");
  return data;
}

/** The tier a club offers, with its billing options. */
export async function findTier(clubId: number, tierKey: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_membership_tiers")
    .select("tier_key, label, price, price_duration, billing_options")
    .eq("club_id", clubId)
    .eq("tier_key", tierKey)
    .maybeSingle();

  if (error) throw new Error(`Failed to load tier: ${error.message}`);
  return data;
}

/**
 * Marking a renewal refunded (0233).
 *
 * Through a function rather than an update, because the date is stamped and
 * the status is not in 0195's column grant: when money went back is a fact
 * about the row, not something a form gets to name.
 */
export const setPaymentRefund = (params: {
  paymentId: number; status: string; method: string; note: string;
}) => callRpc<unknown>("club_set_membership_payment_refund", {
  p_payment: params.paymentId, p_status: params.status,
  p_method: params.method, p_note: params.note,
});
