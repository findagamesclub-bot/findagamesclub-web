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
  const commitRef = useRef(commit);
  commitRef.current = commit;

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (draft === value) return;
    const timer = setTimeout(() => commitRef.current(draft), delay);
    return () => clearTimeout(timer);
  }, [draft, value, delay]);

  return [draft, setDraft];
}
