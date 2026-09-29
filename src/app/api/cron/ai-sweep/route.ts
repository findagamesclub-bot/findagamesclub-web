import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Fail anything that has been running too long.
 *
 * Without this a crashed request leaves a row in flight for ever: the person
 * watches a spinner nothing will ever finish, and cannot start another,
 * because the one-in-flight index is doing exactly its job. The sweep turns a
 * lost run into a failed one, which costs nothing, counts for nothing and
 * frees the way.
 *
 * Refuses to run without `CRON_SECRET` rather than running open, which is the
 * same call `/api/cron/listing-billing` makes: an endpoint anybody can hit
 * that rewrites job rows is worse than one that does nothing.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not set." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "not permitted" }, { status: 401 });
  }

  const supabase = createAdminClient() as unknown as {
    rpc(n: string, a: Record<string, unknown>): Promise<{
      data: unknown; error: { message: string } | null;
    }>;
  };
  const { data, error } = await supabase.rpc("sweep_ai_jobs", {});
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ swept: Number(data) || 0 });
}
