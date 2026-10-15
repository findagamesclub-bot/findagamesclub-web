"use client";

import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import MonthBarChart from "@/components/ui/MonthBarChart";
import { GROWTH_SERIES, SITE_REVENUE } from "@/utils/site-growth";
import type { GrowthMonthRow } from "@/repositories/siteGrowth.repository";
import { monthYear } from "@/utils/dates";
import { tokens } from "@/lib/tokens";

/**
 * The two pictures: what was added, and what came in.
 *
 * Grouped rather than stacked, both of them. The first stacks nothing because
 * clubs, events and accounts are three different units and a total of them
 * means nothing. The second could stack, since both are pence, and does not:
 * the client asked for "revenue growth BY revenue type", which is a question
 * about comparing the two, and a stack buries the smaller one inside the
 * larger.
 *
 * A client component because ECharts needs a DOM, which is why the series
 * lists live in `utils/site-growth.ts`: importing them from a `server-only`
 * service would drag `next/headers` into the browser bundle and take the page
 * down with a build error. 0186 paid for that once.
 */
export default function SiteGrowthCharts({ months }: { months: GrowthMonthRow[] }) {
  // "Sep 2026" is what the axis says everywhere else on this site, through the
  // same formatter, which reads the date with UTC getters so nobody behind UTC
  // sees a month label a day early.
  const labels = months.map((m) => monthYear(m.month_start) ?? "");

  if (!months.length) {
    return (
      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        Nothing to draw yet. Pick a longer window.
      </Typography>
    );
  }

  return (
    <Stack spacing={4}>
      <Stack spacing={1.25}>
        <Typography sx={{ fontWeight: 700 }}>What the site gained</Typography>
        <MonthBarChart
          labels={labels}
          series={GROWTH_SERIES.map((s) => ({
            name: s.short,
            color: s.colour,
            values: months.map((m) => Number(m[s.column] ?? 0)),
          }))}
        />
      </Stack>

      <Stack spacing={1.25}>
        <Typography sx={{ fontWeight: 700 }}>Money in, by what it was for</Typography>
        <MonthBarChart
          labels={labels}
          unit="£"
          series={SITE_REVENUE.map((s) => ({
            name: s.label,
            color: s.colour,
            // Pounds, not pence: an axis reading 150000 for £1,500 is a figure
            // nobody can check against the one above it.
            values: months.map((m) => Number(m[s.column] ?? 0) / 100),
          }))}
        />
      </Stack>
    </Stack>
  );
}
