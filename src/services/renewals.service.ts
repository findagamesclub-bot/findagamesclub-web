import "server-only";

import { getRoster } from "./memberships.service";
import { getClubPayments } from "./payments.service";
import { toRenewalRow, type RenewalRow } from "@/utils/renewal-filter";
import { amountOf } from "@/utils/cart-pricing";
import type { MembershipTier } from "@/types/clubDetail";

/**
 * Every membership at a club, priced and dated, for the owner.
 *
 * The member-facing pages answer "where do I stand"; this answers "who owes me
 * money and who is about to lapse", which is the question that made the club
 * export a spreadsheet in the old app.
 *
 * Pending applications are left out: somebody who has not been approved has
 * nothing to renew. They belong in the approvals queue on the members page.
 */
export async function getClubRenewals(
  clubId: number,
  tiers: MembershipTier[],
): Promise<RenewalRow[]> {
  const [roster, payments] = await Promise.all([
    getRoster(clubId),
    getClubPayments(clubId),
  ]);

  const byKey = new Map(tiers.map((tier) => [tier.key, tier]));
  const today = Date.now();

  return roster
    .filter((member) => member.status === "approved")
    .map((member) => {
      const tier = member.tierKey ? byKey.get(member.tierKey) : undefined;

      return toRenewalRow({
        member,
        payments: payments.get(member.membershipId) ?? [],
        tierLabel: tier?.label ?? "No tier",
        // "Free" means the club asks nothing for it, so nothing can lapse.
        // A tier with no price set at all counts as free rather than as an
        // unpaid debt nobody can settle.
        free: !tier || amountOf(tier.price) === 0,
        today,
      });
    });
}
