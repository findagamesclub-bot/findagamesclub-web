"use server";

import { revalidatePath } from "next/cache";

import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getClubDetail } from "@/services/clubDetail.service";
import * as badges from "@/services/badges.service";

export type BadgeState = { error?: string; notice?: string };

/**
 * Everything the badges page does, behind one action.
 *
 * The capability is checked here as well as in SQL. The database is the
 * authority, but a refusal that arrives as a Postgres error has no sentence a
 * club can read, and the screen should not offer a button it knows will fail.
 */
export async function badgeAction(
  _prev: BadgeState, data: FormData,
): Promise<BadgeState> {
  const slug = String(data.get("slug") ?? "");
  const intent = String(data.get("intent") ?? "");

  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in first." };

  const club = await getClubDetail(slug);
  if (!club) return { error: "That club is not here." };

  const access = await getClubAccess(club.id, viewer);
  if (!access.can("members.manage")) {
    return { error: "Only an owner or a manager can change badges." };
  }

  const done = await run(intent, club.id, data);
  if (done.ok) revalidatePath(`/clubs/${slug}/manage/badges`);
  return done.ok ? { notice: done.notice } : { error: done.error };
}

function run(intent: string, clubId: number, data: FormData) {
  if (intent === "save") {
    const badge = Number(data.get("badge") ?? 0);
    return badges.saveBadge({
      club: clubId,
      // Zero means "new", because an empty hidden field reads as 0 and a badge
      // id is never 0.
      badge: badge > 0 ? badge : null,
      label: String(data.get("label") ?? ""),
      description: String(data.get("description") ?? ""),
      icon: String(data.get("icon") ?? ""),
      tone: String(data.get("tone") ?? ""),
      active: String(data.get("active") ?? "true") === "true",
    });
  }

  if (intent === "award") {
    const badge = Number(data.get("badge") ?? 0);
    if (!badge) return Promise.resolve({ ok: false as const, error: "Pick a badge." });
    // One field carrying several ids, because a multi-select posts one value
    // per choice and FormData.getAll is the only way to read them all.
    const people = data.getAll("member").map(String).filter(Boolean);
    return badges.awardBadge(badge, people, String(data.get("note") ?? ""));
  }

  if (intent === "revoke") {
    const award = Number(data.get("award") ?? 0);
    if (!award) return Promise.resolve({ ok: false as const, error: "Nothing to take back." });
    return badges.revokeAward(award);
  }

  return Promise.resolve({ ok: false as const, error: "That is not something this page does." });
}
