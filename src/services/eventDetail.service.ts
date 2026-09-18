import "server-only";

import { findEvent } from "@/repositories/eventDetail.repository";
import { findMyBookingsForEvent } from "@/repositories/eventBookings.repository";
import { findRounds } from "@/repositories/eventPairings.repository";
import { findNotices } from "@/repositories/eventNotices.repository";
import { toMembershipTiers } from "@/utils/membership-tiers";
import { formatPrice } from "@/utils/format";
import { eventArt } from "@/utils/event-art";
import { geocodeUk } from "./geocode.service";
import { getClubAccess } from "./clubAccess.service";
import type {
  ClubEventDetail, EventPairing, EventPlacing, EventTicketType, ResultArmy,
} from "@/types/event";

/**
 * One event page.
 *
 * The interesting part is the results: legacy stores a whole army in the
 * result row, from a faction label up to a full 2,000-point list with every
 * unit. Didcot's April tournament has three placings and one of them carries
 * the winning list, which is the thing wargamers actually turn up to read.
 */

type Row = NonNullable<Awaited<ReturnType<typeof findEvent>>>;

/** Legacy's rule: end date, or start date, plus an end time if there is one. */
function hasEnded(row: { end_date: string | null; start_date: string | null; end_time: string | null }): boolean {
  const date = row.end_date || row.start_date;
  if (!date) return true;

  const time = (row.end_time || "").trim();
  const stamp = /^\d{2}:\d{2}$/.test(time) ? `${date}T${time}:00` : `${date}T23:59:59`;
  const ends = new Date(stamp);
  if (Number.isNaN(ends.getTime())) return true;
  return ends.getTime() < Date.now();
}

/** The army jsonb, reduced to what a reader needs. */
function toArmy(raw: unknown): ResultArmy | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;

  const snapshot = a.armyListVersionSnapshot as Record<string, unknown> | undefined;
  const rawUnits = Array.isArray(snapshot?.units) ? (snapshot!.units as Record<string, unknown>[]) : [];

  return {
    factionLabel: (a.factionLabel as string) || null,
    detachment: (a.detachment as string) || null,
    mvpUnits: Array.isArray(a.mvpUnits) ? (a.mvpUnits as string[]).filter(Boolean) : [],
    list: snapshot
      ? {
          name: (a.armyListName as string) || null,
          pointsLimit: (snapshot.pointsLimit as string) || null,
          totalPoints: typeof snapshot.totalPoints === "number" ? snapshot.totalPoints : null,
          units: rawUnits.map((u) => ({
            name: String(u.unitName ?? ""),
            quantity: Number(u.quantity ?? 1),
            points: Number(u.linePoints ?? u.unitPoints ?? 0),
          })).filter((u) => u.name),
        }
      : null,
  };
}

function toPlacings(rows: Row["club_event_results"]): EventPlacing[] {
  return [...(rows ?? [])]
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
    .map((r) => ({
      id: r.id,
      rank: r.rank ?? 0,
      placement: r.placement || `${r.rank}`,
      name: r.member_name || "Player",
      isMember: Boolean(r.is_member),
      profileId: r.member_profile_id,
      army: toArmy(r.army),
    }));
}

function toTickets(rows: Row["club_event_ticket_types"]): EventTicketType[] {
  return [...(rows ?? [])]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((t) => ({
      id: t.id,
      label: t.label,
      price: formatPrice(t.price ?? ""),
      quantityAvailable: t.quantity_available,
      audience: t.audience,
      audienceLabel: t.audience_label,
      minimumTierKey: t.minimum_tier_key,
    }));
}

/** "78 - 15", or null until a round has actually been played. */
function pairScore(one: unknown, two: unknown): string | null {
  const a = String(one ?? "").trim();
  const b = String(two ?? "").trim();
  return a && b ? `${a} - ${b}` : null;
}

/**
 * The draw, as rows.
 *
 * A separate query rather than an embed on the event, and only run when the
 * viewer is allowed to see it: an anonymous visitor to a live event never
 * needs the tables, so nothing fetches them.
 *
 * 0091 turned the `matches` jsonb into rows. Reading the blob is what made
 * every table a rewrite of the whole round.
 */
async function readPairings(eventId: number, forClub: boolean): Promise<EventPairing[]> {
  const rounds = await findRounds(eventId).catch(() => []);
  return rounds
    // A round the club has not finished building belongs to the club. The
    // policy says the same thing; this is what stops it reaching the page for
    // somebody the policy does let read it, which a manager is.
    .filter((round) => round.published || forClub)
    .map((round) => ({
      id: round.id,
      round: round.round,
      label: round.label || null,
      published: round.published,
      matches: round.matches.map((match) => ({
        table: match.tableLabel || null,
        playerOne: match.playerOne,
        playerTwo: match.playerTwo,
        // Both or neither. One score on its own is half a result and reads as
        // a walkover that nobody recorded.
        score: pairScore(match.scoreOne, match.scoreTwo),
      })).filter((match) => match.playerOne || match.playerTwo),
    }));
}

