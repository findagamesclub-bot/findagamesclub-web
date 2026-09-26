"use client";

import { useEffect, useRef } from "react";

/**
 * Do something once, when an action comes back having worked.
 *
 * Every dialog here used to compare the action's state to the last one it saw
 * and close during render:
 *
 *     if (state !== seen) { setSeen(state); if (state.notice) onClose(); }
 *
 * Which works in the browser and loops for ever on the server. `useActionState`
 * hands back the initial value it was given on each server render, and the
 * value is written inline as `{}`, so `state !== seen` is a comparison between
 * two different empty objects and is always true. The render-phase update never
 * settles and React gives up with "Too many re-renders", which reaches the
 * reader as a 500 on a page that works perfectly once they are past it.
 *
 * `/my-clubs/results` served that 500 for weeks. The mobile sweep saw it, wrote
 * the status to the log and counted the route as fine, so nothing ever said so.
 *
 * An effect instead. Effects do not run on the server, so there is nothing to
 * loop, and closing a dialog one frame late is invisible. Syncing form fields
 * during render is still right and is left alone: there a late frame paints the
 * previous game's values, which is the flicker that pattern exists to stop.
 */
export function useActionSuccess(
  state: { notice?: string | null },
  onSuccess: () => void,
) {
  // Held in a ref so a caller passing an inline arrow does not re-fire the
  // effect on every render. Written in its own effect rather than during
  // render, and declared first so it lands before the one below reads it.
  const fire = useRef(onSuccess);
  useEffect(() => { fire.current = onSuccess; });

  useEffect(() => {
    if (state.notice) fire.current();
  }, [state]);
}
