import "server-only";

import { getClubTeam } from "./clubTeam.service";
import { getClubRenewals } from "./renewals.service";
import { getClubResults } from "./clubResults.service";
import { getUnlinkedNames, getMatchedNames } from "./memberRecords.service";
import { getCoaching, getOrders } from "./clubExtras.service";
import { getClubEventsPage } from "./events.service";
import { getEventBookingCounts } from "./eventBookings.service";
import { getManagedCompetitions } from "./competitions.service";
import { getBoardPulse } from "./discussions.service";
import { getLoyaltyFlow, getStandings } from "./loyalty.service";
import { getClubPulse } from "./clubPulse.service";
import { londonToday } from "./bookingCalendar.service";
import { countRenewals } from "@/utils/renewal-filter";
import { countUnanswered } from "@/utils/club-order-filter";
import { countByMonth } from "@/utils/club-pulse";
import type { ClubAccess, Capability } from "@/utils/club-access";
import type { MembershipTier } from "@/types/clubDetail";

/**
 * One summary per section of the console, for the overview.
 *
 * The rail says where the sections are. This says how each of them is going,
 * so an owner can answer "what needs me" and "is any of this working" without
 * opening twelve pages. Every card links to the section it summarises, where
 * the full chart lives.
 *
 * Twelve small reads on one page, every one caught on its own. That is a lot
 * for a page in the abstract and the right amount for this one: it is opened
 * by the handful of people who run a club, and its whole purpose is to save
 * them the twelve visits.
 */

export type WidgetSplit = { key: string; label: string; value: number; color: string };

/**
 * The picture each card draws.
 *
 * Chosen per section rather than one shape for all twelve: a run of months, a
 * shape over time, a proportion with a finish line, a state, and a ranking are
 * five different questions, and drawing them the same way makes a page of
 * bars nobody reads. Neighbouring cards never use the same one.
 */
export type WidgetChart =
  | { kind: "columns"; labels: string[]; values: number[] }
  | { kind: "area"; labels: string[]; series: { name: string; color: string; values: number[] }[] }
  | { kind: "gauge"; percent: number; done: number; left: number;
      doneLabel: string; leftLabel: string }
  | { kind: "ranked"; rows: { label: string; value: number }[] }
  | { kind: "split"; parts: WidgetSplit[] };

export type SectionWidget = {
  key: string;
  group: string;
  label: string;
  href: string;
  needs: Capability;
  /** The one figure the card is about. */
  value: string;
  /** What is behind the figure. Never left blank. */
  note: string;
  /** Marks a figure that wants acting on rather than merely reporting. */
  emphasis?: boolean;
  chart?: WidgetChart;
};

const TONE = {
  ink: "#101B2D", muted: "#4E5F79", rule: "#DCE3EC",
  brass: "#B8862B", good: "#1D6F4A", bad: "#B3261E", brand: "#174B8A",
} as const;

