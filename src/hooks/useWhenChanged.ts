"use client";

import { useState } from "react";

/**
 * Run something during render, once, whenever one of `keys` changes.
 *
 * Thirteen dialogs filled their fields from props in an effect:
 *
 *     useEffect(() => { if (!open) return; setDraft(row ?? EMPTY); }, [open, row]);
 *
 * Effects run after paint, so opening a dialog on a second row shows the first
 * row's values for a frame and then corrects itself. `useActionSuccess` already
 * says this in its own comment: closing a dialog one frame late is invisible,
 * and painting stale form values is not. The rule
 * `react-hooks/set-state-in-effect` is complaining about the same thing.
 *
 * Setting state during render is the supported way round it. React re-renders
 * immediately, before anything is painted, so the stale frame never exists.
 *
 * `keys` is compared like an effect's dependency array, so a call site reads
 * the same as the effect it replaces.
 */
export function useWhenChanged(keys: readonly unknown[], sync: () => void) {
  const [seen, setSeen] = useState(keys);

  const changed = seen.length !== keys.length
    || keys.some((key, i) => !Object.is(key, seen[i]));

  if (changed) {
    setSeen(keys);
    sync();
  }
}
