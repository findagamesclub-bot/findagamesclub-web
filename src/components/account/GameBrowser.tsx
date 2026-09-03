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
import {
  countUnrecorded, filterGames, tally, type GameFilter, type GameSort,
} from "@/utils/game-filter";
import { mono, tokens } from "@/lib/tokens";
import type { MyGame } from "@/services/games.service";
import { PER_PAGE } from "@/utils/paging";

const PAGE = PER_PAGE.cards;

/** Search, filter and sort a member's games, then a grid. */
export default function GameBrowser({
  games, initialQuery = "",
}: {
  games: MyGame[];
  /** Arriving from a profile, already narrowed to that person. */
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<GameFilter>("all");
  const [sort, setSort] = useState<GameSort>("recent");

  const settled = useDeferredValue(query);
  const [reordering, startReorder] = useTransition();
  const busy = reordering || settled !== query;

  const counts = useMemo(() => ({
    all: games.length,
    played: games.filter((g) => g.outcome !== null).length,
    unrecorded: countUnrecorded(games),
    won: games.filter((g) => g.outcome === "won").length,
  }), [games]);

  const results = useMemo(
    () => filterGames(games, { query: settled, filter, sort }),
    [games, settled, filter, sort],
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
            {paged.shown.map((game) => <GameCard key={game.id} game={game} />)}
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
          {query ? `No game matching "${query}".` : "Nothing in this group."}
        </Typography>
      )}
    </Stack>
  );
}
