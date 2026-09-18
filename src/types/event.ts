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

/** A round of the draw, as rows since 0091. */
export type EventPairing = {
  id: number;
  round: number | null;
  label: string | null;
  /**
   * Whether members can see it. A round only reaches this page unpublished
   * when the reader runs the club, so the marker is for them.
   */
  published: boolean;
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
  /**
   * 'published' or 'cancelled'. A draft never reaches a reader who is not the
   * club, but a called-off event deliberately does: somebody holding a ticket
   * opens the link in their email and has to be told it is off.
   */
  status: string;
  /** Why the club called it off, in their words. Empty unless cancelled. */
  cancelReason: string | null;

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
   * A place of theirs that was cancelled, usually with the event itself. The
   * called-off notice reads it so the person who had booked is told their
   * place went with it, and can open the ticket that says what they are owed.
   */
  myCancelledReference: string | null;

  /**
   * Legacy hides the info board, notices and pairings from anyone without a
   * ticket (_can_access_event_board, club_store.py:16187).
   */
  canSeePrivate: boolean;
  infoBoard: string | null;
  /**
   * Dated updates from the club, newest first. Gated the same way the info
   * board is: legacy hands both out only to somebody who can see the event
   * board (club_store.py:2824).
   */
  notices: { id: number; message: string; createdAt: string }[];
  /**
   * Whether there is a noticeboard at all, answered regardless of whether this
   * reader may see it. Without it the page cannot tell "no noticeboard" from
   * "a noticeboard you have not bought your way into", and it showed nothing
   * in both cases.
   */
  hasNoticeboard: boolean;
  pairings: EventPairing[];
};
