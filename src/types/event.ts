import type { MembershipTier } from "./clubDetail";

/** One army as it was fielded, from the result row's jsonb. */
export type ResultArmy = {
  factionLabel: string | null;
  detachment: string | null;
  mvpUnits: string[];
  /** Present only when the player had a saved list attached. */
  list: {
    name: string | null;
    pointsLimit: string | null;
    totalPoints: number | null;
    units: { name: string; quantity: number; points: number }[];
  } | null;
};

export type EventPlacing = {
  id: number;
  rank: number;
  placement: string;
  name: string;
  isMember: boolean;
  profileId: string | null;
  army: ResultArmy | null;
};

export type EventTicketType = {
  id: number;
  label: string;
  price: string | null;
  /** Null when the club did not cap it. */
  quantityAvailable: number | null;
  /** "members" / "public" etc. Legacy also gates on a minimum tier. */
  audience: string | null;
  audienceLabel: string | null;
  minimumTierKey: string | null;
};

/** A round of the draw. `matches` is the legacy jsonb, shape unenforced. */
export type EventPairing = {
  id: number;
  round: number | null;
  label: string | null;
  matches: {
    table: string | null;
    playerOne: string;
    playerTwo: string;
    /** The result, once somebody has entered it. Null while the round is live. */
    score: string | null;
  }[];
};

export type ClubEventDetail = {
  id: number;
  legacyId: string;
  clubSlug: string;
  clubName: string;
  title: string;
  summary: string | null;
  startDate: string | null;
  startTime: string | null;
  endDate: string | null;
  endTime: string | null;
  eventType: string | null;
  eventTypes: string[];
  formats: string[];
  featuredGames: string[];
  facilities: string[];
  roundCount: number | null;
  price: string | null;
  ticketsAvailable: number | null;
  bestcoastLink: string | null;
  hasEnded: boolean;

  venue: { name: string | null; address: string | null; postcode: string | null };
  directionsUrl: string | null;
  /** Geocoded from the event's own postcode; null when it could not be placed. */
  coordinates: { latitude: number; longitude: number } | null;
  /** The club's artwork. No event in the directory has its own. */
  image: { src: string; alt: string } | null;

  ticketTypes: EventTicketType[];
  placings: EventPlacing[];

  /** The club's tiers, in ladder order. Ticket eligibility compares indexes. */
  tiers: MembershipTier[];
  clubId: number;
  canManageClub: boolean;
  /** The reference of the viewer's live booking, if they hold one. */
  myBookingReference: string | null;
  /** More than one is allowed: somebody can come back and buy again. */
  myBookingCount: number;

  /**
   * Legacy hides the info board, notices and pairings from anyone without a
   * ticket (_can_access_event_board, club_store.py:16187).
   */
  canSeePrivate: boolean;
  infoBoard: string | null;
  pairings: EventPairing[];
};
