import { armyBuilderBlockedReason } from "./army-access";

/**
 * Who may run which AI feature.
 *
 * The army builder's five rungs first (`army-access.ts`), then a sixth: each
 * feature carries its own tier benefit and its own refusal, naming the feature
 * rather than the family (`_require_membership_tier_benefit`,
 * club_store.py:14398). A club can sell the list coach without selling the
 * season coach, which is the whole reason they are four keys and not one.
 *
 * A manager bypasses the tier, as everywhere else, but not the club's own
 * switch: a club that turned the builder off turned all four off with it.
 */

export const AI_FEATURES = ["coach", "matchup", "scouting", "season"] as const;
export type AiFeature = (typeof AI_FEATURES)[number];

/** The benefit key, the words in the refusal, and the plural for the usage line. */
export const FEATURE_META: Record<AiFeature, {
  benefit: string; label: string; noun: string; title: string;
}> = {
  coach: { benefit: "listCoachingAccess", label: "list coaching",
    noun: "coaching runs", title: "Coach this list" },
  matchup: { benefit: "matchupAnalysisAccess", label: "match-up analysis",
    noun: "match-up analyses", title: "Plan this matchup" },
  scouting: { benefit: "opponentScoutingAccess", label: "opponent scouting",
    noun: "scouting packs", title: "Scout this opponent" },
  season: { benefit: "seasonCoachAccess", label: "season coach",
    noun: "season plans", title: "Build a season plan" },
};

export function aiBlockedReason(params: {
  feature: AiFeature;
  enabled: boolean;
  signedIn: boolean;
  canManageClub: boolean;
  isApprovedMember: boolean;
  builderTierAllows: boolean;
  /** The flag for THIS feature on the tier they hold. */
  featureTierAllows: boolean;
}): string | null {
  const ladder = armyBuilderBlockedReason({
    enabled: params.enabled,
    signedIn: params.signedIn,
    canManageClub: params.canManageClub,
    isApprovedMember: params.isApprovedMember,
    tierAllows: params.builderTierAllows,
  });
  if (ladder) return ladder;
  if (params.canManageClub) return null;
  if (!params.featureTierAllows) {
    return `Your current membership tier does not include ${FEATURE_META[params.feature].label}.`;
  }
  return null;
}
