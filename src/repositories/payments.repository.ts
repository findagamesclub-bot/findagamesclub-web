import "server-only";

import { createClient } from "@/lib/supabase/server";
import { table, type TableRow } from "@/lib/supabase/table";
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
  & { edited_at: string | null };

const COLUMNS =
  "id, membership_id, club_id, tier_key, tier_label, billing_option_label, price, "
  + "price_duration, period_start_at, period_end_at, note, created_at, edited_at";

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
