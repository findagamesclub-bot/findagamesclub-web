"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Keeps a text field responsive while delaying the work behind it.
 *
 * Typing "Didcot" into a filter fires six requests without this. The field
 * stays controlled locally and the committed value is pushed up once typing
 * pauses. External changes — a chip being removed — sync back down.
 */
export function useDebouncedField(
  value: string,
  commit: (next: string) => void,
  delay = 400,
): [string, (next: string) => void] {
  const [draft, setDraft] = useState(value);

  // Written in an effect, not during render. A ref assigned while rendering is
  // a side effect in a function React is allowed to run twice or abandon.
  const commitRef = useRef(commit);
  useEffect(() => { commitRef.current = commit; });

  // React's own "adjusting state when a prop changes" pattern: compare against
  // the value last rendered with and set during render, which React handles by
  // re-rendering immediately and never painting the stale draft. The effect
  // this replaces painted the old text first and corrected it after.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(value);
  }

  useEffect(() => {
    if (draft === value) return;
    const timer = setTimeout(() => commitRef.current(draft), delay);
    return () => clearTimeout(timer);
  }, [draft, value, delay]);

  return [draft, setDraft];
}