function directions(name: string | null, address: string | null, postcode: string | null) {
  const parts = [name, address, postcode].filter(Boolean);
  if (!parts.length) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(", "))}`;
}

export async function getEventDetail(
  clubSlug: string,
  legacyId: string,
  viewer: { id: string; role: string | null } | null,
): Promise<ClubEventDetail | null> {
  const row = await findEvent(clubSlug, legacyId);
  if (!row) return null;

  const club = (row as unknown as {
    clubs: {
      id: number; slug: string; name: string; owner_id: string | null;
      venue_name: string | null; venue_address: string | null; venue_postcode: string | null;
      latitude: number | null; longitude: number | null;
      club_images: { src: string; alt: string; position: number }[] | null;
      club_membership_tiers: Parameters<typeof toMembershipTiers>[0] | null;
    };
  }).clubs;

  // Anybody who runs the club, which since Milestone 3 includes managers.
  const canManageClub = (await getClubAccess(club.id, viewer)).canManage;

  // A ticket buys you the board, the notices and the draw — the club is not the
  // only audience for them (_can_access_event_board, club_store.py:16187).
  const allMine = viewer ? await findMyBookingsForEvent(row.id, viewer.id) : [];
  const myBookings = allMine.filter((b) => b.status === "reserved");
  // Calling an event off cancels the places with it (0092) and putting it back
  // on deliberately does not restore them (0096), so the person who had booked
  // has no live booking to find themselves by. This is what lets the notice at
  // the top of the page speak to them rather than to a passer-by.
  const myCancelled = allMine.find((b) => b.status === "cancelled") ?? null;
  // Read for everybody, handed to nobody who has not earned it. Fetching only
  // when the gate opens would mean the page cannot say there is a board here,
  // and "nothing" is what a member sees when a club has posted four notices.
  const notices = await findNotices(row.id).catch(() => []);
  const canSeePrivate = canManageClub || myBookings.length > 0;
  // The draw is a record, not a plan. Before the event it belongs to the room;
  // after it, it is the same public history as the standings underneath it,
  // and it is what the Best Coast Pairings link on this page opens to the
  // whole internet anyway (0065). The board is not opened this way: people
  // wrote in it believing only the room could read it.
  const ended = hasEnded(row);

  // An event can name its own venue; otherwise it happens at the club's.
  const venue = {
    name: row.venue_name || club.venue_name,
    address: row.venue_address || club.venue_address,
    postcode: row.venue_postcode || club.venue_postcode,
  };

  // The event's own postcode when it has one, since an event often runs
  // somewhere other than the club's usual hall. Falls back to the club's
  // coordinates, which is right for the majority that do not move.
  let coordinates: { latitude: number; longitude: number } | null =
    club.latitude !== null && club.longitude !== null
      ? { latitude: club.latitude, longitude: club.longitude }
      : null;

  if (row.venue_postcode && row.venue_postcode !== club.venue_postcode) {
    const placed = await geocodeUk(row.venue_postcode);
    if (placed) coordinates = { latitude: placed.latitude, longitude: placed.longitude };
  }

  const clubArt = [...(club.club_images ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((i) => ({ src: i.src, alt: i.alt }))[0] ?? null;

  // The event's own picture when it has one, the club's otherwise. Before
  // Stage 3 nothing could have its own, so this only ever read the club's and
  // an uploaded poster went nowhere.
  const image = eventArt(
    { logoSrc: row.logo_src, logoAlt: row.logo_alt, title: row.title }, clubArt);

  return {
    id: row.id,
    coordinates,
    image,
    legacyId: row.legacy_id,
    clubSlug: club.slug,
    clubName: club.name,
    title: row.title,
    summary: row.summary,
    startDate: row.start_date,
    startTime: row.start_time,
    endDate: row.end_date,
    endTime: row.end_time,
    eventType: row.event_type,
    eventTypes: row.event_types ?? [],
    formats: row.formats ?? [],
    featuredGames: row.featured_games ?? [],
    facilities: row.facilities ?? [],
    roundCount: row.round_count,
    price: formatPrice(row.price ?? ""),
    ticketsAvailable: row.tickets_available,
    bestcoastLink: row.bestcoast_link,
    hasEnded: ended,
    status: row.status,
    cancelReason: (row.cancel_reason ?? "").trim() || null,

    venue,
    directionsUrl: directions(venue.name, venue.address, venue.postcode),

    ticketTypes: toTickets(row.club_event_ticket_types),
    placings: toPlacings(row.club_event_results),

    tiers: toMembershipTiers(club.club_membership_tiers ?? []),
    clubId: club.id,
    canManageClub,
    // The newest, because that is the one somebody just made and is looking for.
    myBookingReference: myBookings[0]?.reference ?? null,
    myBookingCount: myBookings.length,
    myCancelledReference: myCancelled?.reference ?? null,

    canSeePrivate,
    infoBoard: canSeePrivate ? row.info_board : null,
    notices: canSeePrivate ? notices : [],
    hasNoticeboard: Boolean((row.info_board ?? "").trim()) || notices.length > 0,
    pairings: canSeePrivate || ended ? await readPairings(row.id, canManageClub) : [],
  };
}
