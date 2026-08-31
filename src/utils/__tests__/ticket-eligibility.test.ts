/**
 * Who may buy which ticket.
 *
 * Run with: npx tsx src/utils/__tests__/ticket-eligibility.test.ts
 * Modelled on Didcot: Standard is open to all, VIP is Premium members only.
 */

import { ticketBlockedReason } from "../ticket-eligibility";
import type { MembershipTier } from "@/types/clubDetail";

let failed = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}` +
    (ok ? "" : `\n        got ${JSON.stringify(actual)}\n        want ${JSON.stringify(expected)}`));
}

const tier = (key: string, label: string): MembershipTier => ({
  key, label, price: null, priceDuration: "", description: null,
  isBasic: key === "basic", benefits: [], benefitGroups: [], benefitValues: {}, billingOptions: [], eventDiscountPercent: 0, reservedCategories: [],
});

const tiers = [tier("basic", "Basic Membership"), tier("premium-membership", "Premium Membership")];

const ask = (o: Partial<Parameters<typeof ticketBlockedReason>[0]>) =>
  ticketBlockedReason({
    audience: "all", minimumTierKey: null, canManageClub: false, signedIn: true,
    isApprovedMember: true, viewerTierKey: "basic", tiers, ...o,
  });

// --- an open ticket ---
check("anyone may buy an open ticket",
  ask({ signedIn: false, isApprovedMember: false, viewerTierKey: null }), null);

// --- members only ---
check("signed out cannot buy a members ticket",
  ask({ audience: "members", signedIn: false, isApprovedMember: false }),
  "Sign in to buy this ticket.");
check("a non-member cannot buy a members ticket",
  ask({ audience: "members", isApprovedMember: false }), "Members of the club only.");
check("a member can buy a members ticket",
  ask({ audience: "members" }), null);

// --- tier gated ---
check("a Basic member cannot buy the Premium ticket",
  ask({ audience: "members", minimumTierKey: "premium-membership" }),
  "Premium Membership members only.");
check("a Premium member can",
  ask({ audience: "members", minimumTierKey: "premium-membership",
        viewerTierKey: "premium-membership" }), null);
check("a Premium member can also buy the Basic-gated ticket",
  ask({ audience: "members", minimumTierKey: "basic", viewerTierKey: "premium-membership" }), null);

// --- the club always can ---
check("the club may buy its own restricted ticket",
  ask({ audience: "members", minimumTierKey: "premium-membership",
        canManageClub: true, isApprovedMember: false, viewerTierKey: null }), null);

// --- a member on no tier at all ---
check("a member with no tier cannot buy a tier-gated ticket",
  ask({ audience: "members", minimumTierKey: "premium-membership", viewerTierKey: null }),
  "Premium Membership members only.");

// --- a tier key the club has since deleted must not open the gate ---
check("an unknown required tier does not block a member",
  ask({ audience: "members", minimumTierKey: "gone" }), null);

console.log(failed ? `\n${failed} FAILING` : "\nall passing");
process.exit(failed ? 1 : 0);
