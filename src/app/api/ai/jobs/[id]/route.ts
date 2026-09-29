import { NextResponse } from "next/server";
import { getJob } from "@/services/aiJobs.service";
import { getCurrentProfile } from "@/services/auth.service";

/**
 * One job, for the page watching it.
 *
 * A route rather than a server action, because this is polled: an action is a
 * POST that invalidates the router cache on every call, and a page asking
 * "finished yet?" every two seconds should not re-render itself each time.
 *
 * RLS is the guard. `army_ai_jobs_select` admits the person the run belongs to
 * and the club's team, so somebody guessing an id gets nothing.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await getCurrentProfile();
  if (!viewer) return NextResponse.json({ error: "signed out" }, { status: 401 });

  const { id } = await params;
  const job = await getJob(Number(id));
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json(job, {
    headers: { "cache-control": "no-store" },
  });
}
