import "server-only";
import { clubLogoUrl } from "@/utils/club-media";
import { publicUrl } from "@/lib/supabase/storage";

import { needsQuote } from "@/utils/merch-bag";

import { findMyCoaching, findMyOrders, findOpenSlots } from "@/repositories/myActivity.repository";
import { londonToday } from "./bookingCalendar.service";
import type { Priced } from "@/utils/price-lines";

type Club = { slug: string; name: string; logo_url: string | null; logo_path: string | null };

export type MyCoaching = {
  id: number;
  club: { slug: string; name: string; logoUrl: string | null };
  title: string;
  description: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  price: string | null;
  /**
   * What this booking actually came to, with the tier and the points that got
   * it there. 0157 freezes all of it and nothing read it, so the card quoted
   * the slot's own list price and a member on 10% off was told to bring the
   * full amount.
   */
  priced: Priced;
  /** "1:1" or a seat count, as the coaching page words it. */
  kind: string;
  status: string;
  paid: boolean;
  cancelled: boolean;
  /** The session has happened. Nothing to do about it either way. */
  past: boolean;
};

export type MyOrder = {
  id: number;
  club: { slug: string; name: string; logoUrl: string | null };
  status: string;
  placedAt: string;
  updatedAt: string | null;
  total: number;
  tierLabel: string | null;
  /**
   * The whole sum. It used to be one `saved` number adding the tier discount
   * and the points together, which the card then printed as "£5.70 off as
   * Premium Membership": a saving the member had paid for out of their own
   * points, credited to the club's tier.
   */
  priced: Priced;
  /** What the member typed for the club when they ordered. */
  notes: string;
  items: {
    id: number; name: string; quantity: number; lineTotal: number;
    /** The size or colour, written onto the line at checkout by 0088. */
    variantLabel: string;
    /** One of them, before the tier came off. */
    unitAmount: number;
    /**
     * The line at full price, which is what the subtotal is built from.
     * `line_total` is already net of the tier discount, so showing it beside a
     * breakdown that then takes the same discount off again made a card whose
     * figures could not be added up: 2 × £15 read "£27" over a £24.30 total.
     */
    grossTotal: number;
    /** The club never named a price for this, so £0 is not what it cost. */
    quoted: boolean;
  }[];
};

/**
 * Coaching this member has booked anywhere, soonest first.
 *
 * Cancelled and past sessions are kept: a member who paid for a session needs
 * the record of it, and legacy's per club page is the only place either has
 * ever been visible.
 */
export async function getMyCoaching(_profileId: string): Promise<MyCoaching[]> {
  // The function reads `auth.uid()` itself, so the id is not passed. It stays
  // on the signature because every caller has one and dropping it would make
  // this the one service here that does not take the person it is about.
  const rows = await findMyCoaching();
  const today = londonToday();

  return rows
    .map((row) => ({
      id: row.booking_id,
      club: {
        slug: row.club_slug,
        name: row.club_name,
        logoUrl: clubLogoUrl(
          { logoPath: row.club_logo_path, logoUrl: row.club_logo_url },
          publicUrl),
      },
      title: row.title,
      description: row.description ?? "",
      date: row.slot_date,
      startTime: row.start_time,
      endTime: row.end_time,
      price: row.price,
      priced: {
        subtotal: Number(row.base_price ?? 0),
        tierLabel: row.tier_label || null,
        tierPercent: Number(row.tier_percent ?? 0),
        tierAmount: Number(row.tier_amount ?? 0),
        points: Number(row.points_spent ?? 0),
        pointsAmount: Number(row.points_amount ?? 0),
        total: Number(row.total_price ?? 0),
        currency: row.price_currency ?? "GBP",
      },
      kind: row.coaching_type === "one-to-one" ? "1:1" : `${row.capacity ?? 0} seats`,
      status: row.status,
      paid: row.payment_status === "paid",
      cancelled: row.status === "cancelled",
      past: row.slot_date < today,
    }))
    // Soonest first among what is still to come; most recent first behind.
    // Cancelled counts as behind: it is not somewhere the member is going.
    .sort((a, b) => {
      const behind = (s: MyCoaching) => Number(s.past || s.cancelled);
      if (behind(a) !== behind(b)) return behind(a) - behind(b);
      return behind(a) ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date);
    });
}

