"use client";

import { useMemo } from "react";
import { reportKey, type ReportedKeys } from "@/utils/reported-set";

/**
 * "Have I already reported this one?"
 *
 * The keys arrive from the server as plain strings, because an object with a
 * method on it cannot cross into a client component. This turns them back into
 * a Set once per render rather than scanning the array for every button on a
 * thread with forty replies.
 */
export function useReported(keys: ReportedKeys) {
  const held = useMemo(() => new Set(keys), [keys]);
  return (type: string, id: number) => held.has(reportKey(type, id));
}
