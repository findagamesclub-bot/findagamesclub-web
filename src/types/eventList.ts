import type { SimilarEvent } from "@/utils/similar-events";
/** One event in the directory-wide list. */
export type EventSummary = {
  id: number;
  legacyId: string;
  title: string;
  summary: string | null;
  startDate: string | null;
  startTime: string | null;
  endDate: string | null;
  endTime: string | null;
  eventType: string | null;
  /** What the club typed in the event's own price field. */
  price: string | null;
  /**
   * The cheapest ticket type. An event can sell several, so a single figure
   * reads as "the price" when it is only one of them.
   */
  fromPrice: string | null;
  roundCount: number | null;
  ticketsAvailable: number | null;
  venueName: string | null;
  /** Where it actually runs. Often not the club's usual hall. */
  venue: { name: string | null; address: string | null; postcode: string | null };
  featuredGames: string[];
  /** An event can be tagged with several types; eventType is the first. */
  eventTypes: string[];
  formats: string[];
  facilities: string[];
  /** Weekday the event starts on, for the day filter. Null when undated. */
  weekday: string | null;
  hasEnded: boolean;
  club: { slug: string; name: string; city: string; logoUrl: string | null };
  /** The club's position. Events without their own venue run there. */
  coordinates: { latitude: number; longitude: number } | null;
  /** Only when a place was searched from. */
  distanceMiles: number | null;
  /** The club's formats, since an event inherits its club's kind of play. */
  clubFormats: string[];
  /**
   * Who the event is open to: "18+", "All ages". The club's door policy, since
   * events carry no age of their own and it is that hall's rule that decides.
   */
  ages: string | null;
  /** Best Coast Pairings listing, where the club runs its tournament on it. */
  bestcoastLink: string | null;
  /** The club's own artwork; events carry no images of their own. */
  image: { src: string; alt: string } | null;
  /**
   * Who won, when the club recorded results. The single most interesting thing
   * about a finished tournament, and the old app never showed it in a list.
   */
  winner: { name: string; army: string | null } | null;
};

/** Every value the filter bar can offer, built from the events themselves. */
export type EventFilterOptions = {
  cities: string[];
  eventTypes: string[];
  featuredGames: string[];
  facilities: string[];
  formats: string[];
  days: string[];
};

export type EventListResult = {
  events: EventSummary[];
  /** Counts for the whole set, so the toggle can show both numbers. */
  upcomingCount: number;
  pastCount: number;
  games: string[];
  options: EventFilterOptions;
  /** Named place the distances are measured from, when one was searched. */
  origin: { label: string } | null;
  /** A place we could not place. Saying so beats silently ignoring it. */
  locationUnresolved: boolean;
  /**
   * "More events you might like", for the bottom of the search.
   *
   * Worked out here rather than on the page because this is where the real
   * coordinates of the searched place live, and where the unfiltered set is
   * already in hand. It costs no extra query.
   *
   * `basis` says which pool answered, because the two need different wording.
   * "more" is what else is on; "history" is the fallback for a reader who has
   * genuinely seen everything, which only happens on a small directory.
   */
  suggestions: { items: SimilarEvent[]; basis: "more" | "history" };
};
