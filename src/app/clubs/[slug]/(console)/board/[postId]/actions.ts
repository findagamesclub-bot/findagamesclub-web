"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import { readThread } from "@/services/discussions.service";

/**
 * Opening a thread is reading it.
 *
 * A server action rather than `after()` in the page, because a Server
 * Component cannot touch request APIs inside `after` and the Supabase client
 * reads cookies. It failed silently there: the watermark was never written,
 * the count never cleared, and nothing said why. The Next docs are explicit
 * about it under "With request APIs".
 *
 * The board is revalidated too, or going back shows the counts the page was
 * rendered with rather than the ones that are true now.
 */
export async function markThreadReadAction(postId: number, slug: string) {
  const viewer = await getCurrentProfile();
  if (!viewer) return;

  await readThread(postId);
  revalidatePath(`/clubs/${slug}/board`);
}
