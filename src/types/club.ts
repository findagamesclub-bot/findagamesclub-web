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
  /** Approved members who joined here. Falls back to memberCount when zero. */
  joinedCount?: number | null;
  /** The club's own wording: "All ages", "16+", "18 and over". */
  ages?: string | null;
  /** Display-ready: "£8", "Pay what you can", or null. */
  fromPrice?: string | null;
  formats: string[];
  featuredGames: string[];
  facilities: string[];
  distanceMiles?: number | null;
  isFeatured?: boolean;
  /** Card artwork. Null for clubs that haven't uploaded any — the card draws a plate instead. */
  image?: { src: string; alt: string } | null;
  /** The club's mark. Null for all but one club, so the card falls back to its monogram. */
  logoUrl?: string | null;
  /** Null when nobody has reviewed the club yet, which is not the same as zero. */
  rating?: { average: number; count: number } | null;
  socialLinks?: { label: string; url: string }[];
  /** Null for a club with no postcode we could place. All 11 currently have one. */
  coordinates?: { latitude: number; longitude: number } | null;
};
