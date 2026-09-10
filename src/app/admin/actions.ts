"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import {
  changeAccountRole, resetAccountPassword, restoreAccount, suspendAccount,
} from "@/services/adminAccounts.service";

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
