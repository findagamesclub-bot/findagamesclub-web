"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { downscaleImage } from "@/lib/images";
import {
  CLUB_MEDIA, mediaPathFor, rejectImage, type MediaOwner,
} from "@/utils/club-media";

export type LogoValue = {
  /** Already resolved for display: our file, or an imported absolute URL. */
  url: string | null;
  /** Set only for a file we host, which is the only kind we can delete. */
  path: string | null;
};

/**
 * The club's logo: one file, replaced rather than added to.
 *
 * Its own hook rather than a special case inside `useClubPhotos`, because the
 * questions are different. A photo is one of ten in an order somebody cares
 * about; a logo is the single mark that stands for the club, so a second
 * upload replaces the first and the file it replaced is queued for deletion.
 *
 * `touched` is the whole reason this holds state at all. A club imported with
 * a logo has a URL and no path, so a form that always posted the current path
 * would post an empty one and wipe the logo of every club that never opened
 * this panel. Nothing is posted until somebody changes something.
 */
export function useClubLogo(owner: MediaOwner, initial: LogoValue) {
  const [value, setValue] = useState<LogoValue>(initial);
  const [touched, setTouched] = useState(false);
  const [removed, setRemoved] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Drop what is on screen now, keeping its file for the save to delete.
   *
   * Done before the new value is set and never inside the updater that sets
   * it: React calls an updater twice in development and may call it again on
   * a replay, so revoking a blob URL or queueing a deletion in there happens
   * a number of times nobody chose. Updaters compute, handlers act.
   */
  function dropCurrent(held: LogoValue) {
    if (held.url?.startsWith("blob:")) URL.revokeObjectURL(held.url);
    if (held.path) setRemoved((paths) => [...paths, held.path!]);
  }

  async function pick(file: File) {
    setError(null);
    setBusy(true);

    const shrunk = await downscaleImage(file).catch(() => file);
    const refusal = rejectImage(shrunk);
    if (refusal) { setError(refusal); setBusy(false); return; }

    const key = crypto.randomUUID();
    const path = mediaPathFor(owner, "logo", shrunk.name || file.name, key);

    const { error: failed } = await createClient().storage
      .from(CLUB_MEDIA).upload(path, shrunk, { upsert: false });

    if (failed) {
      setError("That logo did not upload. Try again.");
      setBusy(false);
      return;
    }

    dropCurrent(value);
    setValue({ url: URL.createObjectURL(shrunk), path });
    setTouched(true);
    setBusy(false);
  }

  function clear() {
    setError(null);
    dropCurrent(value);
    setValue({ url: null, path: null });
    setTouched(true);
  }

  return { value, touched, removed, busy, error, pick, clear };
}
