"use server";

import { getCurrentProfile } from "@/services/auth.service";
import { getAdminContacts } from "@/services/messages.service";
import type { Contact } from "@/types/message";

/**
 * Search every account, for the admin's new-message dialog.
 *
 * Checked here as well as inside the function it calls. An action is a public
 * endpoint, and the role test belongs on both sides of it.
 */
export async function searchAccountsAction(query: string): Promise<Contact[]> {
  const viewer = await getCurrentProfile();
  if (viewer?.role !== "admin") return [];
  return getAdminContacts(query);
}