/** Merchandise this member has ordered, newest first. */
export async function getMyOrders(profileId: string): Promise<MyOrder[]> {
  const rows = await findMyOrders(profileId);

  return rows.map((row) => {
    const club = (row as unknown as { clubs: Club }).clubs;
    const items = (row as unknown as {
      club_merchandise_order_items: {
        id: number; name: string; variant_label: string | null; price: string | null;
        quantity: number; unit_amount: number | null; line_total: number;
      }[] | null;
    }).club_merchandise_order_items ?? [];

    return {
      id: row.id,
      club: { slug: club.slug, name: club.name, logoUrl: clubLogoUrl(
        { logoPath: club.logo_path, logoUrl: club.logo_url },
        publicUrl) },
      status: row.status,
      placedAt: row.created_at,
      updatedAt: row.status_updated_at,
      total: Number(row.total ?? 0),
      tierLabel: row.membership_tier_label,
      priced: {
        subtotal: Number(row.subtotal ?? 0),
        tierLabel: row.membership_tier_label || null,
        tierPercent: Number(row.tier_discount_percent ?? 0),
        tierAmount: Number(row.tier_discount_amount ?? 0),
        points: Number(row.loyalty_points_spent ?? 0),
        pointsAmount: Number(row.loyalty_discount ?? 0),
        total: Number(row.total ?? 0),
      },
      notes: row.notes ?? "",
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        variantLabel: (item.variant_label ?? "").trim(),
        quantity: item.quantity,
        unitAmount: Number(item.unit_amount ?? 0),
        lineTotal: Number(item.line_total ?? 0),
        grossTotal: Number(item.unit_amount ?? 0) > 0
          ? Number(item.unit_amount) * item.quantity
          : Number(item.line_total ?? 0),
        // The club listed it as "TBC" or similar, so £0 is not what it cost.
        // The price text is kept on the line at checkout, so an order placed
        // before the club named a price still knows that it had none.
        quoted: needsQuote(item.price),
      })),
    };
  });
}

export type OpenSlot = {
  id: number;
  club: { slug: string; name: string; logoUrl: string | null };
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  price: string | null;
  kind: string;
  placesLeft: number;
};

/**
 * Coaching a member could book, at the clubs they are already in.
 *
 * The page was a receipt: you read it once after booking and never again. A
 * member with three clubs had no way to learn a coach had opened slots without
 * visiting three club pages, so this is what makes the section worth opening.
 *
 * Slots the member is already on are dropped, since those are on the page
 * below already, and so are slots with nothing left.
 */
export async function getOpenCoaching(
  clubIds: number[],
  profileId: string,
): Promise<OpenSlot[]> {
  const rows = await findOpenSlots(clubIds, londonToday());

  return rows.flatMap((row) => {
    const slot = row as unknown as {
      id: number; title: string; slot_date: string;
      start_time: string | null; end_time: string | null; price: string | null;
      coaching_type: string | null; capacity: number | null; clubs: Club;
      club_coaching_bookings: { profile_id: string; status: string }[] | null;
    };

    const live = (slot.club_coaching_bookings ?? []).filter((b) => b.status === "booked");
    if (live.some((booking) => booking.profile_id === profileId)) return [];

    const placesLeft = Math.max(0, (slot.capacity ?? 0) - live.length);
    if (!placesLeft) return [];

    return [{
      id: slot.id,
      club: {
        slug: slot.clubs.slug,
        name: slot.clubs.name,
        logoUrl: clubLogoUrl(
        { logoPath: slot.clubs.logo_path, logoUrl: slot.clubs.logo_url },
        publicUrl),
      },
      title: slot.title,
      date: slot.slot_date,
      startTime: slot.start_time,
      endTime: slot.end_time,
      price: slot.price,
      kind: slot.coaching_type === "one-to-one" ? "1:1" : `${slot.capacity ?? 0} seats`,
      placesLeft,
    }];
  });
}
