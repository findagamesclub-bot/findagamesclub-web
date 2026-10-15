"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import {
  changeAccountRole, resetAccountPassword, restoreAccount, suspendAccount,
} from "@/services/adminAccounts.service";
import {
  putClubBack, putEventBack, takeClubDown, takeEventDown,
} from "@/services/adminListings.service";

export type AdminState = { error?: string; notice?: string };

/**
 * Everything the accounts screen can do, behind one intent.
 *
 * The role is checked here as well as in the layout and again in the database
 * function. A server action is a public endpoint: the layout guarding the page
 * says nothing about who can post to this.
 */
export async function accountAction(
  _prev: AdminState, data: FormData,
): Promise<AdminState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in first." };
  if (viewer.role !== "admin") return { error: "Only a site admin can do that." };

  const profileId = String(data.get("profileId") ?? "");
  if (!profileId) return { error: "That account could not be found." };

  const intent = String(data.get("intent") ?? "");
  const result = await run(intent, profileId, data);
  if (!result) return { error: "That did not save. Try again." };

  if (result.ok) {
    revalidatePath("/admin/accounts");
    revalidatePath(`/admin/accounts/${profileId}`);
    return { notice: result.notice };
  }
  return { error: result.error };
}

function run(intent: string, profileId: string, data: FormData) {
  switch (intent) {
    case "suspend":
      return suspendAccount(profileId, String(data.get("reason") ?? "").trim());
    case "restore":
      return restoreAccount(profileId);
    case "role":
      return changeAccountRole(profileId, String(data.get("role") ?? ""));
    case "reset":
      return resetAccountPassword(String(data.get("email") ?? "").trim());
    default:
      return null;
  }
}

/**
 * Take a club or an event listing down, and put it back (0188).
 *
 * One action for both, because it is one decision wearing two hats: an admin
 * types a reason and the listing leaves the directory. Two actions would be
 * two places for the role check and two sets of words for the same refusal.
 *
 * The role is checked here as well as in the layout and again in the database
 * function. A server action is a public endpoint, and the layout guarding the
 * page says nothing about who can post to this.
 */
export async function listingAction(
  _prev: AdminState, data: FormData,
): Promise<AdminState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in first." };
  if (viewer.role !== "admin") return { error: "Only a site admin can do that." };

  const id = Number(data.get("id") ?? 0);
  const kind = String(data.get("kind") ?? "");
  const intent = String(data.get("intent") ?? "");
  const reason = String(data.get("reason") ?? "").trim();
  if (!id || (kind !== "club" && kind !== "event")) {
    return { error: "That listing could not be found." };
  }

  const result = kind === "club"
    ? (intent === "down"
      ? await takeClubDown(id, reason, viewer.id)
      : await putClubBack(id, viewer.id))
    : (intent === "down"
      ? await takeEventDown(id, reason, viewer.id)
      : await putEventBack(id, viewer.id));

  if (!result.ok) return { error: result.error };

  // Both lists, because an admin taking a club down from the clubs page has
  // changed what the events page says about every event that club runs.
  revalidatePath("/admin/clubs");
  revalidatePath("/admin/events");
  // And the club's own pages, which draw the banner the owner reads.
  const slug = String(data.get("slug") ?? "");
  if (slug) {
    revalidatePath(`/clubs/${slug}`);
    revalidatePath(`/clubs/${slug}/events`, "page");
  }
  return { notice: result.notice };
}
