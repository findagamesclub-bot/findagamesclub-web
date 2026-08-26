import type { LoyaltyTier } from "@/utils/loyalty";

/** One movement in the ledger. */
export type LoyaltyEntry = {
  id: number;
  kind: "earned" | "spent" | "cancelled" | "refunded";
  category: string;
  description: string;
  /** Signed. Negative on a cancellation or a spend. */
  points: number;
  createdAt: string;
};

/** A member's standing at one club. */
export type LoyaltyWallet = {
  clubId: number;
  available: number;
  lifetime: number;
  tier: LoyaltyTier | null;
  next: LoyaltyTier | null;
  toNext: number | null;
  /** 0–1 through the current band. */
  progress: number;
  /** What this tier gets them, as the club wrote it. */
  rewards: string[];
  pointValue: number | null;
  entries: LoyaltyEntry[];
};

/** The programme itself, for the club page. */
export type LoyaltyProgramme = {
  enabled: boolean;
  tiers: LoyaltyTier[];
  milestones: { label: string; points: number; category: string }[];
  anniversaries: { years: number; points: number }[];
  pointValue: number | null;
};
