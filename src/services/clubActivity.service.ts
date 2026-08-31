import "server-only";

import * as repo from "@/repositories/clubActivity.repository";

/**
 * The club's recent activity, newest first.
 *
 * Legacy calls this the activity feed and gates it on member content
 * (detail.js:4194). Four kinds are carried here; legacy's other two are army
 * lists and unit notes, which are Milestone 3.
 *
 * Every kind is timestamped from a real row rather than invented, so an empty
 * feed means nothing has happened rather than that something failed.
 */
export type ActivityKind = "join" | "booking" | "rival" | "result";

export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  at: string;
  who: string;
  what: string;
  href: string | null;
};

const nameOf = (p: { full_name: string | null } | null | undefined) =>
  p?.full_name?.trim() || "A member";

/**
 * The fortnight legacy shows, and its cap (club_store.py:20670). A club that
 * has been busy for years still has a feed you can read: this is what has
 * happened lately, not a permanent log.
 */
const WINDOW_DAYS = 14;

export async function getRecentActivity(
  clubId: number,
  slug: string,
  limit = 18,
): Promise<ActivityItem[]> {
  // A failure in one kind should cost that kind, not the whole feed.
  const settle = async <T>(work: Promise<T>, fallback: T): Promise<T> => {
    try {
      return await work;
    } catch {
      return fallback;
    }
  };

  const [joins, bookings, rivals, results] = await Promise.all([
    settle(repo.findJoins(clubId, limit), []),
    settle(repo.findRecentBookings(clubId, limit), []),
    settle(repo.findRecentRivals(clubId, limit), []),
    settle(repo.findRecentResults(clubId, limit), []),
  ]);

  const items: ActivityItem[] = [
    ...joins.map((row) => {
      const person = (row as unknown as { profiles: { full_name: string | null } }).profiles;
      return {
        id: `join-${row.id}`,
        kind: "join" as const,
        at: row.joined_at as string,
        who: nameOf(person),
        what: "joined the club",
        href: row.profile_id ? `/members/${row.profile_id}` : null,
      };
    }),

    ...bookings.map((row) => {
      const person = (row as unknown as { profiles: { full_name: string | null } }).profiles;
      return {
        id: `booking-${row.id}`,
        kind: "booking" as const,
        at: row.created_at,
        who: nameOf(person),
        what: row.game_title
          ? `booked a table for ${row.game_title}`
          : "booked a table",
        href: `/clubs/${slug}/bookings`,
      };
    }),

    ...rivals.map((row) => {
      const r = row as unknown as {
        profiles: { full_name: string | null };
        rival: { full_name: string | null };
      };
      return {
        id: `rival-${row.id}`,
        kind: "rival" as const,
        at: row.created_at,
        who: nameOf(r.profiles),
        what: `named ${nameOf(r.rival)} a rival`,
        href: `/clubs/${slug}/members`,
      };
    }),

    ...results.map((row) => {
      const event = (row as unknown as {
        club_events: { legacy_id: string; title: string; start_date: string | null };
      }).club_events;
      return {
        id: `result-${row.id}`,
        kind: "result" as const,
        // Results carry no timestamp of their own, so the event's date is the
        // honest one: it is when the thing being reported happened.
        at: event.start_date ?? "",
        who: row.member_name?.trim() || "A member",
        what: `took ${row.placement?.trim() || `#${row.rank}`} at ${event.title}`,
        href: `/clubs/${slug}/events/${event.legacy_id}`,
      };
    }),
  ];

  // Compared as dates, not instants: event results carry a date with no time,
  // and the whole cutoff day should count either way.
  const cutoff = new Date(Date.now() - WINDOW_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);

  return items
    .filter((item) => item.at && item.at.slice(0, 10) >= cutoff)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
}
