import "server-only";

import * as repo from "@/repositories/memberships.repository";
import * as notify from "./membership-notify.service";
import type { ClubMember, MyMembership } from "@/types/membership";

/** Business rules for joining a club and being approved. */

type Row = Awaited<ReturnType<typeof repo.findClubMemberships>>[number];

/** Applications per club per day, per person. Counts withdrawn ones too. */
const MAX_REQUESTS_PER_DAY = 3;

function tenureYears(joinedAt: string | null | undefined): number {
  if (!joinedAt) return 0;
  const from = new Date(joinedAt);
  if (Number.isNaN(from.getTime())) return 0;
  const years = (Date.now() - from.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  return Math.max(0, Math.floor(years));
}

export async function getMyMembership(clubId: number, profileId: string): Promise<MyMembership> {
  const row = await repo.findMyMembership(clubId, profileId);
  if (!row) return { id: null, status: "none", tierKey: null, tierAssignedAt: null };

  return {
    id: row.id,
    status: row.status as MyMembership["status"],
    tierKey: row.tier_key,
    tierAssignedAt: row.tier_assigned_at,
    joinedAt: row.joined_at,
    declineReason: row.decline_reason,
  };
}

export async function requestToJoin(
  clubId: number,
  profileId: string,
  tierKey: string | null = null,
  applicantName = "",
) {
  const existing = await repo.findMyMembership(clubId, profileId);

  // A cancelled row does not block a fresh application, which is why the unique
  // index only covers pending and approved.
  if (existing && existing.status === "pending") {
    return { ok: false as const, error: "Your request is already with the club." };
  }
  if (existing && existing.status === "approved") {
    return { ok: false as const, error: "You are already a member of this club." };
  }

  // Re-applying after a decline is deliberate, but join/withdraw/join with no
  // brake is an unbounded mail loop pointed at the club owner.
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  if ((await repo.countRecentRequests(clubId, profileId, dayAgo)) >= MAX_REQUESTS_PER_DAY) {
    return {
      ok: false as const,
      error: "You have applied to this club several times today. Try again tomorrow.",
    };
  }

  try {
    // The tier arrives from a form, so it is not trusted. An unknown key is
    // stored as null rather than rejected — the club can set it on approval.
    const tiers = await repo.findTierKeys(clubId);
    const tier = tierKey && tiers.includes(tierKey) ? tierKey : null;
    await repo.insertMembershipRequest(clubId, profileId, tier);

    return { ok: true as const, clubId, profileId, applicantName };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    // Two clicks on the same button, or two tabs.
    if (message.includes("club_memberships_one_live")) {
      return { ok: false as const, error: "Your request is already with the club." };
    }
    return { ok: false as const, error: "Could not send your request. Try again." };
  }
}

/**
 * Sent after the request row is safely written. Kept separate so a mail or
 * lookup failure can never turn a successful join into "could not send your
 * request" — the row would exist and the applicant would try again.
 */
export async function announceRequest(clubId: number, profileId: string, applicantName: string) {
  try {
    const club = await repo.findClubBasics(clubId);
    if (!club) return;
    await notify.notifyRequested({
      applicantId: profileId,
      ownerId: club.owner_id,
      clubName: club.name,
      clubSlug: club.slug,
      applicantName: applicantName || "Someone",
    });
  } catch (error) {
    console.error("membership request notification failed", { clubId, profileId, error });
  }
}

export async function approveMember(membershipId: number, reviewerId: string) {
  try {
    // The row comes back only if the policy let the write through, so anything
    // after this point is running on behalf of a genuine club manager.
    const row = await repo.updateMembership(membershipId, {
      status: "approved",
      reviewedBy: reviewerId,
      joinedAt: new Date().toISOString(),
      from: ["pending"],
    });

    const club = await repo.findClubBasics(row.club_id);
    if (club) {
      await notify.notifyApproved({
        memberId: row.profile_id,
        clubName: club.name,
        clubSlug: club.slug,
        tierLabel: await repo.findTierLabel(club.id, row.tier_key),
      });
    }
    return { ok: true as const };
  } catch {
    // The update policy is what actually enforces ownership, so a refusal here
    // means the person is not the owner rather than that anything broke.
    return { ok: false as const, error: "Only the club owner can approve members." };
  }
}

export async function declineMember(membershipId: number, reviewerId: string, reason: string) {
  // A decline reason is copied into an email, so cap it. It is escaped by the
  // template, but there is no case for a thousand-word rejection.
  const note = reason.trim().slice(0, 300);

  try {
    const row = await repo.updateMembership(membershipId, {
      status: "cancelled",
      reviewedBy: reviewerId,
      declineReason: note || null,
      from: ["pending"],
    });

    const club = await repo.findClubBasics(row.club_id);
    if (club) {
      await notify.notifyDeclined({
        memberId: row.profile_id,
        clubName: club.name,
        reason: note || null,
      });
    }
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "Only the club owner can decline requests." };
  }
}

export async function leaveClub(membershipId: number) {
  try {
    await repo.cancelOwnMembership(membershipId);
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "Could not leave the club. Try again." };
  }
}

function toMember(row: Row): ClubMember {
  const profile = (row as unknown as { profiles: { id: string; full_name: string; games_interested: string[]; factions_armies: string[] } | null }).profiles;
  return {
    membershipId: row.id,
    profileId: profile?.id ?? "",
    fullName: profile?.full_name || "Member",
    status: row.status as "pending" | "approved",
    tierKey: row.tier_key,
    tierAssignedAt: row.tier_assigned_at,
    joinedAt: row.joined_at,
    requestedAt: row.created_at,
    games: profile?.games_interested ?? [],
    armies: profile?.factions_armies ?? [],
    tenureYears: tenureYears(row.joined_at),
  };
}

/** The roster. Only approved people, in join order. */
export async function getRoster(clubId: number): Promise<ClubMember[]> {
  const rows = await repo.findClubMemberships(clubId, ["approved"]);
  return rows.map(toMember);
}

/** People still waiting. Owners and admins only, enforced by policy. */
export async function getPendingRequests(clubId: number): Promise<ClubMember[]> {
  const rows = await repo.findClubMemberships(clubId, ["pending"]);
  return rows.map(toMember);
}

/**
 * Move a member to a different tier.
 *
 * An owner action, not a member one — a paid tier means money changed hands,
 * so members cannot promote themselves. RLS agrees: the leave policy pins a
 * member's own update to `cancelled`, and only club_memberships_manage can
 * touch tier_key.
 */
export async function changeMemberTier(membershipId: number, tierKey: string, reviewerId: string) {
  try {
    const tiers = await repo.findTierKeys(
      (await repo.findMembershipForPayment(membershipId))?.club_id ?? -1,
    );
    if (!tiers.includes(tierKey)) {
      return { ok: false as const, error: "That tier is not offered by this club." };
    }

    await repo.setMembershipTier(membershipId, tierKey, reviewerId);
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "Only the club owner can change a member's tier." };
  }
}
