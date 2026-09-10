"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import { saveOwnProfile } from "@/services/profiles.service";
import { SOCIAL_NETWORKS } from "@/utils/social-links";

export type ProfileFormState = { error?: string };

export async function saveProfileAction(
  _prev: ProfileFormState,
  data: FormData,
): Promise<ProfileFormState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Your session has expired. Sign in and try again." };

  const list = (key: string) => data.getAll(key).map(String);
  const text = (key: string) => String(data.get(key) ?? "");

  const result = await saveOwnProfile(viewer.id, {
    fullName: text("fullName"),
    bio: text("bio"),
    homePostcode: text("homePostcode"),
    travelMiles: text("travelMiles"),
    games: list("games"),
    armies: list("armies"),
    availability: list("availability"),
    ageGroups: list("ageGroups"),
    playStyle: list("playStyle"),
    // One field per network, named after it, so the form stays declarative.
    socials: SOCIAL_NETWORKS.map((label) => ({ label, url: text(`social-${label}`) })),
  });

  if (!result.ok) return { error: result.error };

  // Where to land. A path on this site and nothing else: an absolute URL in a
  // form field would turn saving a profile into an open redirect.
  const asked = text("done");
  const done = /^\/(?!\/)[\w\-./]*$/.test(asked) ? asked : `/members/${viewer.id}`;

  // The profile page is server rendered, so it would otherwise show the old
  // values straight after saving. Both, because the console draws the same
  // profile at its own address.
  revalidatePath(`/members/${viewer.id}`);
  if (done !== `/members/${viewer.id}`) revalidatePath(done);
  redirect(done);
}
