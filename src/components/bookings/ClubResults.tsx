"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LockIcon from "@mui/icons-material/Lock";
import ClubResultDialog from "./ClubResultDialog";
import BusyOverlay from "@/components/ui/BusyOverlay";
import Pager from "@/components/ui/Pager";
import UrlFilterBar from "@/components/ui/UrlFilterBar";
import { matchFacet, monthLabel, pickerOptions } from "@/utils/booking-facets";
import { confirmationLabel, deploymentLabel } from "@/utils/result-meta";
import { PLAYED_SORTS, PLAYED_TABS, type PlayedSort, type PlayedTab }
  from "@/utils/played-log";
import { nightLabel } from "@/utils/dates";
import { mono, tokens, type Faction } from "@/lib/tokens";
import type { ClubResult, PlayedLogResult } from "@/services/clubResults.service";
import { PER_PAGE } from "@/utils/paging";

/**
 * Games played at this club, for the club.
 *
 * The account pages only show a member the games they were in, which left a
 * dispute between two other members with no way out: nobody could reach it to
 * settle it. This is the club's way in, and the only place a manager can rule
 * on a game they did not play.
 *
 * Filtered in SQL and paged in the address rather than sifted in the browser.
 * It used to read the newest forty and narrow those, which is right for a
 * member's own handful and wrong for a club: ten tables twice a week is a
 * thousand a year, and a month filter over a window of forty answers about the
 * window. A filtered list is then a link as well, so "every game still waiting
 * on us in September" can be sent to whoever is clearing it.
 */
