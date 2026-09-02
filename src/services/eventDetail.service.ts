import "server-only";

import * as repo from "@/repositories/events.repository";
import { findMyBookingsForEvent } from "@/repositories/eventBookings.repository";
import { toMembershipTiers } from "@/utils/membership-tiers";
import { formatPrice } from "@/utils/format";
import { geocodeUk } from "./geocode.service";
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

type Row = NonNullable<Awaited<ReturnType<typeof repo.findEvent>>>;

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

function toPairings(rows: Row["club_event_pairings"]): EventPairing[] {
  return [...(rows ?? [])]
    .sort((a, b) => (a.round ?? 0) - (b.round ?? 0))
    .map((p) => {
      const matches = Array.isArray(p.matches) ? (p.matches as Record<string, unknown>[]) : [];
      return {
        id: p.id,
        round: p.round,
        label: p.label,
        // playerOneName is what the imported rows actually carry. Reading
        // only playerOne mapped every match to two empty strings, which the
        // filter below then dropped, so a published draw read as no draw.
        matches: matches.map((m) => ({
          table: (m.table as string) || null,
          playerOne: String(m.playerOneName ?? m.playerOne ?? m.player1 ?? ""),
          playerTwo: String(m.playerTwoName ?? m.playerTwo ?? m.player2 ?? ""),
        })).filter((m) => m.playerOne || m.playerTwo),
      };
    });
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
  const row = await repo.findEvent(clubSlug, legacyId);
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

  const canManageClub = Boolean(
    viewer && (club.owner_id === viewer.id || viewer.role === "admin"),
  );

  // A ticket buys you the board, the notices and the draw — the club is not the
  // only audience for them (_can_access_event_board, club_store.py:16187).
  const myBookings = viewer ? await findMyBookingsForEvent(row.id, viewer.id) : [];
  const canSeePrivate = canManageClub || myBookings.length > 0;

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

  const image = [...(club.club_images ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((i) => ({ src: i.src, alt: i.alt }))[0] ?? null;

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
    hasEnded: hasEnded(row),

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

    canSeePrivate,
    infoBoard: canSeePrivate ? row.info_board : null,
    pairings: canSeePrivate ? toPairings(row.club_event_pairings) : [],
  };
}
