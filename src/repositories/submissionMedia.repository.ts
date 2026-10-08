import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { CLUB_MEDIA } from "@/utils/club-media";

/**
 * Move an approved listing's pictures into the club's own folder.
 *
 * 0100 inserts `club_images` straight from the payload, so the rows already
 * point at `submissions/<id>/...` by the time this runs. Its own comment says
 * why that is left for the caller: the Storage API is an HTTP call and cannot
 * happen inside the transaction that created the club.
 *
 * Through the service role, because neither folder belongs to the admin doing
 * the approving: the submission policy admits its owner and the club policy
 * admits that club's team, and a site admin is neither.
 *
 * The move matters beyond tidiness. A club can only delete files under
 * `clubs/<its id>/`, so a photo left behind in the submission folder is one
 * its owner could take off the page and never off the disk.
 *
 * Every failure is swallowed deliberately. The bucket is public, so a file
 * that did not move still renders from its old path and the club page is
 * right; a club that cannot be approved because a copy timed out is worse
 * than one whose photos live in a tidier place than they might.
 */
export async function moveSubmissionMedia(submissionId: number, clubId: number) {
  const admin = createAdminClient();
  const from = `submissions/${submissionId}/`;
  const to = `clubs/${clubId}/`;

  const { data: rows } = await admin
    .from("club_images")
    .select("id, storage_path")
    .eq("club_id", clubId)
    .like("storage_path", `${from}%`);

  for (const row of rows ?? []) {
    const path = row.storage_path;
    if (!path) continue;
    const next = to + path.slice(from.length);

    const { error } = await admin.storage.from(CLUB_MEDIA).move(path, next);
    if (error) {
      console.error("[listing] photo stayed in the submission folder:", path, error.message);
      continue;
    }
    await admin.from("club_images").update({ storage_path: next }).eq("id", row.id);
  }
}

/**
 * The same move for the one logo, which is not a `club_images` row.
 *
 * Returns the path the club should end up pointing at, so the caller writes it
 * once rather than this guessing on its behalf.
 */
export async function moveSubmissionLogo(
  submissionId: number, clubId: number, logoPath: string,
): Promise<string> {
  const from = `submissions/${submissionId}/`;
  if (!logoPath.startsWith(from)) return logoPath;

  const next = `clubs/${clubId}/` + logoPath.slice(from.length);
  const { error } = await createAdminClient().storage
    .from(CLUB_MEDIA).move(logoPath, next);

  if (error) {
    console.error("[listing] logo stayed in the submission folder:", logoPath, error.message);
    return logoPath;
  }
  return next;
}

/** Writes the club's logo as the service role, after the move has settled. */
export async function setApprovedClubLogo(clubId: number, path: string) {
  const { error } = await createAdminClient()
    .from("clubs").update({ logo_path: path, logo_url: null }).eq("id", clubId);
  if (error) throw new Error(error.message);
}
