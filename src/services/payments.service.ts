import "server-only";

import * as repo from "@/repositories/payments.repository";
import * as memberships from "@/repositories/memberships.repository";
import { addMonths, addYears } from "@/utils/dates";
import { billingOptions, standing } from "@/utils/membership-billing";
import type { MembershipPayment } from "@/types/payment";

export { billingOptions, standing };

/**
 * Offline membership payments.
 *
 * Clubs take cash at the door and bank transfers, so nothing is charged here.
 * An owner records that money arrived, and the period runs from whenever the
 * last one ended — that is what stops a member who pays early losing the
 * remainder of the month they already bought.
 */

function toPayment(row: Awaited<ReturnType<typeof repo.findPaymentsForMembership>>[number]): MembershipPayment {
  return {
    id: row.id,
    tierKey: row.tier_key,
    tierLabel: row.tier_label,
    billingOptionLabel: row.billing_option_label,
    price: row.price,
    priceDuration: row.price_duration,
    periodStart: row.period_start_at,
    periodEnd: row.period_end_at,
    note: row.note,
    recordedAt: row.created_at,
  };
}

export async function getPayments(membershipId: number): Promise<MembershipPayment[]> {
  const rows = await repo.findPaymentsForMembership(membershipId);
  return rows.map(toPayment);
}

/** Payments for a whole club, grouped by membership, for the owner's view. */
export async function getClubPayments(clubId: number): Promise<Map<number, MembershipPayment[]>> {
  const rows = await repo.findPaymentsForClub(clubId);
  const byMembership = new Map<number, MembershipPayment[]>();
  for (const row of rows) {
    const list = byMembership.get(row.membership_id) ?? [];
    list.push(toPayment(row));
    byMembership.set(row.membership_id, list);
  }
  return byMembership;
}

type RecordResult = { ok: true } | { ok: false; error: string };

export async function recordPayment(
  membershipId: number,
  billingOptionId: string,
  note: string,
  actorId: string,
): Promise<RecordResult> {
  const row = await memberships.findMembershipForPayment(membershipId);
  if (!row) return { ok: false, error: "That membership no longer exists." };
  if (row.status !== "approved") {
    return { ok: false, error: "Only approved members can be marked as paid." };
  }
  if (!row.tier_key) return { ok: false, error: "Set a membership tier before recording a payment." };

  const tier = await repo.findTier(row.club_id, row.tier_key);
  if (!tier) return { ok: false, error: "That tier no longer exists." };

  const options = billingOptions(tier.billing_options, tier.price, tier.price_duration);
  const option = options.find((o) => o.id === billingOptionId);
  if (!option) return { ok: false, error: "Choose how they paid." };

  const existing = await getPayments(membershipId);
  const state = standing(existing, row.tier_key, row.tier_assigned_at);

  if (option.cadence === "one-off" && state.settledOneOff) {
    return { ok: false, error: "That one-off fee has already been recorded." };
  }

  // Stack onto the end of what they already hold, so paying early does not
  // throw away the rest of the period they bought.
  const now = new Date();
  const from = state.paidThrough && new Date(state.paidThrough) > now ? new Date(state.paidThrough) : now;
  const until =
    option.cadence === "month" ? addMonths(from, 1)
    : option.cadence === "year" ? addYears(from, 1)
    : null;

  try {
    await repo.insertPayment({
      membership_id: membershipId,
      club_id: row.club_id,
      profile_id: row.profile_id,
      tier_key: row.tier_key,
      tier_label: tier.label,
      billing_option_label: option.label,
      price: option.price,
      price_duration: option.cadence,
      period_start_at: from.toISOString(),
      period_end_at: until ? until.toISOString() : null,
      note: note.trim().slice(0, 300) || null,
      recorded_by: actorId,
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "Only the club owner can record payments." };
  }
}
