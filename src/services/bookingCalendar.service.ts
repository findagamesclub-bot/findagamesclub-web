import "server-only";

import * as repo from "@/repositories/bookings.repository";
import { benefitsFromRow } from "@/utils/booking-benefits";
import * as extras from "@/repositories/clubExtras.repository";
import { addDays, bookableSessions, generateSessions } from "@/utils/booking-sessions";
import { formatPrice } from "@/utils/format";
import { canonicalGame } from "@/utils/game-label";
import type {
  Booking, BookingCalendar, CalendarSession, ClubScheduleSlot,
} from "@/types/booking";

/**
 * The booking calendar for one club.
 *
 * Legacy rebuilds this per request by reading whole JSON files and scanning 120
 * days (club_store.py:1913). Here it is one windowed query per table, and the
 * sessions are generated rather than stored.
 *
 * Everything the UI needs to grey out a night is computed here, once, so no
 * component has to re-derive a rule and get a different answer.
 */

type BookingRow = Awaited<ReturnType<typeof repo.findBookings>>[number];

type Named = { id: string; full_name: string } | null;

/**
 * One seat on a booking.
 *
 * `isViewer` is per seat, not per booking. A blanket "am I on this" flag was
 * used to decide whether to print "You" in the BOOKER position, so a member who
 * had accepted somebody else's game saw "You v Gulnabi" when the truth was
 * "Gulnabi v You" — the two names swapped round.
 */
function person(
  row: Named, viewerId: string | null, fallbackName = "",
): { profileId: string | null; name: string; isViewer: boolean } | null {
  if (!row && !fallbackName) return null;
  const profileId = row?.id ?? null;
  return {
    profileId,
    name: row?.full_name || fallbackName || "Member",
    isViewer: Boolean(viewerId && profileId === viewerId),
  };
}

/** Today in the club's own terms. The database agrees — see london_today(). */
export function londonToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function toBooking(row: BookingRow, viewerId: string | null, canManage: boolean, today: string): Booking {
  const r = row as BookingRow & { booker: Named; opponent: Named; acceptor: Named };
  const seats = [r.booked_by, r.opponent_profile_id, r.accepted_by];
  const isMine = Boolean(viewerId && seats.includes(viewerId));

  return {
    id: r.id,
    clubSessionId: r.club_session_id,
    date: r.session_date,
    tableIndex: r.table_index,
    gameTitle: canonicalGame(r.game_title),
    notes: r.notes,
    booker: person(r.booker, viewerId) ?? {
      profileId: r.booked_by,
      name: "Member",
      isViewer: Boolean(viewerId && r.booked_by === viewerId),
    },
    opponent: person(r.opponent, viewerId, r.opponent_name),
    acceptor: person(r.acceptor, viewerId),
    source: r.source,
    price: formatPrice(`${r.price_currency} ${r.total_price}`) ?? "",
    isMine,
    // Members may cancel only before the day itself; a manager any time.
    canCancel: canManage || (isMine && r.session_date > today),
    opponentLinked: r.opponent_profile_id !== null,
    // Mirrors edit_booking_details (0057). The member who booked it, not
    // whoever is sitting opposite: the booking is theirs to describe.
    canEdit: canManage || (r.booked_by === viewerId && r.session_date > today),
  };
}

