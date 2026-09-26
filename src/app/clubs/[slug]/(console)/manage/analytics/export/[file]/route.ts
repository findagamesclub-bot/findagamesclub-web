import { NextResponse } from "next/server";

import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getClubDetail } from "@/services/clubDetail.service";
import { getClubAnalytics } from "@/services/analytics.service";
import { toCsv, csvFilename } from "@/utils/csv";
import { londonNow } from "@/utils/dates";
import { periodLabel, readPeriod } from "@/utils/analytics-period";

/**
 * The spreadsheet the treasurer asked for.
 *
 * "CSV export for sales/tax reporting and general club management" is the
 * client's line, and legacy has no export of any kind, so this is new.
 *
 * Guarded by `analytics.view` exactly like the page, and checked here rather
 * than trusted from it: a route is an address somebody can type, and the club
 * console is not what an attacker uses.
 *
 * Two files rather than one big one. A month of revenue and a roster of
 * memberships go to different people for different reasons, and a tax return
 * does not want a members list in the middle of it.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; file: string }> },
) {
  const { slug, file } = await params;

  const viewer = await getCurrentProfile();
  if (!viewer) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const club = await getClubDetail(slug);
  if (!club) return NextResponse.json({ error: "No such club." }, { status: 404 });

  const access = await getClubAccess(club.id, viewer);
  if (!access.can("analytics.view")) {
    return NextResponse.json({ error: "Not yours to export." }, { status: 403 });
  }

  const period = readPeriod(new URL(request.url).searchParams.get("period") ?? undefined);
  const today = londonNow().date;
  // Each file needs exactly one of the six reads, so it asks for that one
  // rather than for all of them and throwing five away.
  const data = await getClubAnalytics(
    club.id, period, today, file === "revenue" ? "months" : "health", period);

  let headers: string[];
  let rows: (string | number | null)[][];
  let name: string;

  if (file === "revenue") {
    // A row per month, so it can be summed, filtered and pasted into whatever
    // the accountant actually uses.
    headers = ["Month", "Table bookings", "Event tickets", "New members",
               "Posts", "Revenue (GBP)"];
    rows = data.months.map((m) => [
      m.month_start, m.bookings, m.tickets, m.new_members, m.posts,
      Number(m.revenue ?? 0).toFixed(2),
    ]);
    name = csvFilename(["revenue", club.slug, period]);
  } else if (file === "memberships") {
    headers = ["Tier", "Members"];
    rows = data.health.byTier.map((t) => [t.tier, t.members]);
    // The three figures the page shows, so the file says the same thing it did.
    rows.push([], ["Due to renew", data.health.dueSoon],
              ["Lapsed", data.health.lapsed],
              ["Never paid", data.health.neverPaid],
              ["Approved total", data.health.total]);
    name = csvFilename(["memberships", club.slug, today]);
  } else {
    return NextResponse.json(
      { error: "There is no export by that name." }, { status: 404 });
  }

  const body = toCsv(headers, rows);

  return new NextResponse(body, {
    headers: {
      // The charset matters as much as the byte order mark: without it some
      // readers guess, and a club with an accent in its name arrives mangled.
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      // A window somebody picked is not a thing to serve from a cache.
      "Cache-Control": "no-store",
      "X-Analytics-Window": periodLabel(period),
    },
  });
}
