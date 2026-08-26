import "server-only";

import * as repo from "@/repositories/tickets.repository";
import { ticketBlockedReason } from "@/utils/ticket-eligibility";
import { formatPrice } from "@/utils/format";
import { amountOf, priceCart } from "@/utils/cart-pricing";
import { checkoutError } from "@/utils/checkout-errors";
import { toMembershipTiers, type TierRow } from "@/utils/membership-tiers";
import { getMyMembership } from "./memberships.service";
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
  const ids = params.ticketTypes.map((t) => t.id);

  const [taken, cartRows] = await Promise.all([
    repo.findTicketsTaken(ids),
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
}): Promise<{ ok: true; reference: string } | { ok: false; error: string }> {
  const fullName = params.fullName.trim();
  const email = params.email.trim().toLowerCase();

  if (!fullName) return { ok: false, error: "Name is required to complete checkout." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address to complete checkout." };
  }

  // The discount is worked out here, not read off the form. A percentage the
  // browser could name is a percentage the browser could choose.
  const event = await repo.findEventClub(params.eventId);
  if (!event) return { ok: false, error: "That event no longer exists." };

  const club = (event as unknown as {
    clubs: { id: number; club_membership_tiers: TierRow[] | null };
  }).clubs;

  const tiers = toMembershipTiers(club.club_membership_tiers ?? []);
  const membership = await getMyMembership(club.id, params.profileId);
  const tier =
    membership.status === "approved"
      ? tiers.find((t) => t.key === membership.tierKey) ?? null
      : null;

  const reference = makeReference();

  try {
    await repo.checkout({
      eventId: params.eventId,
      fullName,
      email,
      reference,
      discountPercent: eventDiscountOf(tier),
      tierKey: tier?.key ?? null,
      tierLabel: tier?.label ?? "",
    });
    return { ok: true, reference };
  } catch (error) {
    return { ok: false, error: checkoutError(error instanceof Error ? error.message : "") };
  }
}
