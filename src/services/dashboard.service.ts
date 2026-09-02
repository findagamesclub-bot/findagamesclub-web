import "server-only";

import { countUpcoming } from "@/utils/coaching-filter";
import { countWaiting } from "@/utils/order-filter";

import { findMyUpcoming } from "@/repositories/bookings.repository";
import { getMyMemberships, type MyClubMembership } from "./myMemberships.service";
import { getMyBookings } from "./eventBookings.service";
import { getMyAlerts, type SavedAlert } from "./eventAlerts.service";
import { getInbox } from "./messages.service";
import { getMyCoaching, getMyOrders } from "./myActivity.service";
import { getMyGames, type MyGame } from "./games.service";
import { countUnrecorded } from "@/utils/game-filter";
import { getOwnerInbox } from "./ownerInbox.service";
import { getProgramme, getWallet } from "./loyalty.service";
import { londonToday } from "./bookingCalendar.service";
import type { EventBooking } from "@/types/ticket";

export type TableBooking = {
  id: number;
  clubSlug: string;
  clubName: string;
  logoUrl: string | null;
  date: string;
  time: string;
  gameTitle: string;
  /** Who you are down to play, member or guest. Empty when nobody is named. */
  opponentName: string;
  /** What the club will ask for on the night, after tier and points. */
  total: number;
  tierLabel: string | null;
  /** Tonight's table cannot be cancelled, so the button says so rather than failing. */
  isToday: boolean;
};

export type LoyaltyCard = {
  clubSlug: string;
  clubName: string;
  available: number;
  /** Everything ever earned there. Spending points does not reduce it. */
  lifetime: number;
  tierLabel: string | null;
  toNext: number | null;
  progress: number;
};

export type Dashboard = {
  memberships: MyClubMembership[];
  games: MyGame[];
  bookings: TableBooking[];
  tickets: EventBooking[];
  alerts: SavedAlert[];
  unreadMessages: number;
  loyalty: LoyaltyCard[];
};

/** A failure in one panel should cost that panel, not the whole page. */
async function settle<T>(work: Promise<T>, fallback: T): Promise<T> {
  try {
    return await work;
  } catch {
    return fallback;
  }
}

/**
 * Everything the member's dashboard shows, gathered once.
 *
 * The panels are independent, so they are fetched together rather than in the
 * order they happen to be laid out. Loyalty is the exception: it can only be
 * asked club by club, and only for the clubs the member was approved at, which
 * is a handful rather than a list.
 */
export async function getDashboard(profileId: string): Promise<Dashboard> {
  const today = londonToday();

  const [memberships, rawBookings, tickets, alerts, threads, games] = await Promise.all([
    settle(getMyMemberships(profileId), []),
    settle(findMyUpcoming(profileId, today), []),
    settle(getMyBookings(profileId), []),
    settle(getMyAlerts(profileId), []),
    settle(getInbox(profileId), []),
    settle(getMyGames(profileId), []),
  ]);

  const bookings: TableBooking[] = rawBookings.map((row) => {
    const club = (row as unknown as {
      clubs: { slug: string; name: string; logo_url: string | null };
    }).clubs;
    return {
      id: row.id,
      clubSlug: club.slug,
      clubName: club.name,
      logoUrl: club.logo_url,
      date: row.session_date,
      time: row.session_time ?? "",
      gameTitle: row.game_title ?? "",
      opponentName: (row.opponent_name ?? "").trim(),
      total: Number(row.total_price ?? 0),
      tierLabel: row.membership_tier_label || null,
      isToday: row.session_date === today,
    };
  });

  const approved = memberships.filter((m) => m.status === "approved");
  const loyalty = (
    await Promise.all(
      approved.map(async (m) => {
        const programme = await settle(getProgramme(m.club.id), null);
        if (!programme) return null;
        const wallet = await settle(getWallet(m.club.id, profileId), null);
        if (!wallet) return null;
        return {
          clubSlug: m.club.slug,
          clubName: m.club.name,
          available: wallet.available,
          lifetime: wallet.lifetime,
          tierLabel: wallet.tier?.label ?? null,
          toNext: wallet.toNext,
          progress: wallet.progress,
        };
      }),
    )
  ).filter((card): card is LoyaltyCard => card !== null);

  return {
    memberships,
    games,
    bookings,
    tickets,
    alerts,
    unreadMessages: threads.reduce((n, thread) => n + thread.unread, 0),
    loyalty,
  };
}

export type AccountCounts = {
  clubs: number;
  tickets: number;
  bookings: number;
  alerts: number;
  coaching: number;
  orders: number;
  /** Games played with nobody having said what happened. */
  unrecorded: number;
  unreadMessages: number;
  ownsClubs: boolean;
};

/**
 * Just the badge numbers, for the sidebar on every page of the account.
 *
 * Deliberately not getDashboard: that reads payments, tiers and loyalty
 * ledgers, and none of it shows in a nav.
 */
export async function getAccountCounts(profileId: string): Promise<AccountCounts> {
  const [memberships, bookings, tickets, alerts, coaching, orders, threads, owned, games] =
    await Promise.all([
      settle(getMyMemberships(profileId), []),
      settle(findMyUpcoming(profileId, londonToday()), []),
      settle(getMyBookings(profileId), []),
      settle(getMyAlerts(profileId), []),
      settle(getMyCoaching(profileId), []),
      settle(getMyOrders(profileId), []),
      settle(getInbox(profileId), []),
      settle(getOwnerInbox(profileId), []),
      settle(getMyGames(profileId), []),
    ]);

  return {
    clubs: memberships.filter((m) => m.status === "approved").length,
    tickets: tickets.filter((t) => t.status !== "cancelled").length,
    bookings: bookings.length,
    alerts: alerts.length,
    // Only what is still to come: a badge counting last winter's sessions
    // would never go down.
    coaching: countUpcoming(coaching),
    // Through countWaiting, not a copy of its rule. The sidebar said 6 while
    // the page said 7 because this counted only `paid` and the page counts
    // anything the club still holds.
    orders: countWaiting(orders),
    unrecorded: countUnrecorded(games),
    unreadMessages: threads.reduce((n, thread) => n + thread.unread, 0),
    ownsClubs: owned.length > 0,
  };
}
