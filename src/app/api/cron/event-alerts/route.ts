import { NextResponse } from "next/server";

import { cronRefusal } from "../guard";
import { runEventAlerts } from "@/services/alert-digest.service";

/**
 * Saved searches, once a day.
 *
 * The matching is the events page's own `listEvents`, so a saved search and its
 * alert cannot disagree about what matches. Each alert is marked as looked at
 * whether or not anything was found, so nothing is written to twice.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const refusal = cronRefusal(request);
  if (refusal) return refusal;

  try {
    return NextResponse.json({ ran: true, ...(await runEventAlerts()) });
  } catch (error) {
    console.error("[alerts] the run failed", error);
    return NextResponse.json(
      { error: "The alert run failed, so nothing was marked as sent." }, { status: 500 });
  }
}
