export type ClubSession = {
  day: string;
  time: string;
  label?: string;
};

/** What the directory and club cards render. Already normalised by the service layer. */
export type ClubSummary = {
  slug: string;
  name: string;
  city: string;
  neighbourhood?: string;
  postcodeArea?: string;
  summary?: string;
  schedule: ClubSession[];
  /** Pre-formatted "Thu 19:00", or null when the club hasn't set a schedule. */
  meetingLabel?: string | null;
  /** Null means the club doesn't offer table booking, not that none are free. */
  tablesAvailable?: number | null;
  memberCount?: number | null;
  /** Display-ready: "£8", "Pay what you can", or null. */
  fromPrice?: string | null;
  formats: string[];
  featuredGames: string[];
  facilities: string[];
  distanceMiles?: number | null;
  isFeatured?: boolean;
};
