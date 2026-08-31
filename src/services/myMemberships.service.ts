import "server-only";

import { findMine, requestTier } from "@/repositories/myMemberships.repository";
import { findClubBasics } from "@/repositories/memberships.repository";
import { findProfileById } from "@/repositories/profiles.repository";
import { notifyTierRequested } from "./membership-notify.service";
import { findPaymentsForMemberships } from "@/repositories/payments.repository";
import { standing } from "@/utils/membership-billing";
import { toMembershipTiers } from "@/utils/membership-tiers";
import type { MembershipPayment, PaymentStanding } from "@/types/payment";
import type { MembershipTier } from "@/types/clubDetail";

export type MyClubMembership = {
  membershipId: number;
  status: "pending" | "approved" | "declined" | "cancelled";
  club: { id: number; slug: string; name: string; city: string; logoUrl: string | null };
  tierKey: string | null;
  tierLabel: string | null;
  joinedAt: string | null;
  requestedAt: string;
  declineReason: string | null;
  /** A tier the member has asked to move to, still with the club. */
  requestedTierKey: string | null;
  requestedTierLabel: string | null;
  requestedAtTier: string | null;
  payments: MembershipPayment[];
  standing: PaymentStanding;
  /** The club's ladder, so an approved member can see what upgrading buys. */
  tiers: MembershipTier[];
};

const toPayment = (row: {
  id: number; tier_key: string | null; tier_label: string; billing_option_label: string;
  price: string; price_duration: string; period_start_at: string | null;
  period_end_at: string | null; note: string | null; created_at: string;
}): MembershipPayment => ({
  id: row.id,
  tierKey: row.tier_key,
  tierLabel: row.tier_label,
  billingOptionLabel: row.billing_option_label,
  price: row.price,
  priceDuration: row.price_duration,
  periodStart: row.period_start_at,
  periodEnd: row.period_end_at,
  note: row.note ?? "",
  recordedAt: row.created_at,
});

/**
 * Every club the viewer belongs to, with where their membership and their
 * money stand.
 *
 * Two queries whatever the number of clubs: the memberships, then every
 * payment against them at once. Asking per club was the shape that made the
 * legacy roster endpoint eighty round trips.
 */
export async function getMyMemberships(profileId: string): Promise<MyClubMembership[]> {
  const rows = await findMine(profileId);
  if (!rows.length) return [];

  const payments = await findPaymentsForMemberships(rows.map((row) => row.id));
  const byMembership = new Map<number, MembershipPayment[]>();
  for (const row of payments) {
    const list = byMembership.get(row.membership_id) ?? [];
    list.push(toPayment(row));
    byMembership.set(row.membership_id, list);
  }

  return rows.map((row) => {
    const club = (row as unknown as {
      clubs: {
        id: number; slug: string; name: string; city: string; logo_url: string | null;
        club_membership_tiers: Parameters<typeof toMembershipTiers>[0];
      };
    }).clubs;

    const tiers = toMembershipTiers(club.club_membership_tiers ?? []);
    const mine = tiers.find((tier) => tier.key === row.tier_key) ?? null;
    const paid = byMembership.get(row.id) ?? [];

    return {
      membershipId: row.id,
      status: row.status as MyClubMembership["status"],
      club: {
        id: club.id, slug: club.slug, name: club.name,
        city: club.city, logoUrl: club.logo_url,
      },
      tierKey: row.tier_key,
      tierLabel: mine?.label ?? null,
      joinedAt: row.joined_at,
      requestedAt: row.created_at,
      declineReason: row.decline_reason,
      requestedTierKey: row.requested_tier_key,
      requestedTierLabel:
        tiers.find((tier) => tier.key === row.requested_tier_key)?.label ?? null,
      requestedAtTier: row.tier_requested_at,
      payments: paid,
      standing: standing(paid, row.tier_key, row.tier_assigned_at),
      tiers,
    };
  });
}

/**
 * Ask a club to move you up a tier, or withdraw the ask by passing null.
 *
 * The club is told by email and acts on it from its members list, where tier
 * changes already happen. Nothing about the membership changes here: this is a
 * request, and the club's answer is the club's.
 */
export async function requestTierChange(
  membershipId: number,
  profileId: string,
  tierKey: string | null,
): Promise<{ error?: string; notice?: string }> {
  const mine = (await getMyMemberships(profileId))
    .find((m) => m.membershipId === membershipId);

  if (!mine || mine.status !== "approved") {
    return { error: "You are not an approved member of that club." };
  }

  const wanted = tierKey ? mine.tiers.find((tier) => tier.key === tierKey) ?? null : null;
  if (tierKey && !wanted) return { error: "That club does not offer that tier." };

  try {
    await requestTier(membershipId, tierKey);
  } catch (error) {
    console.error("tier request failed", { membershipId, tierKey, error });
    return { error: "Could not send that request. Try again." };
  }

  if (!wanted) return { notice: "Request withdrawn." };

  // Told, not blocked on: the request is already recorded, and a club with no
  // owner on file has nobody to email.
  const club = await findClubBasics(mine.club.id).catch(() => null);
  const me = await findProfileById(profileId).catch(() => null);
  await notifyTierRequested({
    ownerId: club?.owner_id ?? null,
    clubName: mine.club.name,
    clubSlug: mine.club.slug,
    memberName: me?.full_name || "A member",
    tierLabel: wanted.label,
  }).catch(() => undefined);

  return { notice: `${mine.club.name} has been asked about ${wanted.label}.` };
}
