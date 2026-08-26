"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import * as memberships from "@/services/memberships.service";
import * as payments from "@/services/payments.service";

export type MembershipState = { error?: string; notice?: string };

/**
 * Revalidates the pages that render membership state.
 *
 * Called on failure as well as success on purpose: the common error is "your
 * request is already with the club", which happens precisely when the page the
 * user is looking at has gone stale. Not revalidating there leaves them on a
 * button that can only ever produce the same error again.
 */
function refresh(slug: string) {
  revalidatePath(`/clubs/${slug}`);
  revalidatePath(`/clubs/${slug}/members`);
}

/**
 * One action for join and withdraw.
 *
 * These were two actions with two useActionState hooks, which meant a stale
 * "Request sent." from the join could outlive the withdraw that followed it and
 * sit above a button reading "Ask to join". A single state cannot disagree
 * with itself.
 */
export async function membershipAction(
  _prev: MembershipState,
  data: FormData,
): Promise<MembershipState> {
  const viewer = await getCurrentProfile();
  const slug = String(data.get("slug") ?? "");
  const intent = String(data.get("intent") ?? "");

  if (!viewer) return { error: "Sign in to ask to join this club." };
  if (!slug) return { error: "Something went wrong. Reload and try again." };

  if (intent === "join") {
    const clubId = Number(data.get("clubId"));
    if (!clubId) return { error: "Something went wrong. Reload and try again." };

    const result = await memberships.requestToJoin(
      clubId,
      viewer.id,
      String(data.get("tierKey") ?? "") || null,
      viewer.full_name,
    );

    refresh(slug);
    if (!result.ok) return { error: result.error };

    // After the row is committed, so a mail failure cannot undo the join.
    await memberships.announceRequest(clubId, viewer.id, viewer.full_name);
    return { notice: "Request sent. The club will let you know." };
  }

  if (intent === "leave") {
    const membershipId = Number(data.get("membershipId"));
    if (!membershipId) return { error: "Something went wrong. Reload and try again." };

    // No ownership check here on purpose: the update policy only lets a member
    // cancel their own row, and the repository now refuses a zero-row write.
    const result = await memberships.leaveClub(membershipId);

    refresh(slug);
    if (!result.ok) return { error: result.error };
    return { notice: "You have left the club." };
  }

  return { error: "Something went wrong. Reload and try again." };
}

export async function reviewMemberAction(
  _prev: MembershipState,
  data: FormData,
): Promise<MembershipState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in first." };

  const membershipId = Number(data.get("membershipId"));
  const slug = String(data.get("slug") ?? "");
  const decision = String(data.get("decision") ?? "");
  if (!membershipId || !slug) return { error: "Something went wrong. Reload and try again." };

  const result =
    decision === "approve"
      ? await memberships.approveMember(membershipId, viewer.id)
      : await memberships.declineMember(membershipId, viewer.id, String(data.get("reason") ?? ""));

  refresh(slug);
  if (!result.ok) return { error: result.error };

  return { notice: decision === "approve" ? "Member approved." : "Request declined." };
}

/** Owner records that a member has paid, offline. */
export async function recordPaymentAction(
  _prev: MembershipState,
  data: FormData,
): Promise<MembershipState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in first." };

  const membershipId = Number(data.get("membershipId"));
  const slug = String(data.get("slug") ?? "");
  const billingOptionId = String(data.get("billingOptionId") ?? "");
  if (!membershipId || !slug) return { error: "Something went wrong. Reload and try again." };

  const result = await payments.recordPayment(
    membershipId,
    billingOptionId,
    String(data.get("note") ?? ""),
    viewer.id,
  );

  refresh(slug);
  if (!result.ok) return { error: result.error };
  return { notice: "Payment recorded." };
}

/** Owner moves a member between tiers. */
export async function changeTierAction(
  _prev: MembershipState,
  data: FormData,
): Promise<MembershipState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in first." };

  const membershipId = Number(data.get("membershipId"));
  const slug = String(data.get("slug") ?? "");
  const tierKey = String(data.get("tierKey") ?? "");
  if (!membershipId || !slug || !tierKey) {
    return { error: "Something went wrong. Reload and try again." };
  }

  const result = await memberships.changeMemberTier(membershipId, tierKey, viewer.id);

  refresh(slug);
  if (!result.ok) return { error: result.error };
  return { notice: "Membership tier updated." };
}
