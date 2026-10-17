import { NextResponse } from "next/server";

import { getCurrentProfile } from "@/services/auth.service";
import { getRevenueLines } from "@/services/siteGrowth.service";
import { toCsv, csvFilename } from "@/utils/csv";
import { londonNow } from "@/utils/dates";
import { periodLabel, readPeriod } from "@/utils/analytics-period";

/**
 * Every listing fee and every featured slot, one row each.
 *
 * The client's words: "I need to be able to clearly track and download any
 * revenue and the details of that revenue over time periods for tax purposes."
 * So this is the ledger rather than the chart: a line per transaction with the
 * date, the period it bought, the renewal date, the club, the note and the
 * amount, which is the list they asked for in that order.
 *
 * Checked here rather than trusted from the page, exactly as the club's own
 * export is: a route is an address somebody can type, and the admin console is
 * not what anybody attacking this would use. `admin_revenue_lines` refuses a
 * non-admin as well, so this is the second of two locks rather than the only
 * one.
 *
 * Money is written in pounds, not pence. A column of 1500s that means £15 is a
 * column somebody will sum and file.
 */
export async function GET(request: Request) {
  const viewer = await getCurrentProfile();
  if (!viewer) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (viewer.role !== "admin") {
    return NextResponse.json({ error: "Not yours to export." }, { status: 403 });
  }

  const period = readPeriod(new URL(request.url).searchParams.get("period") ?? undefined);

  let lines;
  try {
    ({ lines } = await getRevenueLines(period));
  } catch {
    return NextResponse.json(
      { error: "The ledger would not load. Try again." }, { status: 502 });
  }

  const headers = [
    "Kind", "Money received", "Date", "Club", "Billing period",
    "Period from", "Renews", "Amount (GBP)", "Currency",
    "Method", "Reference", "Note",
  ];

  const rows = lines.map((line) => [
    line.kind === "listing" ? "Listing fee" : "Featured slot",
    // Two kinds of line, and the difference is the one thing a money export
    // must not flatten: a listing fee was paid and recorded, a featured slot
    // is a placement sold and settled offline (0191). A single Revenue column
    // would be the file inventing a receipt.
    line.received ? "Yes" : "Booked, settled off site",
    line.on_date,
    line.club_name,
    line.plan,
    line.period_start,
    line.period_end,
    (line.amount_pence / 100).toFixed(2),
    line.currency,
    line.method,
    line.reference,
    line.note,
  ]);

  // The totals the page shows, so a reader can check the file against it
  // without adding a column up by hand. Kept apart for the same reason the
  // rows are.
  const sum = (kind: string) => lines
    .filter((line) => line.kind === kind)
    .reduce((total, line) => total + line.amount_pence, 0);

  rows.push([],
    ["Window", "", periodLabel(period)],
    ["Listing fees received", "", "", "", "", "", "", (sum("listing") / 100).toFixed(2)],
    ["Featured slots booked", "", "", "", "", "", "", (sum("featured") / 100).toFixed(2)],
    ["Lines", "", "", "", "", "", "", String(lines.length)]);

  const today = londonNow().date;
  return new NextResponse(toCsv(headers, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        `attachment; filename="${csvFilename(["site-revenue", today])}"`,
      "Cache-Control": "no-store",
      "X-Analytics-Window": periodLabel(period),
    },
  });
}
