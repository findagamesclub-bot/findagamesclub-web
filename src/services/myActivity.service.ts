import "server-only";

import { needsQuote } from "@/utils/merch-bag";

import { findMyCoaching, findMyOrders, findOpenSlots } from "@/repositories/myActivity.repository";
import { londonToday } from "./bookingCalendar.service";

type Club = { slug: string; name: string; logo_url: string | null };

export type MyCoaching = {
  id: number;
  club: { slug: string; name: string; logoUrl: string | null };
  title: string;
  description: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  price: string | null;
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
  saved: number;
  tierLabel: string | null;
  items: {
    id: number; name: string; quantity: number; lineTotal: number;
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
export async function getMyCoaching(profileId: string): Promise<MyCoaching[]> {
  const rows = await findMyCoaching(profileId);
  const today = londonToday();

  return rows
    .map((row) => {
      const slot = (row as unknown as {
        club_coaching_slots: {
          id: number; title: string; description: string | null; slot_date: string;
          start_time: string | null; end_time: string | null; price: string | null;
          coaching_type: string | null; capacity: number | null; clubs: Club;
        };
      }).club_coaching_slots;

      return {
        id: row.id,
        club: {
          slug: slot.clubs.slug,
          name: slot.clubs.name,
          logoUrl: slot.clubs.logo_url,
        },
        title: slot.title,
        description: slot.description ?? "",
        date: slot.slot_date,
        startTime: slot.start_time,
        endTime: slot.end_time,
        price: slot.price,
        kind: slot.coaching_type === "one-to-one"
          ? "1:1"
          : `${slot.capacity ?? 0} seats`,
        status: row.status,
        paid: row.payment_status === "paid",
        cancelled: row.status === "cancelled",
        past: slot.slot_date < today,
      };
    })
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
        id: number; name: string; price: string | null;
        quantity: number; line_total: number;
      }[] | null;
    }).club_merchandise_order_items ?? [];

    return {
      id: row.id,
      club: { slug: club.slug, name: club.name, logoUrl: club.logo_url },
      status: row.status,
      placedAt: row.created_at,
      updatedAt: row.status_updated_at,
      total: Number(row.total ?? 0),
      // What the tier and the points took off, said once rather than twice.
      saved: Number(row.tier_discount_amount ?? 0) + Number(row.loyalty_discount ?? 0),
      tierLabel: row.membership_tier_label,
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        lineTotal: Number(item.line_total ?? 0),
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
        logoUrl: slot.clubs.logo_url,
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
