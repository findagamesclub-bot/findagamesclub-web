import type { MembershipTier } from "./clubDetail";
import type { EventTeam, TeamFixture } from "./eventTeams";

/** One army as it was fielded, from the result row's jsonb. */
export type ResultArmy = {
  factionLabel: string | null;
  detachment: string | null;
  /** Belongs to the detachment, never to the faction. */
  disposition: string | null;
  mvpUnits: string[];
  /** What the club recorded against this side. Absent on an imported result. */
  underwhelmingUnits?: string[];
  primaryScore?: number | null;
  secondaryScore?: number | null;
  painted?: boolean;
  firstTurn?: string;
  battleRole?: string;
  /** Present only when the player had a saved list attached. */
  list: {
    /** Null on an imported result: legacy stored the name and not the row. */
    id: number | null;
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
    /**
     * The accounts behind the names, where the club linked them. A tournament
     * sheet is mostly typed names, so these are usually null, and that is what
     * decides whether a name is a link to a profile.
     */
    playerOneId: string | null;
    playerTwoId: string | null;
    /** The result, once somebody has entered it. Null while the round is live. */
    score: string | null;
    /**
     * Each side's own score, so a player's figure can sit beside their own
     * name. `score` stays for anything that wants the pair on one line.
     */
    scoreOne: number | null;
    scoreTwo: number | null;
    /** What each side brought, once the club has recorded it. */
    armyOne: ResultArmy | null;
    armyTwo: ResultArmy | null;
    /**
     * How the game was set up. One per game rather than one per side,
     * because both players were in the same deployment.
     */
    setup: { mission: string; deployment: string; terrain: string } | null;
  }[];
};

export type ClubEventDetail = {
  /**
   * Every picture the club put on the event, first one first. The first is
   * also the banner, which `art` resolves, so a gallery that drew all of them
   * would show it twice: `ClubGallery` renders nothing below two for exactly
   * that reason.
   */
  images: { src: string; alt: string }[];
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
  /** There is a draw on show and this reader has not earned it. */
  drawLocked: boolean;
  /**
   * The teams at a team event, empty everywhere else. Who is playing is part
   * of a tournament's public face, so these are not behind a ticket; the
   * fixtures are, exactly as the individual draw is.
   */
  teams: EventTeam[];
  teamFixtures: TeamFixture[];
  /**
   * Whether the club runs this one as teams. Carried rather than inferred
   * from `teams.length`, because an event marked as teams with none entered
   * yet is still a team event and must not offer the individual editor.
   */
  teamEvent: boolean;
};
