import "server-only";

import * as repo from "@/repositories/siteGrowth.repository";
import { periodRange, type PeriodKey } from "@/utils/analytics-period";
import { londonToday } from "./bookingCalendar.service";

/**
 * The site's own dashboard, as one read.
 *
 * Every club has had analytics since 0117 and the site has had a count of how
 * many clubs exist. The client's words: "there are no analytics or dashboards
 * for the site admin currently."
 *
 * One wave of two. Neither needs the other's answer, and a failure in either
 * costs its own half of the page rather than the whole of it: the figures are
 * useful without the charts and the charts are useful without the figures.
 */

export type SiteGrowth = Awaited<ReturnType<typeof getSiteGrowth>>;

export async function getSiteGrowth(period: PeriodKey) {
  const { from, to } = periodRange(period, londonToday());

  const [months, summary] = await Promise.all([
    repo.findGrowthMonths(from, to).catch((): null => null),
    repo.findGrowthSummary(from, to).catch((): null => null),
  ]);

  return {
    from,
    to,
    months: months ?? [],
    summary,
    // A read that failed is not a site with nothing on it. Without this the
    // page draws an empty chart over a database it could not reach, which is
    // the same plausible lie every list in this console carries a guard
    // against.
    failed: months === null || summary === null,
  };
}
