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
/**
 * Whether this render is one the sync should run on.
 *
 * Pulled out so the mount case can be tested without React. `null` means
 * nothing has been seen yet, which is the first render, and an effect would
 * have run there.
 */
export function shouldSync(
  seen: readonly unknown[] | null, keys: readonly unknown[],
): boolean {
  return seen === null
    || seen.length !== keys.length
    || keys.some((key, i) => !Object.is(key, seen[i]));
}

export function useWhenChanged(keys: readonly unknown[], sync: () => void) {
  // Null, not `keys`. An effect runs on mount as well as on a change, and
  // seeding this with the first render's keys skipped that: a dialog opened on
  // an existing row never filled the fields the sync was responsible for.
  //
  // It cost a real bug. `TicketDialog` holds the quantity as its own string
  // state starting at "", filled by this sync, while the rest of the row is
  // seeded from the prop. So the quantity box came up empty on every edit and
  // pressing Update wrote "no limit" over whatever the club had set. The label
  // and the price looked right the whole time, which is why it read as a save
  // that had not happened rather than as a field that had been cleared.
  const [seen, setSeen] = useState<readonly unknown[] | null>(null);

  if (shouldSync(seen, keys)) {
    setSeen(keys);
    sync();
  }
}
