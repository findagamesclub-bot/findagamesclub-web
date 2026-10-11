import "server-only";

import { callRpc } from "@/lib/supabase/table";

/**
 * An event's pictures.
 *
 * Its own file rather than more of `eventEditor.repository`, which is about
 * the event's own fields and is near the size rule. Both sides go through
 * 0173's functions rather than a select, because `src/types/database.ts` has
 * not been regenerated and `check:columns` is right to refuse a table it does
 * not know about.
 */

export type EventImageRow = {
  id: number;
  src: string | null;
  storage_path: string | null;
  alt: string | null;
  position: number;
};

export const findEventImages = (eventId: number) =>
  callRpc<EventImageRow[]>("event_images_for", { p_event: eventId });

/** The whole list, replaced in one statement. Returns how many were kept. */
export const saveEventImages = (eventId: number, images: unknown) =>
  callRpc<number>("save_event_images", { p_event: eventId, p_images: images });
