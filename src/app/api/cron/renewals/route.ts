import { NextResponse } from "next/server";

import { cronRefusal } from "../guard";
import { runRenewalReminders } from "@/services/renewal-notify.service";

/**
 * Club memberships running out, and ones that have.
 *
 * Separate from the listing-billing route because they are different money:
 * that one is a club paying us, this one is a member paying their club. They
 * happen to both be renewals and nothing else about them is shared.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const refusal = cronRefusal(request);
  if (refusal) return refusal;

  try {
    return NextResponse.json({ ran: true, ...(await runRenewalReminders()) });
  } catch (error) {
    console.error("[renewals] the run failed", error);
    return NextResponse.json(
      { error: "The renewal run failed part way through." }, { status: 500 });
  }
}
