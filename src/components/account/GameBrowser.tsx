"use client";

import { useDeferredValue, useMemo, useRef, useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import BusyOverlay from "@/components/ui/BusyOverlay";
import Pager from "@/components/ui/Pager";
import { usePagedList } from "@/hooks/usePagedList";
import FilterBar from "./FilterBar";
import GameCard from "./GameCard";
import type { MemberList } from "@/services/resultArmies.service";
import { monthLabel, pickerOptions } from "@/utils/booking-facets";
import {
  countUnrecorded, filterGames, gameMonths, tally,
  type GameFilter, type GameMoney, type GameSort,
} from "@/utils/game-filter";
import { mono, tokens } from "@/lib/tokens";
import type { MyGame } from "@/services/games.service";
import { PER_PAGE } from "@/utils/paging";

const PAGE = PER_PAGE.cards;

/** Search, filter and sort a member's games, then a grid. */
export default function GameBrowser({
  games, initialQuery = "", listsByClub = {},
}: {
  games: MyGame[];
  /** Arriving from a profile, already narrowed to that person. */
  initialQuery?: string;
  /**
   * Their own army lists, by club slug.
   *
   * One map for the page rather than a copy on every game: a member has a
   * handful of lists and twenty-four games, and the dialog only needs the
   * ones built at the club the game was played at.
   */
  listsByClub?: Record<string, MemberList[]>;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<GameFilter>("all");
  const [sort, setSort] = useState<GameSort>("recent");
  const [month, setMonth] = useState("");
  const [money, setMoney] = useState<GameMoney>("any");

  const settled = useDeferredValue(query);
  const [reordering, startReorder] = useTransition();
  const busy = reordering || settled !== query;

  const counts = useMemo(() => {
    const free = games.filter((g) => g.payment.total <= 0).length;
    const paid = games.filter(
      (g) => g.payment.total > 0 && g.payment.status !== "unpaid").length;
    return {
      all: games.length,
      played: games.filter((g) => g.outcome !== null).length,
      unrecorded: countUnrecorded(games),
      won: games.filter((g) => g.outcome === "won").length,
      free, paid,
      topay: games.length - free - paid,
      // A club that has never charged this member for a table has nothing for
      // a money picker to narrow, and three groups all reading the same
      // figure is a control that looks broken.
      priced: games.length - free > 0,
    };
  }, [games]);

  const months = useMemo(() => gameMonths(games), [games]);

  const results = useMemo(
    () => filterGames(games, { query: settled, filter, sort, month, money }),
    [games, settled, filter, sort, month, money],
  );
  const top = useRef<HTMLDivElement>(null);
  const paged = usePagedList(results, PAGE, top);
  const record = useMemo(() => tally(results), [results]);

  return (
    <Stack spacing={2.5}>
      <FilterBar
        query={query}
        onQuery={(value) => setQuery(value)}
        placeholder="Search by opponent, game, club or army"
        tabs={[
          { value: "all" as const, label: "All", count: counts.all },
          { value: "played" as const, label: "Scored", count: counts.played },
          { value: "unrecorded" as const, label: "No result", count: counts.unrecorded },
          { value: "won" as const, label: "Won", count: counts.won },
        ]}
        filter={filter}
        onFilter={(value) => startReorder(() => setFilter(value))}
        sorts={[
          { value: "recent" as const, label: "Most recent" },
          { value: "oldest" as const, label: "Oldest first" },
          { value: "opponent" as const, label: "Opponent" },
        ]}
        sort={sort}
        onSort={(value) => startReorder(() => setSort(value))}
        // The month only where there is more than one to tell apart, and the
        // money only where a club has ever charged this member for a table:
        // a picker that cannot narrow anything is a control offering to do
        // something it cannot.
        pickers={[
          ...(months.length > 1 ? [{
            label: "Month",
            value: month,
            onChange: (value: string) => startReorder(() => setMonth(value)),
            options: pickerOptions({
              any: "Every month", options: months, picked: month, label: monthLabel,
            }),
          }] : []),
          ...(counts.priced ? [{
            label: "Money",
            value: money,
            onChange: (value: string) =>
              startReorder(() => setMoney(value as GameMoney)),
            options: [
              { value: "any", label: "Any" },
              { value: "topay", label: `Still to pay (${counts.topay})` },
              { value: "paid", label: `Paid (${counts.paid})` },
              { value: "free", label: `Nothing to pay (${counts.free})` },
            ],
          }] : []),
        ]}
      />

      {counts.unrecorded && filter !== "unrecorded" ? (
        <Stack direction="row" spacing={1.5}
          sx={{ px: 2, py: 1.25, borderRadius: 2, alignItems: "center",
                backgroundColor: tokens.brassSoft }}>
          <Typography variant="body2" sx={{ color: "#5c4310", flex: 1 }}>
            {counts.unrecorded === 1
              ? "One game has no result yet. Either player can add it."
              : `${counts.unrecorded} games have no result yet. Either player can add them.`}
          </Typography>
          <Button size="small" variant="text" sx={{ color: "#5c4310", flexShrink: 0 }}
            onClick={() => startReorder(() => setFilter("unrecorded"))}>
            Fill them in
          </Button>
        </Stack>
      ) : null}

      {results.length ? (
        <BusyOverlay busy={busy} variant="dim" label="Updating games">
          <Box ref={top} sx={{ display: "grid", gap: 2.5, alignItems: "start",
                     gridTemplateColumns: {
                       xs: "minmax(0, 1fr)",
                       md: "repeat(2, minmax(0, 1fr))",
                       xl: "repeat(3, minmax(0, 1fr))",
                     } }}>
            {paged.shown.map((game) => (
              <GameCard key={game.id} game={game}
                myLists={listsByClub[game.club.slug] ?? []} />
            ))}
          </Box>

          <Pager page={paged.page} total={paged.total} noun="games" size={PAGE}
            onChange={paged.goTo} />

          {/* The record of whatever the filters left, so narrowing to one
              opponent or one game tells you how you do at it. */}
          {record.played ? (
            <Typography sx={{ fontFamily: mono, fontSize: "0.7rem", color: tokens.inkMuted,
                              textAlign: "center", pt: 0.5 }}>
              {`${record.played} SCORED · ${record.won}-${record.drawn}-${record.lost}`}
            </Typography>
          ) : null}
        </BusyOverlay>
      ) : (
        <Typography variant="body2" sx={{ color: tokens.inkMuted, py: 3 }}>
          {query
            ? `No game matching "${query}".`
            : month
              ? `Nothing in this group in ${monthLabel(month)}.`
              : "Nothing in this group."}
        </Typography>
      )}
    </Stack>
  );
}