export async function getBookingCalendar(params: {
  clubId: number;
  clubSlug: string;
  clubName: string;
  capacity: number;
  viewerId: string | null;
  isMember: boolean;
  canManage: boolean;
  /** Defaults to the club's configured horizon. */
  days?: number;
}): Promise<BookingCalendar> {
  const today = londonToday();

  const [schedule, bookingSettings, membershipSettings, tier] = await Promise.all([
    repo.findSchedule(params.clubId),
    repo.findBookingSettings(params.clubId),
    repo.findMembershipSettings(params.clubId),
    // The viewer's tier, which used to be passed as null here. Every allowance
    // on this page then came from the club's floor, so a Premium member sold
    // four upcoming bookings was held to the club's two and told it was their
    // tier that said so.
    params.viewerId && params.isMember
      ? extras.findMemberTier(params.clubId, params.viewerId).catch(() => null)
      : Promise.resolve(null),
  ]);

  const benefits = benefitsFromRow(tier?.benefits ?? null, membershipSettings);

  const settings = bookingSettings
    ? {
        price: formatPrice(`${bookingSettings.price_currency} ${bookingSettings.table_booking_price}`) ?? "",
        priceValue: Number(bookingSettings.table_booking_price),
        currency: bookingSettings.price_currency,
        horizonDays: bookingSettings.calendar_horizon_days,
        enforceAdvanceWindow: bookingSettings.enforce_advance_window,
        cancelCutoffHours: bookingSettings.cancel_cutoff_hours,
        waitlistEnabled: bookingSettings.waitlist_enabled,
        lookingForGamesEnabled: bookingSettings.looking_for_games_enabled,
      }
    : null;

  const horizon = params.days ?? settings?.horizonDays ?? 60;
  const slots: ClubScheduleSlot[] = schedule.map((s) => ({
    id: s.id, day: s.day, time: s.time, label: s.label, position: s.position,
  }));

  let sessions = generateSessions(slots, today, horizon);
  // Off by default: legacy only truncates this in the browser, so enforcing it
  // is a real tightening and the club has to opt in.
  if (settings?.enforceAdvanceWindow) {
    sessions = bookableSessions(sessions, benefits.advanceBookingDates);
  }

  const [rows, viewerUpcoming] = await Promise.all([
    sessions.length
      ? repo.findBookings(params.clubId, today, addDays(today, horizon))
      : Promise.resolve([]),
    params.viewerId
      ? repo.countUpcomingFor(params.clubId, params.viewerId, today)
      : Promise.resolve(0),
  ]);

  const bookings = rows.map((r) => toBooking(r, params.viewerId, params.canManage, today));

  const bySession = new Map<string, Booking[]>();
  const viewerDates = new Set<string>();
  for (const b of bookings) {
    const key = `${b.clubSessionId}:${b.date}`;
    const list = bySession.get(key) ?? [];
    list.push(b);
    bySession.set(key, list);
    if (b.isMine) viewerDates.add(b.date);
  }

  const capped =
    benefits.maxUpcomingBookings > 0 && viewerUpcoming >= benefits.maxUpcomingBookings;

  // The nights an advert may name: the first N distinct ones, counted the same
  // way createPost counts them so the button and the rule cannot disagree.
  const postableNights = new Set<string>();
  if (benefits.lookingForGameFutureDates > 0) {
    for (const s of sessions) {
      if (postableNights.size >= benefits.lookingForGameFutureDates) break;
      postableNights.add(s.date);
    }
  } else {
    for (const s of sessions) postableNights.add(s.date);
  }

  const calendar: CalendarSession[] = sessions.map((s) => {
    const sessionBookings = bySession.get(`${s.clubSessionId}:${s.date}`) ?? [];
    const tablesLeft = Math.max(params.capacity - sessionBookings.length, 0);
    const bookedThisDate = viewerDates.has(s.date);

    // In the order legacy checks them, so the message a member sees is the one
    // legacy would have shown (club_store.py:3257-3270).
    const blockedBy =
      !params.isMember ? "not-a-member" as const
      : bookedThisDate ? "date-clash" as const
      : capped ? "booking-limit" as const
      : tablesLeft <= 0 ? "full" as const
      : null;

    const blockedReason =
      blockedBy === "not-a-member" ? "Only approved club members can book tables."
      : blockedBy === "date-clash" ? "You already have a booking for that club date."
      : blockedBy === "booking-limit"
        ? `Your current membership tier allows ${benefits.maxUpcomingBookings} upcoming bookings at once.`
      : blockedBy === "full" ? "No tables are left for that session."
      : null;

    return {
      ...s,
      capacity: params.capacity,
      bookings: sessionBookings,
      tablesLeft,
      isFull: tablesLeft <= 0,
      blockedReason,
      blockedBy,
      viewerBookedThisDate: bookedThisDate,
      // Not on a night they are already playing: taking up an advert books a
      // table in the poster's name, and they cannot have two that evening.
      canPostLookingForGame: postableNights.has(s.date) && !bookedThisDate,
    };
  });

  return {
    clubId: params.clubId,
    clubSlug: params.clubSlug,
    clubName: params.clubName,
    settings,
    capacity: params.capacity,
    sessions: calendar,
    viewerUpcoming,
    viewerCanBook: Boolean(settings) && params.capacity > 0 && params.isMember,
    benefits,
  };
}
