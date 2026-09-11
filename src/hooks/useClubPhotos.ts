"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { downscaleImage } from "@/lib/images";
import {
  CLUB_MEDIA, MAX_CLUB_IMAGES, clubMediaPath, rejectImage, type MediaKind,
} from "@/utils/club-media";

export type ClubPhoto = {
  key: string;
  /** Shown straight away, before the upload finishes. */
  preview: string;
  /** Set once the file lands. Until then there is nothing to save. */
  path: string | null;
  /** Imported photos carry a URL to a file we do not own. */
  src: string | null;
  alt: string;
};

/**
 * A club's photos, uploaded from the browser.
 *
 * Two things happen before the file leaves: it is drawn onto a canvas at no
 * more than 1600px on its longest edge, and re-encoded as WebP. A phone camera
 * produces 4000px and 8MB, the bucket refuses anything over 5MB, and nothing
 * on the site renders wider than 1200. Uploading the original would fail on
 * exactly the phones most likely to be used on a club night.
 */
export function useClubPhotos(clubId: number, initial: ClubPhoto[]) {
  const [photos, setPhotos] = useState<ClubPhoto[]>(initial);
  const [busy, setBusy] = useState(false);
  /** Paths whose files go once the save that drops their rows succeeds. */
  const [removed, setRemoved] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const room = MAX_CLUB_IMAGES - photos.length;

  async function add(files: File[], kind: MediaKind = "photos") {
    setError(null);
    if (!files.length) return;

    if (files.length > room) {
      setError(room > 0
        ? `Ten photos at most, so only ${room} more will fit.`
        : "Ten photos at most. Remove one to add another.");
      if (room < 1) return;
    }

    setBusy(true);
    const supabase = createClient();

    for (const file of files.slice(0, Math.max(0, room))) {
      const shrunk = await downscaleImage(file).catch(() => file);
      const refusal = rejectImage(shrunk);
      if (refusal) { setError(refusal); continue; }

      const key = crypto.randomUUID();
      const path = clubMediaPath(clubId, kind, shrunk.name || file.name, key);
      const preview = URL.createObjectURL(shrunk);
      setPhotos((held) => [...held, { key, preview, path: null, src: null, alt: "" }]);

      const { error: failed } = await supabase.storage
        .from(CLUB_MEDIA).upload(path, shrunk, { upsert: false });

      if (failed) {
        setError("That photo did not upload. Try again.");
        setPhotos((held) => held.filter((p) => p.key !== key));
        URL.revokeObjectURL(preview);
        continue;
      }
      setPhotos((held) => held.map((p) => (p.key === key ? { ...p, path } : p)));
    }

    setBusy(false);
  }

  /**
   * Off the list now, out of the bucket when the form is saved.
   *
   * Deleting the file on the click breaks the club's public page for anybody
   * who removes a photo and then leaves without saving: the row still points
   * at the path and the path is gone. A file left behind is clutter nobody
   * sees; a broken header is on every visitor's screen.
   */
  function remove(key: string) {
    const going = photos.find((p) => p.key === key);
    if (!going) return;

    setPhotos((held) => held.filter((p) => p.key !== key));
    if (going.preview.startsWith("blob:")) URL.revokeObjectURL(going.preview);

    const path = going.path;
    if (path) setRemoved((held) => [...held, path]);
  }

  const move = (key: string, by: -1 | 1) =>
    setPhotos((held) => {
      const at = held.findIndex((p) => p.key === key);
      const to = at + by;
      if (at < 0 || to < 0 || to >= held.length) return held;
      const next = [...held];
      const moving = next[at]!;
      next[at] = next[to]!;
      next[to] = moving;
      return next;
    });

  const describe = (key: string, alt: string) =>
    setPhotos((held) => held.map((p) => (p.key === key ? { ...p, alt } : p)));

  return { photos, removed, busy, error, room, add, remove, move, describe };
}
