"use server";

import { getClubDetail } from "@/services/clubDetail.service";
import { lookUpMemberCode } from "@/services/memberCodes.service";

export type CodeLookupState = {
  error?: string;
  found?: { id: string; name: string };
  /** Echoed back so the caller saves with the code the server actually read. */
  code?: string;
  /**
   * The house latch for "this landed and worked", which `useActionSuccess`
   * watches. Nothing shows it as a toast here on purpose: the answer is the
   * linked line that appears on the screen, and a toast saying the same thing
   * is the site telling somebody twice.
   */
  notice?: string;
};

/**
 * Who holds this code, asked from a screen where a club is typing a name.
 *
 * Takes the slug rather than the club id, because that is what every console
 * screen already has and an id in a form field is one more thing a caller can
 * get wrong. The guard is 0177's: the function refuses anybody who does not
 * run the club, so nothing here decides anything.
 *
 * Deliberately revalidates nothing. It is a question, not a change.
 */
export async function lookUpCodeAction(
  _prev: CodeLookupState,
  data: FormData,
): Promise<CodeLookupState> {
  const slug = String(data.get("slug") ?? "");
  const code = String(data.get("code") ?? "");

  const club = await getClubDetail(slug);
  if (!club) return { error: "Something went wrong. Reload and try again." };

  const result = await lookUpMemberCode(club.id, code);
  if (!result.found) return { error: result.error ?? "No member has that code." };
  return { found: result.found, code, notice: "Member found." };
}
