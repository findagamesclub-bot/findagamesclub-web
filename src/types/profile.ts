/** What a profile page renders. Already normalised by the service. */
export type MemberProfile = {
  id: string;
  fullName: string;
  bio?: string;
  /** District only, never the full postcode: this page is public to signed-in users. */
  homeArea?: string;
  travelMiles?: number | null;
  games: string[];
  armies: string[];
  availability: string[];
  ageGroups: string[];
  playStyle: string[];
  /** Month and year only. A join date is context, not an anniversary. */
  memberSince?: string;
  isAdmin: boolean;
};

/** The editable shape, matching the ten columns a member may change. */
export type ProfileDraft = {
  fullName: string;
  bio: string;
  homePostcode: string;
  travelMiles: string;
  games: string[];
  armies: string[];
  availability: string[];
  ageGroups: string[];
  playStyle: string[];
};
