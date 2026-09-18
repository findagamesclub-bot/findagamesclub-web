import type { DoorRow } from "@/utils/door-list";

import type { EventStatus } from "@/utils/event-draft";
import type { TicketAudience } from "@/utils/event-tickets";

/**
 * One booking on the club's own list, which spans every event.
 *
 * The roster's row plus enough of the event to name it, since a club looking
 * at a thousand of these needs to know which day each one is for.
 */
export type ClubBookingRow = DoorRow & {
  eventId: number;
  eventTitle: string;
  eventLegacyId: string;
  eventStartDate: string | null;
};

/** Enough of an event to name it in an email or a filename. */
export type EventFacts = {
  id: number;
  legacyId: string;
  title: string;
  startDate: string | null;
  clubName: string;
  clubSlug: string;
};

/** One event as its own club sees it: drafts, cancellations and all. */
export type EditableEvent = {
  id: number;
  legacyId: string;
  clubId: number;
  title: string;
  summary: string;
  price: string;
  roundCount: number | null;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  venueName: string;
  venueAddress: string;
  venuePostcode: string;
  formats: string[];
  eventTypes: string[];
  featuredGames: string[];
  facilities: string[];
  infoBoard: string;
  bestcoastLink: string;
  logoSrc: string;
  logoAlt: string;
  logoPath: string;
  status: EventStatus;
  publishedAt: string | null;
  cancelReason: string;
  ticketsAvailable: number | null;
  /** Live bookings. A cancelled one is not somebody the club has to tell. */
  bookings: number;
  ticketTypes: EditableTicketType[];
  notices: EventNotice[];
};

export type EditableTicketType = {
  id: number;
  label: string;
  price: string;
  quantityAvailable: number | null;
  audience: TicketAudience;
  audienceLabel: string;
  minimumTierKey: string;
  position: number;
  /** How many are spoken for. Decides what may still be changed. */
  taken: number;
};

export type EventNotice = {
  id: number;
  message: string;
  createdAt: string;
};

/** One table in a round. */
export type PairingMatch = {
  id: number;
  tableLabel: string;
  playerOne: string;
  playerOneId: string | null;
  playerTwo: string;
  playerTwoId: string | null;
  scoreOne: number | null;
  scoreTwo: number | null;
  position: number;
};

export type PairingRound = {
  id: number;
  round: number;
  label: string;
  published: boolean;
  matches: PairingMatch[];
};
