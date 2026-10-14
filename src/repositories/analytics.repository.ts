import "server-only";

import { callRpc } from "@/lib/supabase/table";

/**
 * The owner's dashboard, read from SQL rather than assembled here.
 *
 * Legacy builds the same 24 sections in about 1,190 lines of Python by pulling
 * a year of rows into memory and counting them. At a club a few seasons in that
 * is the whole history over the wire to put six numbers on a screen, so 0117
 * counts in the database and these just carry the answers across.
 *
 * Every function is guarded by `club_can(club, 'analytics.view')`, which is
 * owner and manager but not helper. A refusal arrives as NOT_PERMITTED.
 */

export type Money = { gross: number; net: number; loyalty?: number; tier?: number };

export type AnalyticsSummary = {
  members: number; newMembers: number; activeMembers: number;
  /** Turned up without joining. 0119 split these out of `activeMembers`. */
  activeVisitors: number;
  tableBookings: number; eventTickets: number; posts: number; replies: number;
  activeRate: number;
};

export type AnalyticsMoney = {
  membership: Money; tables: Money; tickets: Money; shop: Money;
  /** 0186. A club selling coaching was reading a revenue figure short by it. */
  coaching: Money;
  points: { earned: number; spent: number };
};

export type Named = { name: string; value: number };

export type AnalyticsPeople = {
  mostActive: Named[]; droppedOff: Named[]; dormant: Named[];
  droppedOffCount: number; dormantCount: number;
};

export type AnalyticsNights = {
  nights: { label: string; bookings: number }[];
  weekdays: { label: string; position: number; bookings: number }[];
  games: { label: string; played: number }[];
  sellThrough: { label: string; starts: string; places: number; sold: number }[];
};

/**
 * One calendar month of the chosen window, clipped to it.
 *
 * The streams come back separately (0186) rather than pre-added, so the chart,
 * the page and the spreadsheet cannot disagree about what revenue includes.
 * `monthRevenue` is the one place they are summed.
 */
export type AnalyticsMonth = {
  month_start: string; label: string; new_members: number;
  bookings: number; tickets: number; posts: number;
  membership_in: number; tables_in: number; tickets_in: number;
  shop_in: number; coaching_in: number;
};

export type AnalyticsMemberships = {
  /** One row per tier on the roster, with the club's own label for it. */
  byTier: { tier: string; label: string; members: number; joined: number }[];
  /**
   * Every approved member's lifetime points, zero included. The rungs are not
   * worked out here: `tierFor` in TypeScript is the one implementation of the
   * ladder and the club's own tiers are the jsonb it reads, so a second copy
   * in SQL would be a second thing to get wrong.
   */
  lifetime: number[];
  dueSoon: number; lapsed: number; neverPaid: number; total: number;
  /** Approved members who joined inside the window. */
  joined: number;
};

export type AnalyticsSales = {
  items: { label: string; sold: number; revenue: number }[];
  sessions: { label: string; booked: number; revenue: number }[];
  itemsSold: number;
  placesTaken: number;
};

const window = (club: number, from: string, to: string) =>
  ({ p_club: club, p_from: from, p_to: to });

export const findSummary = (club: number, from: string, to: string) =>
  callRpc<AnalyticsSummary>("club_analytics_summary", window(club, from, to));

export const findMoney = (club: number, from: string, to: string) =>
  callRpc<AnalyticsMoney>("club_analytics_money", window(club, from, to));

export const findPeople = (club: number, from: string, to: string) =>
  callRpc<AnalyticsPeople>("club_analytics_people", window(club, from, to));

export const findNights = (club: number, from: string, to: string) =>
  callRpc<AnalyticsNights>("club_analytics_nights", window(club, from, to));

export const findMonths = (club: number, from: string, to: string) =>
  callRpc<AnalyticsMonth[]>("club_analytics_months", window(club, from, to));

export const findMembershipHealth = (club: number, from: string, to: string) =>
  callRpc<AnalyticsMemberships>("club_analytics_memberships", window(club, from, to));

export const findSales = (club: number, from: string, to: string) =>
  callRpc<AnalyticsSales>("club_analytics_sales", window(club, from, to));
