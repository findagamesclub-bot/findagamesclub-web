export type MembershipStatus = "none" | "pending" | "approved" | "cancelled";

/** What the club page needs to decide which button to show. */
export type MyMembership = {
  id: number | null;
  status: MembershipStatus;
  tierKey: string | null;
  /** When the current tier started. Payments before it are for an old tier. */
  tierAssignedAt: string | null;
  joinedAt?: string | null;
  declineReason?: string | null;
};

export type ClubMember = {
  membershipId: number;
  profileId: string;
  fullName: string;
  status: "pending" | "approved";
  tierKey: string | null;
  tierAssignedAt: string | null;
  joinedAt?: string | null;
  requestedAt: string;
  games: string[];
  armies: string[];
  /** Whole years since joining. Derived, never stored. */
  tenureYears: number;
};
