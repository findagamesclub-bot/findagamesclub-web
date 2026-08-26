import type { MembershipTier } from "@/types/clubDetail";

/**
 * Who may buy a ticket type.
 *
 * Ported from _can_user_buy_event_ticket (club_store.py:23032). The order
 * matters: a club's own manager passes everything, then anonymous buyers are
 * refused anything restricted, then membership, then the tier.
 *
 * Returns null when they may buy, or the reason they may not — the UI shows
 * that reason rather than silently hiding the ticket, because a member who
 * cannot see the VIP tier cannot work out that upgrading would let them.
 */
export function ticketBlockedReason(params: {
  audience: string | null;
  minimumTierKey: string | null;
  canManageClub: boolean;
  signedIn: boolean;
  isApprovedMember: boolean;
  viewerTierKey: string | null;
  tiers: MembershipTier[];
}): string | null {
  const audience = (params.audience ?? "all").trim().toLowerCase() || "all";
  const required = (params.minimumTierKey ?? "").trim();

  // Open to everyone, no tier needed.
  if (audience === "all" && !required) return null;

  if (params.canManageClub) return null;
  if (!params.signedIn) return "Sign in to buy this ticket.";
  if (!params.isApprovedMember) return "Members of the club only.";

  if (required) {
    const wanted = params.tiers.find((t) => t.key === required);
    const held = params.tiers.find((t) => t.key === params.viewerTierKey);

    // Position is the ladder: a tier further down the club's own list is
    // higher, which is how legacy's _tier_is_allowed reads it.
    const wantedRank = wanted ? params.tiers.indexOf(wanted) : -1;
    const heldRank = held ? params.tiers.indexOf(held) : -1;

    if (wantedRank >= 0 && heldRank < wantedRank) {
      return `${wanted!.label} members only.`;
    }
  }

  if (audience !== "all" && audience !== "members") {
    return "Not available to you.";
  }

  return null;
}
