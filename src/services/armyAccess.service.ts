import "server-only";

import { getCurrentProfile } from "./auth.service";
import { getClubDetail } from "./clubDetail.service";
import { getClubAccess } from "./clubAccess.service";
import { getMyMembership } from "./memberships.service";
import { getBuildContext } from "./armyLists.service";
import { armyBuilderBlockedReason } from "@/utils/army-access";
import { aiBlockedReason, FEATURE_META, type AiFeature } from "@/utils/ai-access";

/**
 * Everything a builder screen needs before it draws anything.
 *
 * One place, because five screens ask the same question and a gate answered
 * five ways is a gate with four holes in it. The reason comes back as words
 * rather than a boolean: a member on Basic who cannot see that Premium exists
 * has no way to learn what they are missing, which is the rule the ticket desk
 * already follows.
 *
 * The database asks again through `army_builder_allowed`, so this decides what
 * to draw and never what is allowed.
 */
export async function getArmyGate(slug: string) {
  const viewer = await getCurrentProfile();
  const club = await getClubDetail(slug);
  if (!club) return null;

  const [access, membership, build] = await Promise.all([
    getClubAccess(club.id, viewer),
    viewer ? getMyMembership(club.id, viewer.id).catch(() => null) : null,
    getBuildContext(club.id).catch(() => null),
  ]);

  const tier = club.membershipTiers.find((one) => one.key === membership?.tierKey);
  // The raw switches rather than a single answer, so a caller can ask about
  // any one of the five keys the army features are sold under.
  const benefits = (tier?.benefitValues ?? {}) as Record<string, unknown>;

  return {
    club,
    viewer,
    build,
    benefits,
    isApprovedMember: membership?.status === "approved",
    canManage: access.canManage,
    reason: armyBuilderBlockedReason({
      enabled: Boolean(build),
      signedIn: Boolean(viewer),
      canManageClub: access.canManage,
      isApprovedMember: membership?.status === "approved",
      tierAllows: Boolean(benefits.armyBuilderAccess),
    }),
  };
}

/**
 * The same gate, asked about one AI feature.
 *
 * The builder's five rungs first, then the feature's own: a club can sell the
 * list coach without selling the season coach, which is why they are four keys
 * rather than one.
 */
export function aiGateFor(
  gate: NonNullable<Awaited<ReturnType<typeof getArmyGate>>>,
  feature: AiFeature,
): string | null {
  return aiBlockedReason({
    feature,
    enabled: Boolean(gate.build),
    signedIn: Boolean(gate.viewer),
    canManageClub: gate.canManage,
    isApprovedMember: gate.isApprovedMember,
    builderTierAllows: Boolean(gate.benefits.armyBuilderAccess),
    featureTierAllows: Boolean(gate.benefits[FEATURE_META[feature].benefit]),
  });
}
