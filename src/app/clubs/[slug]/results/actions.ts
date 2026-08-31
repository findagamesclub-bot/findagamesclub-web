"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import { linkMany, linkName } from "@/services/memberRecords.service";

export type LinkState = { error?: string; notice?: string };

export async function linkNameAction(
  _prev: LinkState,
  data: FormData,
): Promise<LinkState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in first." };

  const kind = String(data.get("kind")) === "result" ? "result" : "standing";
  const id = Number(data.get("id"));
  const slug = String(data.get("slug") ?? "");
  // Empty means "not one of our members", which is a real answer: guests play
  // in club leagues too.
  const profileId = String(data.get("profileId") ?? "") || null;

  if (!id || !slug) return { error: "Something went wrong. Reload and try again." };

  const result = await linkName(kind, id, profileId);
  if (!result.ok) return { error: result.error };

  revalidatePath(`/clubs/${slug}/results`);
  return { notice: profileId ? "Matched." : "Unmatched. It is back on the list above." };
}

/** Attach every row recorded under one name to the same member. */
export async function linkPersonAction(
  _prev: LinkState,
  data: FormData,
): Promise<LinkState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in first." };

  const slug = String(data.get("slug") ?? "");
  const profileId = String(data.get("profileId") ?? "");
  if (!slug || !profileId) return { error: "Pick which member this is first." };

  // "standing:12,result:4" — the rows the group is made of, so the action
  // never has to trust a name to find them again.
  const rows = String(data.get("rows") ?? "")
    .split(",")
    .map((part) => part.split(":"))
    .filter((pair) => pair.length === 2 && Number(pair[1]))
    .map(([kind, id]) => ({
      kind: kind === "result" ? ("result" as const) : ("standing" as const),
      id: Number(id),
    }));

  if (!rows.length) return { error: "Nothing to match." };

  const result = await linkMany(rows, profileId);
  revalidatePath(`/clubs/${slug}/results`);

  if (!result.ok) {
    return {
      error: result.done
        ? `${result.error} ${result.done} of ${rows.length} were matched.`
        : result.error,
    };
  }

  return {
    notice: rows.length === 1
      ? "Matched."
      : `${rows.length} results matched.`,
  };
}

/**
 * Accept every suggestion at once.
 *
 * The rows come from the form rather than being worked out again here, so what
 * is attached is exactly what the owner was shown. Recomputing the matches
 * server-side would risk acting on a roster that changed since the page
 * rendered.
 */
export async function acceptSuggestionsAction(
  _prev: LinkState,
  data: FormData,
): Promise<LinkState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in first." };

  const slug = String(data.get("slug") ?? "");
  if (!slug) return { error: "Something went wrong. Reload and try again." };

  // "<profileId>=standing:12,result:4;<profileId>=standing:9"
  const groups = String(data.get("groups") ?? "")
    .split(";")
    .filter(Boolean)
    .map((group) => {
      const [profileId, rows] = group.split("=");
      return {
        profileId,
        rows: (rows ?? "")
          .split(",")
          .map((part) => part.split(":"))
          .filter((pair) => pair.length === 2 && Number(pair[1]))
          .map(([kind, id]) => ({
            kind: kind === "result" ? ("result" as const) : ("standing" as const),
            id: Number(id),
          })),
      };
    })
    .filter((group) => group.profileId && group.rows.length);

  if (!groups.length) return { error: "Nothing to accept." };

  let people = 0;
  let results = 0;
  for (const group of groups) {
    const outcome = await linkMany(group.rows, group.profileId);
    results += outcome.done;
    if (!outcome.ok) {
      revalidatePath(`/clubs/${slug}/results`);
      return {
        error: results
          ? `${outcome.error} ${results} results were matched before it stopped.`
          : outcome.error,
      };
    }
    people += 1;
  }

  revalidatePath(`/clubs/${slug}/results`);
  return {
    notice: `${people} ${people === 1 ? "name" : "names"} matched, ${results} ${results === 1 ? "result" : "results"} in all.`,
  };
}
