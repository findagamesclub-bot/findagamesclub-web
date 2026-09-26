"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getClubDetail } from "@/services/clubDetail.service";
import { resolveForClub } from "@/services/moderation.service";
import type { ModerationState } from "@/app/admin/moderation/actions";

export type { ModerationState } from "@/app/admin/moderation/actions";

/**
 * The club answering a report on its own club.
 *
 * Checked here and again in `resolve_club_flag`, which is the one that counts:
 * it re-derives the club from the flag rather than trusting the slug on the
 * form, so a manager at one club cannot answer another club's reports by
 * posting a different slug.
 */
export async function clubModerationAction(
  _prev: ModerationState, data: FormData,
): Promise<ModerationState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in to answer a report." };

  const flag = Number(data.get("flag") ?? 0);
  if (!flag) return { error: "That report is not here any more." };

  // The slug is for revalidating, never for deciding. `resolve_club_flag`
  // re-derives the club from the flag itself and checks `club_can` on that, so
  // a manager at one club cannot answer another club's reports by posting a
  // different slug, and a form that forgot the slug gets a stale page rather
  // than a refusal about a club that is plainly there.
  const slug = String(data.get("slug") ?? "");
  const club = slug ? await getClubDetail(slug) : null;
  if (club) {
    const access = await getClubAccess(club.id, viewer);
    if (!access.can("board.moderate")) {
      return { error: "That is not yours to answer." };
    }
  }

  const done = await resolveForClub(flag, String(data.get("action") ?? ""),
    String(data.get("reason") ?? ""));
  if (!done.ok) return { error: done.error };

  if (slug) {
    revalidatePath(`/clubs/${slug}/manage/moderation`);
    revalidatePath(`/clubs/${slug}/board`);
  }
  return { notice: done.notice };
}
