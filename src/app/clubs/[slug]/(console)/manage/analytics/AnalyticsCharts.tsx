"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import MonthBarChart from "@/components/ui/MonthBarChart";
import RankedBars from "@/components/ui/RankedBars";
import EmptyState from "@/components/ui/EmptyState";
import type { AnalyticsMonth, AnalyticsNights } from "@/repositories/analytics.repository";
import { foldGames, worthSplittingByDay } from "@/utils/fold-rows";
import { mono, tokens } from "@/lib/tokens";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * The charts, client side because the chart library is.
 *
 * Months stay a real chart: twelve columns of four series is what one is for.
 * The rankings underneath are not, any more. They are at most five rows and a
 * club that meets on one night got a single ECharts bar floating in a 120px box
 * three times down the page, which is what the client called congested.
 * `RankedBars` lays them out as rows, the same way the people tab does.
 */
export default function AnalyticsCharts({
  months = [], nights, onlyNights = false,
}: {
  months?: AnalyticsMonth[];
  /** Only the nights tab reads this, and only that tab fetches it. */
  nights?: AnalyticsNights;
  onlyNights?: boolean;
}) {
  if (onlyNights && nights) {
    const games = foldGames(nights.games.map((g) => ({ label: g.label, value: g.played })));
    const days = nights.weekdays.filter((d) => d.bookings > 0);
    const showDays = worthSplittingByDay(nights.weekdays);

    return (
      <Box sx={{ display: "grid", gap: 2.5, alignItems: "start",
                 gridTemplateColumns: { xs: "minmax(0, 1fr)",
                                        md: "repeat(2, minmax(0, 1fr))" } }}>
        <Card title="Most booked nights">
          {nights.nights.length ? (
            <RankedBars rows={nights.nights.slice(0, 5).map((n) => ({
              label: n.label, value: n.bookings }))}
              suffix={(v) => (v === 1 ? "booking" : "bookings")} />
          ) : (
            <Quiet>Table bookings show here once somebody takes a place on a club night.</Quiet>
          )}
        </Card>

        <Card title="What is being played">
          {games.length ? (
            <RankedBars rows={games} suffix={(v) => (v === 1 ? "game" : "games")} />
          ) : (
            <Quiet>A booking carries the game when the member says what they are playing.</Quiet>
          )}
        </Card>

        {/* Only once there is more than one day to compare. A club that meets
            on Thursdays had this printing the same single bar as the nights
            list above it, under a different heading. */}
        {showDays ? (
          <Card title="By day of the week">
            <RankedBars emphasiseLeader={false}
              rows={[...days]
                .sort((a, b) => b.bookings - a.bookings)
                .map((d) => ({
                  label: WEEKDAYS[d.position - 1] ?? d.label, value: d.bookings }))}
              suffix={(v) => (v === 1 ? "booking" : "bookings")} />
          </Card>
        ) : null}

        <Card title="Event sales against capacity"
          span={showDays ? 1 : 2}>
          {nights.sellThrough.length ? (
            <Stack spacing={1.5}>
              {nights.sellThrough.map((event) => {
                const pct = event.places > 0
                  ? Math.round((event.sold / event.places) * 100) : 0;
                return (
                  <Stack key={`${event.label}-${event.starts}`} spacing={0.5}>
                    <Stack direction="row" spacing={1.5}
                      sx={{ alignItems: "baseline", justifyContent: "space-between" }}>
                      <Typography sx={{ fontWeight: 600, fontSize: "0.95rem", minWidth: 0,
                                        overflow: "hidden", textOverflow: "ellipsis",
                                        whiteSpace: "nowrap" }}>
                        {event.label}
                      </Typography>
                      <Typography sx={{ fontFamily: mono, fontSize: "0.72rem",
                                        color: tokens.inkMuted, flexShrink: 0 }}>
                        {event.sold} of {event.places || "no"} places
                        {event.places > 0 ? ` · ${pct}%` : ""}
                      </Typography>
                    </Stack>
                    <Box sx={{ height: 5, borderRadius: 3, overflow: "hidden",
                               backgroundColor: tokens.rule }}>
                      <Box sx={{ width: `${Math.min(Math.max(pct, 2), 100)}%`, height: "100%",
                                 backgroundColor: pct >= 90 ? tokens.positive : tokens.brass }} />
                    </Box>
                  </Stack>
                );
              })}
            </Stack>
          ) : (
            <Quiet>Sell-through appears once an event with tickets falls inside this window.</Quiet>
          )}
        </Card>
      </Box>
    );
  }

  const anyMonths = months.some((m) =>
    m.bookings > 0 || m.tickets > 0 || m.new_members > 0 || Number(m.revenue) > 0);

  if (!anyMonths) {
    return (
      <EmptyState title="Nothing to chart yet"
        description="This fills in as members join, book and buy. Pick a wider window if the club has been going longer than this one." />
    );
  }

  const labels = months.map((m) => m.label);

  return (
    <Box sx={{ display: "grid", gap: 2.5,
               gridTemplateColumns: { xs: "minmax(0, 1fr)",
                                      lg: "repeat(2, minmax(0, 1fr))" } }}>
      <Card title="Revenue by month">
        <MonthBarChart labels={labels} series={[
          { name: "Revenue", color: tokens.brass,
            values: months.map((m) => Number(m.revenue ?? 0)) },
        ]} />
      </Card>

      <Card title="Bookings, tickets and new members">
        <MonthBarChart labels={labels} series={[
          { name: "Table bookings", color: tokens.brand,
            values: months.map((m) => m.bookings) },
          { name: "Event tickets", color: tokens.positive,
            values: months.map((m) => m.tickets) },
          { name: "New members", color: tokens.brass,
            values: months.map((m) => m.new_members) },
        ]} />
      </Card>
    </Box>
  );
}

/** The same card the people tab uses, so both tabs read as one page. */
function Card({
  title, span = 1, children,
}: {
  title: string; span?: number; children: React.ReactNode;
}) {
  return (
    <Box sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 1.5,
               border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper,
               gridColumn: { md: `span ${span}` } }}>
      <Typography component="h3" sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                                       letterSpacing: "0.1em", color: tokens.inkMuted,
                                       mb: 2 }}>
        {title.toUpperCase()}
      </Typography>
      {children}
    </Box>
  );
}

function Quiet({ children }: { children: React.ReactNode }) {
  return (
    <Typography sx={{ fontSize: "0.92rem", lineHeight: 1.5, color: tokens.inkMuted }}>
      {children}
    </Typography>
  );
}
