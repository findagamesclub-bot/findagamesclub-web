/** One event in the directory-wide list. */
export type EventSummary = {
  id: number;
  legacyId: string;
  title: string;
  summary: string | null;
  startDate: string | null;
  startTime: string | null;
  endDate: string | null;
  eventType: string | null;
  price: string | null;
  roundCount: number | null;
  ticketsAvailable: number | null;
  venueName: string | null;
  featuredGames: string[];
  hasEnded: boolean;
  club: { slug: string; name: string; city: string };
  /** The club's position. Events without their own venue run there. */
  coordinates: { latitude: number; longitude: number } | null;
  /** The club's own artwork; events carry no images of their own. */
  image: { src: string; alt: string } | null;
  /**
   * Who won, when the club recorded results. The single most interesting thing
   * about a finished tournament, and the old app never showed it in a list.
   */
  winner: { name: string; army: string | null } | null;
};

export type EventListResult = {
  events: EventSummary[];
  /** Counts for the whole set, so the toggle can show both numbers. */
  upcomingCount: number;
  pastCount: number;
  games: string[];
};
