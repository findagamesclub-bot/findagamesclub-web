"use server";

import { revalidatePath } from "next/cache";
import {
  answerInvite, changeRole, handOnClub, inviteToTeam, removeFromTeam, withdrawInvite,
} from "@/services/teamWrites.service";
import { getCurrentProfile } from "@/services/auth.service";

export type TeamState = { error?: string; notice?: string };

/**
 * One action for the whole team page, chosen by a hidden `intent`.
 *
 * Six buttons, one place that revalidates. Splitting them would mean six
 * copies of the sign-in check and the path list, and a seventh button added
 * later that quietly forgets one of them.
 */
export async function teamAction(_prev: TeamState, data: FormData): Promise<TeamState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in first." };

  const slug = String(data.get("slug") ?? "");
  const clubId = Number(data.get("clubId"));
  const intent = String(data.get("intent") ?? "");
  if (!clubId || !slug) return { error: "That club could not be found." };

  const result = await run(intent, clubId, data);
  if (!result) return { error: "That did not save. Try again." };

  if (result.ok) {
    revalidatePath(`/clubs/${slug}/manage/team`);
    // The role decides what the console shows, so the shell has to be redrawn
    // too, or somebody just demoted keeps a nav they can no longer use.
    revalidatePath(`/clubs/${slug}/manage`);
    revalidatePath("/my-clubs");
    return { notice: result.notice };
  }
  return { error: result.error };
}

function run(intent: string, clubId: number, data: FormData) {
  const profileId = String(data.get("profileId") ?? "");

  switch (intent) {
    case "invite":
      return inviteToTeam(
        clubId,
        String(data.get("role") ?? ""),
        String(data.get("email") ?? ""),
        profileId,
      );
    case "role":
      return changeRole(clubId, profileId, String(data.get("role") ?? ""));
    case "remove":
      return removeFromTeam(clubId, profileId);
    case "revoke":
      return withdrawInvite(Number(data.get("inviteId")));
    case "transfer":
      return handOnClub(clubId, profileId);
    default:
      return null;
  }
}

/** Accepting or declining, from the page the invitation link opens. */
export async function inviteReplyAction(
  _prev: TeamState, data: FormData,
): Promise<TeamState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in to answer this invitation." };

  const token = String(data.get("token") ?? "");
  if (!token) return { error: "That invitation link is incomplete." };

  const result = await answerInvite(token, String(data.get("reply")) === "accept");
  if (!result.ok) return { error: result.error };

  revalidatePath("/my-clubs");
  revalidatePath("/account");
  return { notice: result.notice };
}
