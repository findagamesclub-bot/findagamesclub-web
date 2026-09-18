"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { downscaleImage } from "@/lib/images";
import { publicUrl } from "@/lib/supabase/storage";
import { CLUB_MEDIA, clubMediaPath, rejectImage, type MediaKind }
  from "@/utils/club-media";

/**
 * The one picture on a thing a club owns: a shop item, an event.
 *
 * The row holds a URL rather than a path, because the imported rows carry
 * links to the old site and both kinds have to keep working. A file uploaded
 * here lands in the club's own folder and the row holds the public URL of it,
 * so nothing that reads it has to know the difference.
 *
 * The old file is left in the bucket when a picture is replaced. That is the
 * orphan sweep's job, and it is written up in DEFERRED.md: deleting it here
 * would break the page for anybody who replaced a picture and then cancelled.
 */
export function useClubImage(clubId: number, kind: MediaKind, initial: string) {
  const [src, setSrc] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    setBusy(true);

    const shrunk = await downscaleImage(file).catch(() => file);
    const refusal = rejectImage(shrunk);
    if (refusal) { setError(refusal); setBusy(false); return; }

    const path = clubMediaPath(clubId, kind, shrunk.name || file.name, crypto.randomUUID());
    const supabase = createClient();
    const { error: failed } = await supabase.storage
      .from(CLUB_MEDIA).upload(path, shrunk, { upsert: false });

    if (failed) setError("That picture did not upload. Try again.");
    else setSrc(publicUrl(CLUB_MEDIA, path));

    setBusy(false);
  }

  return { src, busy, error, upload, clear: () => { setSrc(""); setError(null); } };
}
