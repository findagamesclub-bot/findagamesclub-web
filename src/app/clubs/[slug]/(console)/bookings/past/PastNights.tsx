"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import NextLink from "next/link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import BusyOverlay from "@/components/ui/BusyOverlay";
import Pager from "@/components/ui/Pager";
import UrlFilterBar from "@/components/ui/UrlFilterBar";
import { monthLabel, pickerOptions } from "@/utils/booking-facets";
import { PLAYED_SORTS, type PlayedSort } from "@/utils/played-log";
import { nightLabel } from "@/utils/dates";
import { PER_PAGE } from "@/utils/paging";
import { mono, tokens, type Faction } from "@/lib/tokens";
import type { PlayedLogResult } from "@/services/clubResults.service";

/**
 * Nights at this club that have already happened.
 *
 * Read-only, which is the whole difference from the club's own Scores page:
 * this answers "who played, and what was the score", and ruling on a game is
 * the club's job on their own screen. A member who wants to put a score on
 * their own game does it from Your games, which is where the link goes.
 *
 * No tabs. The client asked for a date and a member, and a strip of groups a
 * member cannot act on is a control offering to do something it cannot.
 */
export default function PastNights({
  slug, faction, view, filters,
}: {
  slug: string;
  faction: Faction;
  view: PlayedLogResult;
  filters: {
    sort: PlayedSort; query: string; month: string; member: string; page: number;
  };
}) {
  const [sifting, setSifting] = useState(false);
  const narrowed = Boolean(filters.query || filters.month || filters.member);

  return (
    <Stack spacing={2}>
      <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", fontWeight: 700,
                        letterSpacing: "0.1em", color: tokens.inkMuted }}>
        {view.counts
          ? [
              // The month leads, because every figure beside it is about that
              // month and a count with no window on it is the figure a reader
              // has no way to check.
              filters.month ? monthLabel(filters.month).toUpperCase() : null,
              `${view.counts.all} ${view.counts.all === 1 ? "TABLE" : "TABLES"} PLAYED`,
              view.counts.unscored ? `${view.counts.unscored} WITH NO SCORE` : null,
            ].filter(Boolean).join(" · ")
          : "THE COUNT WOULD NOT LOAD"}
      </Typography>

      <UrlFilterBar
        query={filters.query}
        placeholder="Search by player or game"
        tab=""
        sort={filters.sort}
        sorts={PLAYED_SORTS.map((sort) => ({ ...sort }))}
        pickers={[
          ...(view.facets.months.length > 1 ? [{
            label: "Month", param: "month", value: filters.month,
            options: pickerOptions({
              any: "Every month", options: view.facets.months,
              picked: filters.month, label: monthLabel,
            }),
          }] : []),
          ...(view.facets.players.length > 1 ? [{
            label: "Member", param: "member", value: filters.member,
            options: pickerOptions({
              any: "Anybody", options: view.facets.players, picked: filters.member,
            }),
          }] : []),
        ]}
        defaults={{ sort: "newest", month: "", member: "" }}
        onBusy={setSifting}
      />

      <BusyOverlay busy={sifting} variant="dim" label="Filtering nights">
        <Stack spacing={1}>
          {view.failed ? (
            <Typography variant="body2" sx={{ color: tokens.danger, py: 2 }}>
              The list would not load. Reload the page and try again.
            </Typography>
          ) : view.rows.length === 0 ? (
            <Typography variant="body2" sx={{ color: tokens.inkMuted, py: 2 }}>
              {filters.query
                ? `Nothing matching "${filters.query}".`
                : filters.month
                  ? `Nothing played here in ${monthLabel(filters.month)}.`
                  : narrowed
                    ? "Nothing matches these filters."
                    : "Nothing has been played here yet. A table appears the day after the night it was booked for."}
            </Typography>
          ) : null}

          {view.rows.map((row) => (
            <Stack key={row.id} direction={{ xs: "column", sm: "row" }} spacing={2}
              sx={{ px: 2, py: 1.5, borderRadius: 1.5, alignItems: { sm: "center" },
                    border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper }}>
              <Box sx={{ minWidth: 92, flexShrink: 0 }}>
                <Typography sx={{ fontFamily: mono, fontSize: "0.72rem", color: tokens.inkMuted }}>
                  {nightLabel(row.date).toUpperCase()}
                </Typography>
              </Box>

              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle2" noWrap>
                  {row.homeName} v {row.awayName}
                </Typography>
                <Typography variant="body2" noWrap sx={{ color: tokens.inkMuted }}>
                  {[row.title, row.mission].filter(Boolean).join(" · ")}
                </Typography>
              </Box>

              <Typography sx={{ fontFamily: mono, fontWeight: 700, flexShrink: 0,
                                fontSize: row.recorded ? "1.05rem" : "0.72rem",
                                color: row.recorded ? tokens.ink : tokens.inkMuted }}>
                {row.recorded ? `${row.homeScore} – ${row.awayScore}` : "NO SCORE"}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </BusyOverlay>

      <Pager page={filters.page} total={view.total} noun="tables" size={PER_PAGE.rows}
        href={{
          path: `/clubs/${slug}/bookings/past`,
          params: {
            q: filters.query || undefined,
            month: filters.month || undefined,
            member: filters.member || undefined,
            sort: filters.sort === "newest" ? undefined : filters.sort,
          },
        }} />

      {/* A row with no score on it is the thing somebody comes here and then
          wants to do something about, so the page says where. A link, not a
          bold phrase: a sentence naming a screen you cannot get to from it is
          a dead end wearing an affordance. */}
      <Box sx={{ borderTop: `1px solid ${tokens.rule}`, pt: 2 }}>
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          A score missing from one of your own games is yours to add.{" "}
          <Link component={NextLink} href="/account/games"
            sx={{ color: faction.deep, fontWeight: 600 }}>
            Your games
          </Link>
        </Typography>
      </Box>
    </Stack>
  );
}
