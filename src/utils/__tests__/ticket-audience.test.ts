import assert from "node:assert/strict";

import { normaliseAudience, ticketBlockedReason } from "../ticket-eligibility";
import type { MembershipTier } from "@/types/clubDetail";

// --- the eight spellings legacy accepts -----------------------------------

{
  for (const members of
    ["members", "Members", " MEMBERS ", "member", "member-only", "members-only", "members only"]) {
    assert.equal(normaliseAudience(members), "members", members);
  }

  // Everything else is open to everybody, which is legacy's own fallback.
  for (const all of ["all", "public", "open", "everyone", "non-members", "", null, undefined, "?"]) {
    assert.equal(normaliseAudience(all), "all", String(all));
  }
}

// --- the row the Stage 3 editor used to write -----------------------------

const tiers: MembershipTier[] = [];

const open = (audience: string | null) => ticketBlockedReason({
  audience, minimumTierKey: null, canManageClub: false,
  signedIn: true, isApprovedMember: false, viewerTierKey: null, tiers,
});

{
  assert.equal(open("all"), null, "a ticket open to everybody");
  assert.equal(
    open("public"), null,
    "the value the editor wrote before 0093. It used to fall past every branch "
    + "and come out as 'Not available to you' for a ticket marked open to all",
  );
  assert.equal(open(null), null, "an imported row that never said");
  assert.equal(open("everyone"), null);

  assert.equal(open("members"), "Members of the club only.",
    "and members-only still is");
}

// --- signed out -----------------------------------------------------------

{
  const anon = ticketBlockedReason({
    audience: "members", minimumTierKey: null, canManageClub: false,
    signedIn: false, isApprovedMember: false, viewerTierKey: null, tiers,
  });
  assert.equal(anon, "Sign in to buy this ticket.");

  const anonOpen = ticketBlockedReason({
    audience: "public", minimumTierKey: null, canManageClub: false,
    signedIn: false, isApprovedMember: false, viewerTierKey: null, tiers,
  });
  assert.equal(anonOpen, null, "a stranger can buy a ticket open to everybody");
}

console.log("ticket-audience: all assertions passed");
