import "server-only";

import * as repo from "@/repositories/featuredRequests.repository";
import * as plans from "@/repositories/listingPlan.repository";
import { billingRefusal } from "@/utils/billing-refusals";

export type BillingResult = { ok: true } | { ok: false; error: string };

export type FeaturedRequest = {
  id: number;
  clubId: number;
  status: "pending" | "booked" | "declined" | "withdrawn";
  preferredFrom: string | null;
  note: string;
  createdAt: string;
  answeredAt: string | null;
  declineReason: string;
  slotId: number | null;
  club: { slug: string; name: string; city: string } | null;
};

function shape(row: repo.FeaturedRequestRow): FeaturedRequest {
  return {
    id: row.id,
    clubId: row.club_id,
    status: (row.status as FeaturedRequest["status"]) ?? "pending",
    preferredFrom: row.preferred_from,
    note: row.note ?? "",
    createdAt: row.created_at,
    answeredAt: row.answered_at,
    declineReason: row.decline_reason ?? "",
    slotId: row.slot_id,
    club: row.club ?? null,
  };
}

/**
 * What this club has asked for, as the billing panel needs it.
 *
 * Two different questions out of one read. The open asks are work in progress
 * and each needs its own way back out; the latest answered one is only there
 * to carry a decline reason, which is the one thing nothing else on the page
 * says. A booked ask needs no line of its own any more, because the slot it
 * became is now listed above it.
 */
export async function getClubFeaturedAsks(clubId: number) {
  const rows = (await repo.findRequestsForClub(clubId).catch(() => [])).map(shape);
  return {
    // Oldest first: the one that has waited longest is the one being waited on.
    open: rows.filter((row) => row.status === "pending").reverse(),
    answered: rows.find((row) => row.status !== "pending") ?? null,
  };
}

/** Open ones first, oldest of those at the top, which is the order to work in. */
export async function getFeaturedRequests() {
  const rows = await repo.findRequests().catch(() => []);
  const open = rows.filter((r) => r.status === "pending");
  const rest = rows.filter((r) => r.status !== "pending").reverse();
  return [...open, ...rest].map(shape);
}

export async function askToBeFeatured(
  clubId: number, from: string | null, note: string,
): Promise<BillingResult> {
  try {
    await repo.askForFeatured(clubId, from || null, note);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: billingRefusal(error) };
  }
}

export async function withdrawFeatured(id: number): Promise<BillingResult> {
  try {
    await repo.withdrawFeaturedRequest(id);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: billingRefusal(error) };
  }
}

export async function answerFeatured(
  id: number, slotId: number | null, reason: string,
): Promise<BillingResult> {
  try {
    await repo.answerFeaturedRequest(id, slotId, reason);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: billingRefusal(error) };
  }
}

export async function chooseListingPlan(
  clubId: number, interval: string,
): Promise<BillingResult> {
  if (interval !== "monthly" && interval !== "yearly") {
    return { ok: false, error: "Pick monthly or yearly." };
  }
  try {
    await plans.setListingPlan(clubId, interval);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: billingRefusal(error) };
  }
}
