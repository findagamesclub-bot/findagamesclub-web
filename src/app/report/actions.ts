"use server";

import { getCurrentProfile } from "@/services/auth.service";
import { report } from "@/services/moderation.service";

export type ReportState = { error?: string; notice?: string };

/**
 * Reporting a piece of content, from wherever it is shown.
 *
 * One action for all six kinds rather than one per screen, because the rule is
 * the same everywhere and the database decides whether the reporter could see
 * the thing they are reporting.
 *
 * Nothing is revalidated. Reporting does not change what anybody can see, by
 * design: legacy keeps a flagged review on the page and so do we, so a report
 * that visibly removed something would be a report doing an admin's job.
 *
 * Which leaves exactly one thing on the page that should change, the button
 * itself, and `ReportButton` latches that locally on success. Revalidating the
 * path to move one label would re-render the club page, the thread and every
 * review on it for nothing.
 */
export async function reportAction(
  _prev: ReportState, data: FormData,
): Promise<ReportState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in to report something." };

  const done = await report(
    String(data.get("type") ?? ""),
    Number(data.get("id") ?? 0),
    String(data.get("reason") ?? ""),
  );
  return done.ok ? { notice: done.notice } : { error: done.error };
}
