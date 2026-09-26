import "server-only";

import * as repo from "@/repositories/analytics.repository";
import { periodMonths, periodRange, type PeriodKey } from "@/utils/analytics-period";
import type { ReadKey } from "@/utils/analytics-tabs";

/**
 * How the club is doing.
 *
 * One read, for the tab that is open. The page used to be one long scroll and
 * asked all six questions on every load whether or not anybody reached the
 * sections that used them; now it asks the one it is about to render, and the
 * other five stay at their empty shapes that nothing reads.
 *
 * The read swallows its own failure and answers empty, and `missing` says so.
 * Zeros from a club with nothing on and zeros from a read that threw look
 * identical, and only one of them is the truth.
 */

const NO_SUMMARY: repo.AnalyticsSummary = {
  members: 0, newMembers: 0, activeMembers: 0, activeVisitors: 0,
  tableBookings: 0, eventTickets: 0, posts: 0, replies: 0, activeRate: 0,
};

const NO_MONEY: repo.AnalyticsMoney = {
  membership: { gross: 0, net: 0 }, tables: { gross: 0, net: 0 },
  tickets: { gross: 0, net: 0 }, shop: { gross: 0, net: 0 },
  points: { earned: 0, spent: 0 },
};

const NO_PEOPLE: repo.AnalyticsPeople = {
  mostActive: [], droppedOff: [], dormant: [], droppedOffCount: 0, dormantCount: 0,
};

const NO_NIGHTS: repo.AnalyticsNights = {
  nights: [], weekdays: [], games: [], sellThrough: [],
};

const NO_HEALTH: repo.AnalyticsMemberships = {
  byTier: [], dueSoon: 0, lapsed: 0, neverPaid: 0, total: 0,
};

export type ClubAnalytics = {
  summary: repo.AnalyticsSummary;
  money: repo.AnalyticsMoney;
  people: repo.AnalyticsPeople;
  nights: repo.AnalyticsNights;
  months: repo.AnalyticsMonth[];
  health: repo.AnalyticsMemberships;
  /**
   * How many of the six did not answer. Zeros from a club with no bookings and
   * zeros from a database that has not had 0117 run against it look identical
   * on the page, and the second one is not a quiet month. The page says so
   * rather than presenting an empty dashboard as the truth.
   */
  missing: number;
};

const EMPTY: ClubAnalytics = {
  summary: NO_SUMMARY, money: NO_MONEY, people: NO_PEOPLE,
  nights: NO_NIGHTS, months: [], health: NO_HEALTH, missing: 0,
};

export async function getClubAnalytics(
  club: number, period: PeriodKey, today: string,
  /** The one thing the open tab needs. */
  needs: ReadKey,
  /** Legacy keeps a separate range for the trend, so the page can ask for one. */
  trendPeriod: PeriodKey = period,
): Promise<ClubAnalytics> {
  const { from, to } = periodRange(period, today);

  const read = async <K extends keyof ClubAnalytics>(
    key: K, fetch: () => Promise<ClubAnalytics[K]>,
  ): Promise<ClubAnalytics> => {
    try {
      return { ...EMPTY, [key]: await fetch() };
    } catch {
      // Empty, and counted. The page says a read did not answer rather than
      // showing its zeros as though they were the club's.
      return { ...EMPTY, missing: 1 };
    }
  };

  switch (needs) {
    case "summary": return read("summary", () => repo.findSummary(club, from, to));
    case "money": return read("money", () => repo.findMoney(club, from, to));
    case "people": return read("people", () => repo.findPeople(club, from, to));
    case "nights": return read("nights", () => repo.findNights(club, from, to));
    case "months": return read("months",
      () => repo.findMonths(club, periodMonths(trendPeriod)));
    case "health": return read("health", () => repo.findMembershipHealth(club));
  }
}

/** Gross before discounts, and what actually arrived. Both, never one. */
export function totalMoney(money: repo.AnalyticsMoney) {
  const streams = [money.membership, money.tables, money.tickets, money.shop];
  const add = (pick: (m: repo.Money) => number) =>
    streams.reduce((sum, stream) => sum + Number(pick(stream) ?? 0), 0);

  const gross = add((m) => m.gross);
  const net = add((m) => m.net);
  return { gross, net, discounts: Math.max(gross - net, 0) };
}
