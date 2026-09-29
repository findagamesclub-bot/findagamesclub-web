/**
 * Who may use the army builder at a club, and what they are told when they
 * may not.
 *
 * Five rungs, in legacy's order, each with legacy's own sentence
 * (`_validate_army_builder_access`, club_store.py:17188). A manager or owner
 * passes at rung three and the two below it never run, which is why the club's
 * own team can work on lists at a club they are not a paying member of.
 *
 * The reason is returned rather than the feature being hidden, which is the
 * house rule the ticket desk already follows: a member on Basic who cannot see
 * that Premium exists has no way to learn what they are missing.
 */
/** The database raises these codes; one copy of the sentences, used by both. */
export const ARMY_ACCESS_ERRORS: Record<string, string> = {
  ARMY_NOT_ENABLED: "Army builder is not enabled for this club.",
  ARMY_SIGN_IN: "Sign in to access the army builder.",
  ARMY_NOT_MEMBER: "Only approved club members can use the army builder.",
  ARMY_TIER: "Your current membership tier does not include army builder access.",
};

export function armyBuilderBlockedReason(params: {
  enabled: boolean;
  signedIn: boolean;
  canManageClub: boolean;
  isApprovedMember: boolean;
  /** The benefit flag on the tier they hold, already resolved. */
  tierAllows: boolean;
}): string | null {
  if (!params.enabled) return ARMY_ACCESS_ERRORS.ARMY_NOT_ENABLED;
  if (!params.signedIn) return ARMY_ACCESS_ERRORS.ARMY_SIGN_IN;
  if (params.canManageClub) return null;
  if (!params.isApprovedMember) {
    return ARMY_ACCESS_ERRORS.ARMY_NOT_MEMBER;
  }
  if (!params.tierAllows) {
    return ARMY_ACCESS_ERRORS.ARMY_TIER;
  }
  return null;
}

/** The same question, when all anybody needs is yes or no. */
export const canUseArmyBuilder = (
  params: Parameters<typeof armyBuilderBlockedReason>[0],
) => armyBuilderBlockedReason(params) === null;
