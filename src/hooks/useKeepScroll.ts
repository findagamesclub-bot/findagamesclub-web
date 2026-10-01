"use client";

import { useEffect, useRef } from "react";

/**
 * Put the reader back where they were after a save.
 *
 * A server action that calls `revalidatePath` refreshes the route, and the
 * refresh takes the scroll position with it. On a console page that is several
 * sections deep, pressing Save at the bottom of the tickets throws you back to
 * the title, and the thing you were working on is now off the screen. The
 * client found it on the ticket editor; all three forms on that page do it.
 *
 * Captured in the event handler rather than watched continuously, so there is
 * one read of `scrollY` per save instead of one per scroll frame. Restored when
 * the action's state changes, which is the only signal that the round trip has
 * landed.
 *
 *     const keep = useKeepScroll(state);
 *     <form action={(data) => keep(() => submit(data))}>
 */
export function useKeepScroll(state: unknown): (run: () => void) => void {
  const at = useRef<number | null>(null);
  const seen = useRef(state);

  useEffect(() => {
    if (Object.is(seen.current, state)) return;
    seen.current = state;

    if (at.current === null) return;
    const top = at.current;
    at.current = null;

    // Instant, not smooth. A smooth scroll back up the page after a save draws
    // attention to the jump this exists to hide.
    window.scrollTo({ top, behavior: "instant" as ScrollBehavior });
  }, [state]);

  return (run) => {
    at.current = window.scrollY;
    run();
  };
}
