import "server-only";

import * as repo from "@/repositories/clubExtras.repository";

/** Writes for rivalries, the shop and coaching. */

type Result = { ok: true } | { ok: false; error: string };

export async function markRival(clubId: number, rivalId: string): Promise<Result> {
  try {
    await repo.addRival(clubId, rivalId);
    return { ok: true };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    if (raw.includes("club_rivals_once") || raw.includes("23505")) {
      return { ok: false, error: "They are already one of your rivals." };
    }
    if (raw.includes("club_rivals_not_self")) {
      return { ok: false, error: "You cannot be your own rival." };
    }
    return { ok: false, error: "Only members of this club can name a rival." };
  }
}

export async function unmarkRival(rivalRowId: number): Promise<Result> {
  try {
    await repo.dropRival(rivalRowId);
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not remove that rivalry. Try again." };
  }
}

/**
 * Every refusal the function can raise, worded for the person who hit it.
 * Ported from create_merchandise_order (club_store.py:12084).
 */
const ORDER_ERRORS: [string, string][] = [
  ["NOT_ENOUGH_STOCK", "There are not that many left. Lower the quantity and try again."],
  ["SOLD_OUT", "That has sold out."],
  ["NO_MERCH_ACCESS", "Your membership tier does not include club kit."],
  ["TIER_TOO_LOW", "That item is for a higher membership tier."],
  ["MEMBERS_ONLY", "Only approved members of this club can order kit."],
  ["NOT_ENOUGH_POINTS", "You do not have that many points."],
  ["OVER_REDEMPTION_CAP", "Points cannot cover that much of this order."],
  ["NO_REDEMPTION", "This club does not take points off club kit."],
  ["ITEM_NOT_FOUND", "That item is no longer listed."],
  ["NOT_SIGNED_IN", "Sign in to order club kit."],
];

export async function orderMerch(params: {
  itemId: number;
  quantity: number;
  notes: string;
  redeemPoints: number;
}): Promise<Result> {
  try {
    await repo.placeOrder({
      itemId: params.itemId,
      quantity: Math.max(1, Math.min(20, Math.floor(params.quantity))),
      notes: params.notes.trim(),
      redeemPoints: Math.max(0, Math.floor(params.redeemPoints || 0)),
    });
    return { ok: true };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    const known = ORDER_ERRORS.find(([code]) => raw.includes(code));
    return { ok: false, error: known?.[1] ?? "Could not place that order. Try again." };
  }
}

const ORDER_STATUSES = new Set(["placed", "paid", "fulfilled", "cancelled"]);

export async function updateOrder(orderId: number, status: string): Promise<Result> {
  if (!ORDER_STATUSES.has(status)) {
    return { ok: false, error: "Choose a valid order status." };
  }

  try {
    await repo.setOrderStatus(orderId, status);
    return { ok: true };
  } catch {
    return { ok: false, error: "Only the club can change an order." };
  }
}

export async function noteOnOrder(
  orderId: number,
  authorId: string,
  body: string,
): Promise<Result> {
  const clean = body.trim();
  if (!clean) return { ok: false, error: "Write a note before adding it." };
  if (clean.length > 2000) return { ok: false, error: "That note is too long." };

  try {
    await repo.addOrderNote(orderId, authorId, clean);
    return { ok: true };
  } catch {
    return { ok: false, error: "Only the club can add notes to an order." };
  }
}

function coachingError(raw: string): string {
  if (raw.includes("SLOT_FULL")) return "Somebody took the last place while you were deciding.";
  if (raw.includes("SLOT_CLOSED")) return "That slot is no longer open.";
  if (raw.includes("SLOT_PASSED")) return "That slot has already happened.";
  if (raw.includes("MEMBERS_ONLY")) return "Coaching is for approved members of the club.";
  if (raw.includes("23505")) return "You are already booked onto that slot.";
  return "Could not book that slot. Try again.";
}

export async function bookCoaching(slotId: number): Promise<Result> {
  try {
    await repo.bookSlot(slotId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: coachingError(error instanceof Error ? error.message : "") };
  }
}

export async function cancelCoaching(bookingId: number): Promise<Result> {
  try {
    await repo.setBookingState(bookingId, { status: "cancelled" });
    return { ok: true };
  } catch {
    return { ok: false, error: "That booking is not yours to cancel." };
  }
}

export async function markCoachingPaid(bookingId: number, paid: boolean): Promise<Result> {
  try {
    await repo.setBookingState(bookingId, { payment_status: paid ? "paid" : "unpaid" });
    return { ok: true };
  } catch {
    return { ok: false, error: "Only the club records payment." };
  }
}

const SLOT_STATUSES = new Set(["open", "closed", "cancelled"]);

/**
 * The club opens, closes or cancels a slot.
 *
 * Closing stops new bookings but keeps the people already on it; cancelling
 * calls the session off. Neither touches existing bookings, so the club still
 * has the list of who to tell.
 */
export async function setSlotStatus(slotId: number, status: string): Promise<Result> {
  if (!SLOT_STATUSES.has(status)) return { ok: false, error: "Choose a valid slot status." };

  try {
    await repo.setSlotStatus(slotId, status);
    return { ok: true };
  } catch {
    return { ok: false, error: "Only the club can change a coaching slot." };
  }
}

export async function addCoachingSlot(params: {
  clubId: number; title: string; description: string; slotDate: string;
  startTime: string; endTime: string; price: string; coachingType: string; capacity: number;
}): Promise<Result> {
  if (!params.title.trim()) return { ok: false, error: "Give the slot a title." };
  if (!params.slotDate) return { ok: false, error: "Choose a date." };
  if (!params.startTime) return { ok: false, error: "Choose a start time." };

  try {
    await repo.createSlot({ ...params, title: params.title.trim() });
    return { ok: true };
  } catch {
    return { ok: false, error: "Only the club can add coaching slots." };
  }
}
