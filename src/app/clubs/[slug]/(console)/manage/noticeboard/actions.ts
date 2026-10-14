"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getClubDetail } from "@/services/clubDetail.service";
import { saveNotices } from "@/services/noticeboard.service";

export type NoticeboardState = { error?: string; notice?: string };

export async function saveNoticeboardAction(
  _prev: NoticeboardState,
  data: FormData,
): Promise<NoticeboardState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in to change the noticeboard." };

  const slug = String(data.get("slug") ?? "");
  const club = await getClubDetail(slug);
  if (!club) return { error: "Something went wrong. Reload and try again." };

  // Checked here as well as in SQL, so a helper who lost the role between
  // opening the page and pressing Save is told rather than bounced.
  const access = await getClubAccess(club.id, viewer);
  if (!access.can("noticeboard.manage")) {
    return { error: "You cannot change this club's noticeboard." };
  }

  // Posted as a pair of parallel lists rather than as JSON: an id with no
  // message is a notice taken down, and a message with no id is a new one.
  const ids = data.getAll("noticeId").map(String);
  const result = await saveNotices(club.id, data.getAll("notice").map((value, i) => ({
    id: Number(ids[i]) || null,
    message: String(value),
  })));

  revalidatePath(`/clubs/${slug}/manage/noticeboard`);
  revalidatePath(`/clubs/${slug}`);

  if (!result.ok) return { error: result.error };
  return { notice: "Noticeboard saved." };
}