export default function ClubResults({
  view, slug, faction, filters,
}: {
  view: PlayedLogResult;
  slug: string;
  faction: Faction;
  filters: {
    tab: PlayedTab; sort: PlayedSort; query: string;
    month: string; game: string; member: string; page: number;
  };
}) {
  const [chosen, setChosen] = useState<ClubResult | null>(null);
  const [sifting, setSifting] = useState(false);

  const counts = view.counts;
  const narrowed = Boolean(filters.query || filters.month || filters.game || filters.member);

  return (
    <>
      <Box sx={{ mb: 2 }}>
        <UrlFilterBar
          query={filters.query}
          placeholder="Search by player or game"
          tab={filters.tab}
          tabs={PLAYED_TABS.map((tab) => ({
            ...tab,
            // Zero rather than nothing when the read failed: the bar prints
            // what it is given, and `undefined` draws a blank where a number
            // should be.
            count: counts ? counts[tab.value] : 0,
          }))}
          sort={filters.sort}
          sorts={PLAYED_SORTS.map((sort) => ({ ...sort }))}
          // Each one appears only where the club has more than one of that
          // thing to tell apart. A picker offering the single game a club
          // plays cannot narrow anything, which is the rule the roster
          // filters already follow.
          pickers={[
            ...(view.facets.months.length > 1 ? [{
              label: "Month", param: "month", value: filters.month,
              options: pickerOptions({
                any: "Every month", options: view.facets.months,
                picked: filters.month, label: monthLabel,
              }),
            }] : []),
            ...(view.facets.games.length > 1 ? [{
              label: "Game", param: "game",
              // Resolved to the spelling the option carries. The filter folds
              // case, so a bookmark holding the other capitals narrows the
              // list correctly and would otherwise leave the picker reading
              // "Kill Team (0)" over the two games it just found.
              value: matchFacet(filters.game, view.facets.games),
              // A game with nothing behind it is named by its own title,
              // which is the value, so it needs no second wording.
              options: pickerOptions({
                any: "Any game", options: view.facets.games,
                picked: matchFacet(filters.game, view.facets.games),
                label: (value) => value,
              }),
            }] : []),
            ...(view.facets.players.length > 1 ? [{
              label: "Member", param: "member", value: filters.member,
              options: pickerOptions({
                any: "Anybody", options: view.facets.players, picked: filters.member,
              }),
            }] : []),
          ]}
          defaults={{ state: "all", sort: "newest", month: "", game: "", member: "" }}
          onBusy={setSifting}
        />
      </Box>

      {/* Disputed first: it is stuck until the club rules on it. Unscored games
          are only waiting on somebody remembering, so they are a nudge rather
          than an alarm. Both count the whole club under the filters in force,
          never the twenty-five rows on this page. */}
      {counts?.disputed ? (
        <Stack direction="row" spacing={1.5}
          sx={{ px: 2, py: 1.25, mb: 2, borderRadius: 2, alignItems: "center",
                backgroundColor: "#FBE9E7" }}>
          <LockIcon sx={{ fontSize: 17, color: "#8a2f22" }} />
          <Typography variant="body2" sx={{ color: "#8a2f22" }}>
            {counts.disputed === 1
              ? "One result is disputed and waiting on you."
              : `${counts.disputed} results are disputed and waiting on you.`}
          </Typography>
        </Stack>
      ) : null}

      {counts?.unscored && filters.tab !== "unscored" ? (
        <Typography variant="body2" sx={{ color: "#5c4310", mb: 2, fontWeight: 600 }}>
          {counts.unscored === 1
            ? "One game has no score yet. Either player can add it, or you can."
            : `${counts.unscored} games have no score yet. Either player can add one, or you can.`}
        </Typography>
      ) : null}

      <BusyOverlay busy={sifting} variant="dim" label="Filtering games">
        <Stack spacing={1}>
          {view.failed ? (
            <Typography variant="body2" sx={{ color: tokens.danger, py: 2 }}>
              The list would not load. Reload the page and try again.
            </Typography>
          ) : view.rows.length === 0 ? (
            <Typography variant="body2" sx={{ color: tokens.inkMuted, py: 2 }}>
              {filters.query
                ? `Nothing matching "${filters.query}" in this group.`
                : filters.month
                  ? `Nothing in this group in ${monthLabel(filters.month)}.`
                  : narrowed
                    ? "Nothing matches these filters."
                    : "Nothing has been played here yet. Games appear the day after the table."}
            </Typography>
          ) : null}

          {view.rows.map((result) => (
            <Stack key={result.id} direction={{ xs: "column", sm: "row" }} spacing={2}
              onClick={() => setChosen(result)}
              // A missing score is the thing to act on, so it is the thing that
              // gets the edge. A settled result is finished, not urgent, and was
              // wearing the highlight the unscored ones needed.
              sx={{ px: 2, py: 1.5, borderRadius: 1.5, cursor: "pointer",
                    alignItems: { sm: "center" },
                    // Anything the club still has to answer takes the edge: a
                    // game with no score, and a submitted one waiting on a
                    // ruling. The page says four are waiting on you, so four
                    // rows have to look like it.
                    border: `1px solid ${
                      result.confirmation === "disputed" ? tokens.danger
                        : needsClub(result) ? tokens.brass
                        : tokens.rule}`,
                    backgroundColor: tokens.paper,
                    "&:hover": { borderColor: faction.base } }}>
              <Box sx={{ minWidth: 92, flexShrink: 0 }}>
                <Typography sx={{ fontFamily: mono, fontSize: "0.72rem", color: tokens.inkMuted }}>
                  {nightLabel(result.date).toUpperCase()}
                </Typography>
              </Box>

              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle2" noWrap>
                  {result.homeName} v {result.awayName}
                </Typography>
                <Typography variant="body2" noWrap sx={{ color: tokens.inkMuted }}>
                  {[result.title, result.mission, deploymentLabel(result.deployment)]
                    .filter(Boolean).join(" · ")}
                </Typography>
              </Box>

              <Typography sx={{ fontFamily: mono, fontWeight: 700, flexShrink: 0,
                                fontSize: result.recorded ? "1.05rem" : "0.75rem",
                                color: result.recorded ? tokens.ink : "#5c4310" }}>
                {result.recorded
                  ? `${result.homeScore} – ${result.awayScore}`
                  : "ADD A SCORE"}
              </Typography>

              {/* Submitted used to show nothing, because from a player's view it
                  is the ordinary state. On the club's own page it means the
                  opposite: it is the one thing waiting on them. */}
              {result.recorded ? (
                <Chip size="small"
                  label={result.confirmation === "submitted"
                    ? "Waiting on you"
                    : confirmationLabel(result.confirmation)}
                  icon={result.locked ? <LockIcon sx={{ fontSize: 13 }} /> : undefined}
                  // Brass only where the club still has to act. A settled game
                  // is a record, and wearing the same colour as the queue made
                  // eight rows look like eight jobs.
                  sx={{ fontSize: "0.66rem", height: 22, flexShrink: 0,
                        ...chipTone(result),
                        "& .MuiChip-icon": { color: "inherit" } }} />
              ) : null}
            </Stack>
          ))}
        </Stack>
      </BusyOverlay>

      <Pager page={filters.page} total={view.total} noun="games" size={PER_PAGE.rows}
        href={{
          path: `/clubs/${slug}/manage/scores`,
          params: {
            state: filters.tab === "all" ? undefined : filters.tab,
            q: filters.query || undefined,
            month: filters.month || undefined,
            game: filters.game || undefined,
            member: filters.member || undefined,
            sort: filters.sort === "newest" ? undefined : filters.sort,
          },
        }} />

      <ClubResultDialog result={chosen} slug={slug} faction={faction}
        onClose={() => setChosen(null)} />
    </>
  );
}

/** A game the club still has to answer: no score at all, or one nobody ruled. */
function needsClub(result: ClubResult): boolean {
  return !result.recorded || result.confirmation === "submitted";
}

/** Red where players disagree, brass where the club owes an answer, quiet once settled. */
function chipTone(result: ClubResult) {
  if (result.confirmation === "disputed") {
    return { backgroundColor: "#FBE9E7", color: "#8a2f22" };
  }
  if (needsClub(result)) return { backgroundColor: tokens.brassSoft, color: "#5c4310" };
  return { backgroundColor: tokens.surface, color: tokens.inkMuted };
}
