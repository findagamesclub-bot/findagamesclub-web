"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DISCUSSION_PHOTOS } from "@/lib/supabase/storage";
import { MAX_POST_IMAGES, rejectImage, uploadPath } from "@/utils/post-images";

export type PickedPhoto = {
  key: string;
  /** Local object URL. The file is shown before the upload finishes. */
  preview: string;
  /** Set once the upload lands. Until then the form has nothing to submit. */
  path: string | null;
  alt: string;
};

/**
 * Photos on a new thread.
 *
 * Uploaded straight from the browser rather than posted through the server
 * action: a Server Action body is capped at 1MB by default, and two phone
 * photos are several times that. Storage policies scope the write to the
 * member's own folder, so the browser holding the file changes nothing.
 */
export function usePostPhotos(profileId: string) {
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const room = MAX_POST_IMAGES - photos.length;

  async function add(files: File[]) {
    setError(null);
    if (!files.length) return;

    if (files.length > room) {
      setError(`Two photos at most. ${room === 1 ? "One more" : "None"} will fit.`);
      if (room < 1) return;
    }

    const taking = files.slice(0, Math.max(room, 0));
    const refused = taking.map(rejectImage).find(Boolean);
    if (refused) {
      setError(refused);
      return;
    }

    setBusy(true);
    const supabase = createClient();

    for (const file of taking) {
      const key = crypto.randomUUID();
      const preview = URL.createObjectURL(file);
      setPhotos((prev) => [...prev, { key, preview, path: null, alt: "" }]);

      const path = uploadPath(profileId, file.name, key);
      const { error: failed } = await supabase.storage
        .from(DISCUSSION_PHOTOS)
        .upload(path, file, { cacheControl: "31536000", upsert: false });

      if (failed) {
        // Drop the row rather than leave a preview that will never post.
        setPhotos((prev) => prev.filter((p) => p.key !== key));
        URL.revokeObjectURL(preview);
        setError("That photo would not upload. Try again, or pick another.");
        continue;
      }

      setPhotos((prev) => prev.map((p) => (p.key === key ? { ...p, path } : p)));
    }

    setBusy(false);
  }

  function remove(key: string) {
    setError(null);
    setPhotos((prev) => {
      const going = prev.find((p) => p.key === key);
      if (going) URL.revokeObjectURL(going.preview);
      // The uploaded file is left in the bucket. Nothing links to it, and a
      // delete here would need a policy that lets a member delete by path.
      return prev.filter((p) => p.key !== key);
    });
  }

  function describe(key: string, alt: string) {
    setPhotos((prev) => prev.map((p) => (p.key === key ? { ...p, alt } : p)));
  }

  return { photos, busy, error, room, add, remove, describe };
}
