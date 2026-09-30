import { NextResponse } from "next/server";

/**
 * The same door on every scheduled route.
 *
 * Without `CRON_SECRET` the route refuses outright rather than running open: a
 * job that emails every club in the directory is not a thing to leave on the
 * public internet by omission.
 */
export function cronRefusal(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not set, so this route is closed." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not for you." }, { status: 401 });
  }
  return null;
}
