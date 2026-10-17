import "server-only";

import * as repo from "@/repositories/payments.repository";
import * as memberships from "@/repositories/memberships.repository";
import * as notify from "./membership-notify.service";
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
    editedAt: row.edited_at,
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

    // A receipt for money that changed hands offline. Nothing was charged here,
    // so the wording confirms what the club recorded, not what we took.
    await announcePayment(row.club_id, row.profile_id, {
      tierLabel: tier.label,
      billingLabel: option.label,
      price: option.price,
      periodEnd: until ? until.toISOString() : null,
    });

    return { ok: true };
  } catch {
    return { ok: false, error: "Only the club owner can record payments." };
  }
}

/** Best effort, after the fact. Never allowed to fail a recorded payment. */
async function announcePayment(
  clubId: number,
  memberId: string,
  detail: { tierLabel: string; billingLabel: string; price: string; periodEnd: string | null },
) {
  try {
    const club = await memberships.findClubBasics(clubId);
    if (!club) return;
    await notify.notifyPaid({
      memberId,
      clubName: club.name,
      clubSlug: club.slug,
      ...detail,
    });
  } catch (error) {
    console.error("payment receipt failed", { clubId, memberId, error });
  }
}


/**
 * The club putting a recorded payment right.
 *
 * 0012 made this ledger insert-only, which was the right instinct about the
 * wrong thing: nothing here takes money, so the row is a club typing what
 * arrived at the door, and a mistyped one had no route back except the SQL
 * console. 0195 opens the correction and stamps it, so the ledger stays
 * auditable rather than becoming editable-and-silent.
 *
 * The member is deliberately not told. 0171 drew that line for a corrected
 * join date: somebody is told when a club does something TO them, not because
 * a club fixed its own typing. The mark on the row is what keeps it honest,
 * and both sides of the ledger show it.
 */
export async function editPayment(params: {
  paymentId: number;
  /** Null corrects only the note and leaves the money alone. */
  billingOptionId: string | null;
  note: string;
}): Promise<RecordResult> {
  const payment = await repo.findPayment(params.paymentId);
  if (!payment) return { ok: false, error: "That payment is not here any more." };

  const patch: Record<string, unknown> = {
    note: params.note.trim().slice(0, 300) || null,
  };

  if (params.billingOptionId) {
    const history = await getPayments(payment.membership_id);
    // Only the newest one. Every payment stacks onto the end of the one before
    // it, so changing an older term would leave every period after it quietly
    // wrong, and rewriting those is the club correcting rows it never asked to
    // touch. The note is correctable on any of them, because a note is not in
    // the arithmetic.
    if (history[0]?.id !== payment.id) {
      return { ok: false, error:
        "Only the newest payment's amount can be changed, because the ones after it "
        + "were worked out from this one. The note can be put right on any of them." };
    }

    const row = await memberships.findMembershipForPayment(payment.membership_id);
    if (!row?.tier_key) {
      return { ok: false, error: "Set a membership tier before correcting a payment." };
    }
    const tier = await repo.findTier(payment.club_id, row.tier_key);
    if (!tier) return { ok: false, error: "That tier no longer exists." };

    const options = billingOptions(tier.billing_options, tier.price, tier.price_duration);
    const option = options.find((o) => o.id === params.billingOptionId);
    if (!option) return { ok: false, error: "Choose how they paid." };

    // The period keeps the start it was given. A correction changes how long
    // the money bought, never when the club says it arrived: re-reading `now()`
    // here would walk the start date forward every time somebody fixed a typo.
    const from = payment.period_start_at ? new Date(payment.period_start_at) : new Date();
    const until =
      option.cadence === "month" ? addMonths(from, 1)
      : option.cadence === "year" ? addYears(from, 1)
      : null;

    patch.tier_key = row.tier_key;
    patch.tier_label = tier.label;
    patch.billing_option_label = option.label;
    patch.price = option.price;
    patch.price_duration = option.cadence;
    patch.period_end_at = until ? until.toISOString() : null;
  }

  try {
    await repo.updatePayment(params.paymentId, patch);
    return { ok: true };
  } catch {
    return { ok: false, error: "Only the club can correct a payment." };
  }
}