export async function getSectionWidgets(
  clubId: number, slug: string, access: ClubAccess, tiers: MembershipTier[],
  colour: string,
): Promise<SectionWidget[]> {
  const today = londonToday();
  const at = (path: string) => `/clubs/${slug}${path}`;
  const can = (c: Capability) => access.can(c);

  // Only what this viewer may act on. A helper's console must not run a
  // renewals query at them, let alone draw the answer.
  const [
    team, pulse, renewals, results, unmatched, matched,
    coaching, upcoming, sales, competitions, board, orders, loyalty, standings,
  ] = await Promise.all([
    can("team.manage") ? getClubTeam(clubId).catch(() => null) : null,
    getClubPulse(clubId, tiers, today).catch(() => null),
    can("members.manage") ? getClubRenewals(clubId, tiers).catch(() => []) : [],
    can("results.manage") ? getClubResults(clubId).catch(() => []) : [],
    can("members.manage") ? getUnlinkedNames(clubId).catch(() => []) : [],
    can("members.manage") ? getMatchedNames(clubId).catch(() => []) : [],
    can("coaching.manage") ? getCoaching(clubId, null, today).catch(() => null) : null,
    can("events.manage")
      ? getClubEventsPage(clubId, { past: false, page: 1 }).catch(() => ({ events: [], total: 0 }))
      : { events: [], total: 0 },
    can("events.manage") ? getEventBookingCounts(clubId).catch(() => new Map()) : new Map(),
    can("competitions.manage") ? getManagedCompetitions(clubId).catch(() => []) : [],
    can("board.moderate") ? getBoardPulse(clubId, today).catch(() => null) : null,
    can("shop.manage") ? getOrders(clubId).catch(() => []) : [],
    can("members.manage") ? getLoyaltyFlow(clubId, today).catch(() => []) : [],
    can("members.manage") ? getStandings(clubId).catch(() => []) : [],
  ]);

  const widgets: SectionWidget[] = [];
  const add = (w: SectionWidget) => { if (can(w.needs)) widgets.push(w); };

  // ------------------------------------------------------------------- people
  //
  // Team leads the group rather than sitting in one of its own. The rail's
  // "Your club" holds the overview and the team, and the overview is this
  // page, so a group here would have been a single card against two thirds of
  // a row of nothing.
  if (team) {
    const helping = team.managers.length + team.helpers.length;
    add({
      key: "team", group: "People", label: "Team", href: at("/manage/team"),
      needs: "team.manage",
      value: String(1 + helping),
      note: helping
        ? `${helping} ${helping === 1 ? "person helps" : "people help"} you run it`
        : "Only you, so far",
      chart: { kind: "split", parts: [
        { key: "o", label: "Owner", value: 1, color: TONE.brand },
        { key: "m", label: "Managers", value: team.managers.length, color: TONE.brass },
        { key: "h", label: "Helpers", value: team.helpers.length, color: TONE.muted },
      ] },
    });
  }

  if (pulse) {
    add({
      key: "members", group: "People", label: "Members", href: at("/members"),
      needs: "members.manage",
      value: String(pulse.members.total),
      note: pulse.members.joinedInWindow
        ? `${pulse.members.joinedInWindow} joined in the last year`
        : "Nobody new in the last year",
      chart: { kind: "area", labels: pulse.months.map((m) => m.label),
               series: [{ name: "Joined", color: colour,
                          values: pulse.months.map((m) => m.joined) }] },
    });
  }

  if (renewals.length) {
    const c = countRenewals(renewals);
    add({
      key: "renewals", group: "People", label: "Renewals", href: at("/members/renewals"),
      needs: "members.manage",
      value: c.due ? String(c.due) : "All paid",
      note: c.due
        ? `owing, of ${plural(c.all, "member")}`
        : `${plural(c.all, "membership")} up to date`,
      emphasis: c.due > 0,
      chart: { kind: "split", parts: [
        { key: "paid", label: "Paid", value: c.paid, color: TONE.good },
        { key: "exp", label: "Expiring", value: c.expiring, color: TONE.brass },
        { key: "due", label: "Due", value: c.due, color: "#A8542A" },
        { key: "over", label: "Overdue", value: c.overdue, color: TONE.bad },
      ] },
    });
  }

  // -------------------------------------------------------------- club nights
  if (pulse) {
    add({
      key: "bookings", group: "Club nights", label: "Table bookings", href: at("/bookings"),
      needs: "bookings.manage",
      value: String(pulse.tables.total),
      note: monthNote(pulse.tables),
      chart: { kind: "columns", labels: pulse.months.map((m) => m.label),
               values: pulse.months.map((m) => m.tables) },
    });
  }

  if (results.length) {
    const ruled = results.filter((r) => r.confirmation === "admin-confirmed").length;
    const waiting = results.filter(
      (r) => r.recorded && r.confirmation !== "admin-confirmed").length;
    const blank = results.filter((r) => !r.recorded).length;
    add({
      key: "scores", group: "Club nights", label: "Scores", href: at("/manage/scores"),
      needs: "results.manage",
      // A game with no score on it is not settled, so it cannot be counted as
      // "all ruled" while the gauge beside it says otherwise. The headline and
      // the arc now measure the same thing.
      value: waiting ? String(waiting) : blank ? String(blank) : "All settled",
      note: waiting
        ? `waiting on you, of ${plural(results.length, "game")} played`
        : blank
          ? `${blank === 1 ? "game has" : "games have"} no score yet, of ${results.length} played`
          : `${plural(results.length, "game")}, every one settled`,
      emphasis: waiting > 0,
      chart: { kind: "gauge",
               percent: (ruled / Math.max(1, results.length)) * 100,
               done: ruled, left: waiting + blank,
               doneLabel: "settled", leftLabel: "open" },
    });
  }

  if (unmatched.length || matched.length) {
    const total = unmatched.length + matched.length;
    add({
      key: "match", group: "Club nights", label: "Match old results",
      href: at("/manage/results"), needs: "members.manage",
      value: `${Math.round((matched.length / Math.max(1, total)) * 100)}%`,
      note: unmatched.length
        ? `matched, ${unmatched.length} still a name only`
        : "matched, nothing left to do",
      chart: { kind: "split", parts: [
        { key: "done", label: "Matched", value: matched.length, color: TONE.good },
        { key: "left", label: "Name only", value: unmatched.length, color: TONE.brass },
      ] },
    });
  }

  if (coaching?.slots.length) {
    const live = coaching.slots.filter((s) => s.status === "open");
    const taken = live.reduce((n, s) => n + s.taken, 0);
    const free = live.reduce((n, s) => n + s.spacesLeft, 0);
    add({
      key: "coaching", group: "Club nights", label: "Coaching", href: at("/coaching"),
      needs: "coaching.manage",
      value: `${taken}`,
      note: free
        ? `seats booked, ${free} still free`
        : "seats booked, and every one taken",
      chart: { kind: "gauge",
               percent: (taken / Math.max(1, taken + free)) * 100,
               done: taken, left: free,
               doneLabel: "booked", leftLabel: "free" },
    });
  }

  // ------------------------------------------------------------------- events
  if (upcoming.total || sales.size) {
    const tickets = [...sales.values()].reduce((n, s) => n + s.tickets, 0);
    add({
      key: "events", group: "Events", label: "Events", href: at("/events"),
      needs: "events.manage",
      value: String(upcoming.total),
      note: tickets
        ? `coming up, ${plural(tickets, "ticket")} sold`
        : "coming up, no tickets sold yet",
      chart: upcoming.events.length
        ? { kind: "ranked", rows: upcoming.events
              .map((e) => ({ label: e.title, value: sales.get(e.id)?.tickets ?? 0 }))
              .sort((a, b) => b.value - a.value) }
        : undefined,
    });
  }

  if (competitions.length) {
    const running = competitions.filter((c) => !c.isCompleted).length;
    const players = competitions.reduce((n, c) => n + c.standings.length, 0);
    add({
      key: "competitions", group: "Events", label: "Competitions",
      href: at("/competitions/manage"), needs: "competitions.manage",
      value: String(running),
      note: `running, ${plural(players, "player")} across ${competitions.length}`,
      chart: { kind: "ranked", rows: competitions
                 .map((c) => ({ label: c.title, value: c.standings.length }))
                 .sort((a, b) => b.value - a.value) },
    });
  }

  // ---------------------------------------------------------------- community
  if (board) {
    const started = board.started.reduce((n, m) => n + m.value, 0);
    const thisMonth = board.started.at(-1)?.value ?? 0;
    add({
      key: "board", group: "Community", label: "Board", href: at("/board"),
      needs: "board.moderate",
      value: String(started),
      note: thisMonth
        ? `threads this year, ${thisMonth} this month`
        : "threads this year, none this month",
      chart: { kind: "area", labels: board.started.map((m) => m.label),
               series: [{ name: "Threads", color: colour,
                          values: board.started.map((m) => m.value) }] },
    });
  }

  if (orders.length) {
    const waiting = countUnanswered(orders);
    add({
      key: "shop", group: "Community", label: "Shop", href: at("/shop"),
      needs: "shop.manage",
      value: waiting ? String(waiting) : "All answered",
      note: waiting
        ? `to answer, of ${plural(orders.length, "order")}`
        : `${plural(orders.length, "order")}, nothing outstanding`,
      emphasis: waiting > 0,
      chart: { kind: "columns",
               labels: countByMonth(orders.map((o) => o.createdAt), today).map((m) => m.label),
               values: countByMonth(orders.map((o) => o.createdAt), today).map((m) => m.value) },
    });
  }

  if (loyalty.length) {
    const issued = loyalty.reduce((n, m) => n + m.issued, 0);
    const unspent = standings.reduce((n, s) => n + s.available, 0);
    add({
      key: "loyalty", group: "Community", label: "Loyalty", href: at("/loyalty"),
      needs: "members.manage",
      value: unspent.toLocaleString("en-GB"),
      note: issued
        ? `points unspent, ${issued.toLocaleString("en-GB")} issued this year`
        : "points unspent, none issued this year",
      chart: { kind: "area", labels: loyalty.map((m) => m.label), series: [
        { name: "Issued", color: colour, values: loyalty.map((m) => m.issued) },
        { name: "Spent", color: TONE.brass, values: loyalty.map((m) => m.spent) },
      ] },
    });
  }

  return widgets;
}

/** "1 game", "8 games". Written once, because it was wrong in three places. */
function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

function monthNote({ now, before, delta }: { now: number; before: number; delta: number }) {
  if (!before && !now) return "None in the last year";
  if (!before) return `${now} this month, the first in a while`;
  if (delta === 0) return `${now} this month, the same as last`;
  return `${now} this month, ${Math.abs(delta)} ${delta > 0 ? "more" : "fewer"} than last`;
}

/** The rail's own order, so the cards and the navigation read the same way. */
export const WIDGET_GROUPS = ["People", "Club nights", "Events", "Community"];
