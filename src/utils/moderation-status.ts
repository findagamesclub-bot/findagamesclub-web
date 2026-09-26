/**
 * What a report's state is called, and what colour it wears.
 *
 * One map, because the same fact is drawn on three screens: the admin's queue,
 * the club's queue and the member's own list. They shipped with two different
 * vocabularies and two different treatments for one status, which is the thing
 * "consistency is the priority" exists to stop.
 *
 * Pure, so the words can be tested without rendering anything.
 */

export type StatusTone = "waiting" | "down" | "kept" | "quiet";

export type StatusTag = { label: string; tone: StatusTone };

export function statusTag(status: string, gone = false): StatusTag {
  if (status === "actioned") return { label: "Taken down", tone: "down" };
  if (status === "dismissed") return { label: "Left as it is", tone: "kept" };
  if (status === "withdrawn") return { label: "Taken back", tone: "quiet" };
  // Still open with nothing behind it: the author deleted it before anybody
  // looked, which is a different ending from an admin taking it down.
  if (gone) return { label: "Gone already", tone: "quiet" };
  return { label: "Waiting", tone: "waiting" };
}
