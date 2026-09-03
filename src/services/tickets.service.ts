import "server-only";

import * as repo from "@/repositories/tickets.repository";
import { ticketBlockedReason } from "@/utils/ticket-eligibility";
import { formatPrice } from "@/utils/format";
import { amountOf, priceCart } from "@/utils/cart-pricing";
import { checkoutError } from "@/utils/checkout-errors";
import * as extras from "@/repositories/clubExtras.repository";
import * as loyaltyRepo from "@/repositories/loyalty.repository";
import type { TicketStanding } from "@/utils/ticket-pricing";
import type { MembershipTier } from "@/types/clubDetail";
import type { BuyableTicket, CartLine, EventCart } from "@/types/ticket";
import type { EventTicketType } from "@/types/event";

/**
 * Event tickets.
 *
 * Reservations, not sales: nothing takes money, and the booking sits at
 * `reserved` until a later milestone adds payment. Everything money-shaped is
 * still computed and frozen, so when payment arrives the totals are already
 * the ones the buyer agreed to.
 */

/** A reference a person can read down the phone. */
export function makeReference(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `FAGC-${out}`;
}

export async function getBuyableTickets(params: {
  eventId: number;
  ticketTypes: EventTicketType[];
  tiers: MembershipTier[];
  viewerId: string | null;
  canManageClub: boolean;
  isApprovedMember: boolean;
  viewerTierKey: string | null;
}): Promise<{ tickets: BuyableTicket[]; cart: EventCart | null }> {
  const [taken, cartRows] = await Promise.all([
    repo.findTicketsTaken(params.eventId),
    params.viewerId ? repo.findCart(params.eventId, params.viewerId) : Promise.resolve([]),
  ]);

  const inCart = new Map<number, number>();
  for (const row of cartRows) inCart.set(row.ticket_type_id, row.quantity);

  const tickets: BuyableTicket[] = params.ticketTypes.map((t) => {
    const remaining =
      t.quantityAvailable === null ? null : Math.max(t.quantityAvailable - (taken.get(t.id) ?? 0), 0);

    return {
      id: t.id,
      label: t.label,
      price: t.price,
      unitAmount: amountOf(t.price),
      remaining,
      sold: taken.get(t.id) ?? 0,
      soldOut: remaining !== null && remaining <= 0,
      audienceLabel: t.audienceLabel,
      blockedReason: ticketBlockedReason({
        audience: t.audience,
        minimumTierKey: t.minimumTierKey,
        canManageClub: params.canManageClub,
        signedIn: Boolean(params.viewerId),
        isApprovedMember: params.isApprovedMember,
        viewerTierKey: params.viewerTierKey,
        tiers: params.tiers,
      }),
      inCart: inCart.get(t.id) ?? 0,
    };
  });

  if (!cartRows.length) return { tickets, cart: null };

  const lines: CartLine[] = cartRows
    .map((row) => {
      const type = (row as unknown as {
        club_event_ticket_types: { label: string; price: string | null; position: number } | null;
      }).club_event_ticket_types;
      const unit = amountOf(type?.price);
      return {
        ticketTypeId: row.ticket_type_id,
        label: type?.label ?? "Ticket",
        price: formatPrice(type?.price ?? ""),
        unitAmount: unit,
        quantity: row.quantity,
        lineTotal: unit * row.quantity,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  const tier = params.tiers.find((t) => t.key === params.viewerTierKey) ?? null;

  return {
    tickets,
    cart: priceCart({
      lines,
      discountPercent: eventDiscountOf(tier),
      tierLabel: tier?.label ?? null,
    }),
  };
}

/** A tier's event discount. Already clamped when the tier was mapped. */
export function eventDiscountOf(tier: MembershipTier | null): number {
  return tier?.eventDiscountPercent ?? 0;
}

type Result = { ok: true } | { ok: false; error: string };

export async function addToCart(params: {
  eventId: number;
  ticketTypeId: number;
  quantity: number;
}): Promise<Result> {
  const quantity = Math.max(0, Math.min(20, Math.floor(params.quantity)));

  try {
    if (quantity === 0) {
      // Zero is how the stepper says "remove", rather than a separate control.
      return { ok: true };
    }
    await repo.setCartLine({ ...params, quantity });
    return { ok: true };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    if (raw.includes("row-level security")) {
      return { ok: false, error: "Sign in to add tickets." };
    }
    return { ok: false, error: "Could not add that ticket. Try again." };
  }
}

export async function removeFromCart(ticketTypeId: number, profileId: string): Promise<Result> {
  try {
    await repo.removeCartLine(ticketTypeId, profileId);
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not remove that ticket. Try again." };
  }
}

export async function checkout(params: {
  eventId: number;
  profileId: string;
  fullName: string;
  email: string;
  /** What the member asked to spend. 0050 has the final say. */
  redeemPoints?: number;
}): Promise<{ ok: true; reference: string } | { ok: false; error: string }> {
  const fullName = params.fullName.trim();
  const email = params.email.trim().toLowerCase();

  if (!fullName) return { ok: false, error: "Name is required to complete checkout." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address to complete checkout." };
  }

  const reference = makeReference();

  try {
    // The discount, the tier and the redemption are all worked out inside
    // checkout_event_cart now. A percentage the browser could name is a
    // percentage the browser could choose, and the same goes for the points.
    await repo.checkout({
      eventId: params.eventId,
      fullName,
      email,
      reference,
      redeemPoints: Math.max(0, Math.floor(params.redeemPoints ?? 0)),
    });
    return { ok: true, reference };
  } catch (error) {
    return { ok: false, error: checkoutError(error instanceof Error ? error.message : "") };
  }
}

/**
 * What this member may pay for tickets with, for the checkout page.
 *
 * Presentation only. checkout_event_cart recomputes every figure from the
 * club's settings and the member's balance at write time, so nothing assembled
 * here can change what is charged. It exists so the quote on the page and the
 * charge in the database agree.
 *
 * A stranger to the club gets zeroes across the board, which is how the field
 * disappears for them rather than refusing after they have typed a number.
 */
export async function getTicketStanding(params: {
  clubId: number;
  profileId: string;
  subtotal: number;
  currency: string;
  discountPercent: number;
  tierLabel: string | null;
}): Promise<TicketStanding> {
  const [tier, loyalty, points] = await Promise.all([
    extras.findMemberTier(params.clubId, params.profileId),
    loyaltyRepo.findSettings(params.clubId),
    extras.findPointBalance(params.clubId, params.profileId),
  ]);

  const benefits = tier?.benefits as Record<string, unknown> | undefined;

  return {
    subtotal: params.subtotal,
    currency: params.currency,
    discountPercent: params.discountPercent,
    tierLabel: params.tierLabel,
    points,
    pointValue: loyalty?.enabled && loyalty.point_value !== null
      ? Number(loyalty.point_value) : null,
    redemptionCapPercent: Math.max(0, Math.min(100, Math.floor(Number(
      benefits?.loyaltyRedemptionCapPercent ?? 0,
    )) || 0)),
  };
}
