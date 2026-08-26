import "server-only";

import * as repo from "@/repositories/clubExtras.repository";
import * as loyaltyRepo from "@/repositories/loyalty.repository";

import { ticketBlockedReason } from "@/utils/ticket-eligibility";
import { formatPrice } from "@/utils/format";
import type { MembershipTier } from "@/types/clubDetail";
import type { CoachingSlot, MerchItem, MerchOrder, Rivalry, ShopStanding } from "@/types/clubExtras";

/** Rivalries, the club shop and the coaching calendar. */

type Person = { id: string; full_name: string | null } | null;
const nameOf = (p: Person) => p?.full_name?.trim() || "Club member";

export async function getRivals(
  clubId: number,
  viewerId: string,
  roster: { profileId: string; fullName: string }[],
): Promise<Rivalry[]> {
  const rows = await repo.findRivals(clubId);
  const names = new Map(roster.map((m) => [m.profileId, m.fullName]));

  // Marked back, which legacy shows as a two-way rivalry rather than two
  // separate ones. Naming somebody does not need their agreement.
  const theirs = new Set(
    rows.filter((r) => r.rival_id === viewerId).map((r) => r.profile_id),
  );

  return rows
    .filter((r) => r.profile_id === viewerId)
    .map((r) => ({
      id: r.id,
      personId: r.rival_id,
      personName: names.get(r.rival_id) ?? "Club member",
      mutual: theirs.has(r.rival_id),
      since: r.created_at,
    }))
    .sort((a, b) => a.personName.localeCompare(b.personName));
}

/**
 * The club shop.
 *
 * Tier gating reuses the ticket rule rather than a second copy of it — a
 * minimum tier is a minimum tier, whether it guards a ticket or a jumper.
 */
export async function getShop(params: {
  clubId: number;
  tiers: MembershipTier[];
  canManageClub: boolean;
  signedIn: boolean;
  isApprovedMember: boolean;
  viewerTierKey: string | null;
}): Promise<MerchItem[]> {
  const rows = await repo.findMerchandise(params.clubId);

  return rows
    .filter((row) => row.active)
    .map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      description: row.description,
      image: row.image_src ? { src: row.image_src, alt: row.image_alt ?? row.name } : null,
      price: formatPrice(row.price ?? ""),
      stock: row.stock,
      soldOut: row.stock <= 0,
      blockedReason: ticketBlockedReason({
        audience: row.minimum_tier_key ? "members" : "all",
        minimumTierKey: row.minimum_tier_key,
        canManageClub: params.canManageClub,
        signedIn: params.signedIn,
        isApprovedMember: params.isApprovedMember,
        viewerTierKey: params.viewerTierKey,
        tiers: params.tiers,
      }),
    }));
}

/**
 * What the viewer's tier is worth in the shop.
 *
 * Read here so the dialog can show the discount before somebody commits; the
 * function recomputes all of it at order time, so this is presentation only.
 */
export async function getShopStanding(
  clubId: number,
  profileId: string,
): Promise<ShopStanding> {
  const [tier, settings, wallet] = await Promise.all([
    repo.findMemberTier(clubId, profileId),
    loyaltyRepo.findSettings(clubId),
    repo.findPointBalance(clubId, profileId),
  ]);

  const benefits = (tier?.benefits ?? {}) as Record<string, unknown>;
  const clamp = (v: unknown) => Math.max(0, Math.min(100, Math.floor(Number(v ?? 0)) || 0));

  return {
    discountPercent: clamp(benefits.merchandiseDiscountPercent),
    tierLabel: tier?.tier_label ?? null,
    points: wallet,
    pointValue: settings?.enabled && settings.point_value !== null
      ? Number(settings.point_value) : null,
    redemptionCapPercent: clamp(benefits.loyaltyRedemptionCapPercent),
  };
}

export async function getOrders(clubId: number): Promise<MerchOrder[]> {
  const rows = await repo.findOrders(clubId);

  return rows.map((row) => {
    const r = row as unknown as {
      profiles: Person;
      club_merchandise_order_items:
        { name: string; price: string | null; quantity: number; line_total: number }[] | null;
      club_merchandise_order_notes: {
        id: number; body: string; automatic: boolean; created_at: string;
        profiles: Person;
      }[] | null;
    };
    const lines = (r.club_merchandise_order_items ?? []).map((i) => ({
      name: i.name,
      price: formatPrice(i.price ?? ""),
      quantity: i.quantity,
      lineTotal: Number(i.line_total ?? 0),
    }));

    return {
      id: row.id,
      personId: row.profile_id,
      personName: nameOf(r.profiles),
      status: row.status as MerchOrder["status"],
      notes: row.notes,
      log: (r.club_merchandise_order_notes ?? [])
        .map((n) => ({
          id: n.id,
          body: n.body,
          automatic: n.automatic,
          author: nameOf(n.profiles),
          at: n.created_at,
        }))
        .sort((a, b) => a.at.localeCompare(b.at)),
      tierLabel: row.membership_tier_label,
      createdAt: row.created_at,
      lines,
      subtotal: Number(row.subtotal ?? 0),
      discountPercent: row.tier_discount_percent ?? 0,
      discountAmount: Number(row.tier_discount_amount ?? 0),
      pointsSpent: row.loyalty_points_spent ?? 0,
      pointsValue: Number(row.loyalty_discount ?? 0),
      total: Number(row.total ?? 0),
    };
  });
}

/** Just the switch. The club page needs this and nothing else. */
export async function isCoachingOn(clubId: number): Promise<boolean> {
  const settings = await repo.findCoachingSettings(clubId);
  return Boolean(settings?.enabled);
}

export async function getCoaching(clubId: number, viewerId: string | null, from: string) {
  // Sequential on purpose. Slots are members-only and anon has no grant on the
  // table at all, so fetching them alongside the settings threw for every
  // signed-out visitor to a club that has coaching switched off.
  const settings = await repo.findCoachingSettings(clubId);
  if (!settings?.enabled) return { enabled: false as const, intro: null, policy: null, slots: [] };

  const slots = await repo.findSlots(clubId, from);

  const mapped: CoachingSlot[] = slots.map((slot) => {
    const bookings = (slot as unknown as {
      club_coaching_bookings: {
        id: number; profile_id: string; status: string; payment_status: string; profiles: Person;
      }[] | null;
    }).club_coaching_bookings ?? [];

    const live = bookings.filter((b) => b.status === "booked");
    const mine = live.find((b) => b.profile_id === viewerId);

    return {
      id: slot.id,
      title: slot.title,
      description: slot.description,
      date: slot.slot_date,
      startTime: slot.start_time,
      endTime: slot.end_time,
      price: formatPrice(slot.price ?? ""),
      coachingType: slot.coaching_type,
      capacity: slot.capacity,
      taken: live.length,
      spacesLeft: Math.max(0, slot.capacity - live.length),
      status: slot.status as CoachingSlot["status"],
      mine: mine ? { id: mine.id, paid: mine.payment_status === "paid" } : null,
      attendees: live.map((b) => ({
        id: b.id, name: nameOf(b.profiles), paid: b.payment_status === "paid",
      })),
    };
  });

  return {
    enabled: true as const,
    intro: settings.intro_text,
    policy: settings.policy_text,
    slots: mapped,
  };
}
