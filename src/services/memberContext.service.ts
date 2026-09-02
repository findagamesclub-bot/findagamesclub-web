import "server-only";

import * as repo from "@/repositories/memberContext.repository";
import { londonToday } from "./bookingCalendar.service";

export type SharedClub = {
  /** The grudge tracker reads past RLS by club id, so it is carried here. */
  id: number;
  slug: string;
  name: string;
  logoUrl: string | null;
  tierLabel: string | null;
  joinedAt: string | null;
  /** Whole years, for "member for 2 years". */
  years: number;
};

export type Meeting = {
  id: number;
  club: { slug: string; name: string; logoUrl: string | null };
  date: string;
  title: string;
  myScore: number | null;
  theirScore: number | null;
  myArmy: string;
  theirArmy: string;
  outcome: "won" | "lost" | "drew" | null;
  played: boolean;
};

export type EventAttendance = {
  id: number;
  club: { slug: string; name: string };
  title: string;
  href: string;
  date: string | null;
  time: string | null;
  tickets: number;
  /** Separate trips through checkout for the same event. */
  bookings: number;
  past: boolean;
};

export type MemberContext = {
  clubs: SharedClub[];
  events: EventAttendance[];
  meetings: Meeting[];
  record: { played: number; won: number; drawn: number; lost: number };
};

/**
 * One row per event, not per trip through checkout.
 *
 * Three bookings for the same day is three rows in the database and one fact
 * to a reader: they are going to the Autumn Open. Legacy lists them
 * separately, which reads as a duplicate rather than as three purchases.
 */
function byEvent(rows: {
  booking_id: number; club_slug: string; club_name: string;
  event_legacy_id: string; event_title: string;
  start_date: string | null; start_time: string | null;
  tickets: number; is_past: boolean;
}[]): EventAttendance[] {
  const events = new Map<string, EventAttendance>();

  for (const row of rows) {
    const key = `${row.club_slug}:${row.event_legacy_id}`;
    const seen = events.get(key);

    if (seen) {
      seen.tickets += row.tickets;
      seen.bookings += 1;
      continue;
    }

    events.set(key, {
      id: row.booking_id,
      club: { slug: row.club_slug, name: row.club_name },
      title: row.event_title,
      href: `/clubs/${row.club_slug}/events/${row.event_legacy_id}`,
      date: row.start_date,
      time: row.start_time,
      tickets: row.tickets,
      bookings: 1,
      past: row.is_past,
    });
  }

  // The function already ordered them; the map keeps that.
  return [...events.values()];
}

const yearsSince = (iso: string | null) => {
  if (!iso) return 0;
  const from = new Date(iso).getTime();
  if (Number.isNaN(from)) return 0;
  return Math.max(0, Math.floor((Date.now() - from) / (365.25 * 86_400_000)));
};

/**
 * What one member can see about another: the clubs they share, and their own
 * record against them.
 *
 * The record is deliberately mutual rather than a copy of the other person's
 * whole history. "You have beaten Joe four times" is the useful fact and it
 * belongs to both of them; Joe's results against everybody else are his.
 */
export async function getMemberContext(
  viewerId: string,
  memberId: string,
): Promise<MemberContext> {
  const [memberships, events, games] = await Promise.all([
    repo.findTheirMemberships(memberId).catch(() => []),
    repo.findEventHistory(memberId).catch(() => []),
    viewerId === memberId
      ? Promise.resolve([])
      : repo.findGamesBetween(viewerId, memberId).catch(() => []),
  ]);

  const today = londonToday();

  const clubs: SharedClub[] = memberships.map((row) => {
    const club = (row as unknown as {
      clubs: {
        id: number; slug: string; name: string; logo_url: string | null;
        club_membership_tiers: { tier_key: string; label: string }[];
      };
    }).clubs;

    return {
      id: club.id,
      slug: club.slug,
      name: club.name,
      logoUrl: club.logo_url,
      tierLabel:
        club.club_membership_tiers?.find((tier) => tier.tier_key === row.tier_key)?.label
        ?? null,
      joinedAt: row.joined_at,
      years: yearsSince(row.joined_at),
    };
  });

  const meetings: Meeting[] = games.map((row) => {
    const club = (row as unknown as {
      clubs: { slug: string; name: string; logo_url: string | null };
    }).clubs;
    const iBooked = row.booked_by === viewerId;
    const myScore = iBooked ? row.booked_by_score : row.opponent_score;
    const theirScore = iBooked ? row.opponent_score : row.booked_by_score;

    return {
      id: row.id,
      club: { slug: club.slug, name: club.name, logoUrl: club.logo_url },
      date: row.session_date,
      title: row.game_title || "Table booking",
      myScore,
      theirScore,
      myArmy: iBooked ? row.booked_by_army : row.opponent_army,
      theirArmy: iBooked ? row.opponent_army : row.booked_by_army,
      outcome: myScore === null || theirScore === null
        ? null
        : myScore > theirScore ? "won" : myScore < theirScore ? "lost" : "drew",
      played: row.session_date <= today,
    };
  });

  const record = meetings.reduce(
    (total, game) => ({
      played: total.played + (game.outcome ? 1 : 0),
      won: total.won + (game.outcome === "won" ? 1 : 0),
      drawn: total.drawn + (game.outcome === "drew" ? 1 : 0),
      lost: total.lost + (game.outcome === "lost" ? 1 : 0),
    }),
    { played: 0, won: 0, drawn: 0, lost: 0 },
  );

  return {
    clubs,
    events: byEvent(events),
    meetings,
    record,
  };
}
