"use client";

import { useRef } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import EmptyState from "@/components/ui/EmptyState";
import Pager from "@/components/ui/Pager";
import { usePagedList } from "@/hooks/usePagedList";
import { PER_PAGE } from "@/utils/paging";
import { EARLY_SIGNAL_LABEL, EARLY_SIGNAL_NOTE } from "@/utils/meta-signal";
import { display, mono, tokens } from "@/lib/tokens";

export type MetaRow = {
  label: string;
  /** What it sits under: a faction for a detachment, a detachment for a disposition. */
  parent?: string;
  /** Null when nothing has been scored, which is not the same as nought. */
  winRate: number | null;
  games: number;
  earlySignal: boolean;
  /** An extra figure in the footer, such as how often it turned up. */
  note?: string;
};

/**
 * One ranking, as a grid of cards.
 *
 * Every tab of the tracker is a list of things with a rate and a sample, so
 * they are all this component: six hand-rolled lists would drift the first
 * time any one changed, and the first thing to drift would be what an early
 * signal looks like.
 *
 * A grid rather than full-width rows, which is the ninth list in this app to
 * need saying: a row per faction is a band of mostly empty screen, and thirty
 * factions became a scroll out of something that fits on two views. Three
 * across at `lg`, two at `sm`, one below, every track `minmax(0, 1fr)` so a
 * long faction name cannot set the column width.
 *
 * Paged, because a ranking is not the same size on every tab: thirty factions
 * fit on two screens and the matchup table is every faction against every
 * other, which is hundreds. Twelve to a page is four rows of a three-across
 * grid, which is the size `PER_PAGE.cards` already settled on for every other
 * card grid in the app. The panels that show a top six pass their own count
 * and never draw a pager at all.
 */
export default function MetaRows({
  rows, empty, emptyNote, noun = "rows", perPage = PER_PAGE.cards, paged = true,
}: {
  rows: MetaRow[];
  empty: string;
  emptyNote: string;
  /** What the pager counts, e.g. "factions". Singularised by `Pager`. */
  noun?: string;
  perPage?: number;
  /**
   * False on a panel that has already cut the list down to a top six. `Pager`
   * prints its count line even when there is only one page, and under a top
   * six that line read "6 ROWS" beneath a club with ten factions: noise at
   * best, and a wrong total at worst.
   */
  paged?: boolean;
}) {
  const top = useRef<HTMLDivElement>(null);
  const list = usePagedList(rows, perPage, top);

  if (rows.length === 0) {
    return <EmptyState title={empty} description={emptyNote} />;
  }

  return (
    <Stack spacing={2}>
    <Box ref={top} sx={{ display: "grid", gap: 2, alignItems: "stretch",
               gridTemplateColumns: { xs: "minmax(0, 1fr)",
                                      sm: "repeat(2, minmax(0, 1fr))",
                                      lg: "repeat(3, minmax(0, 1fr))" } }}>
      {list.shown.map((row, index) => (
        <Stack key={`${row.parent ?? ""}:${row.label}`} spacing={1.25}
          sx={{ height: "100%", p: 2, borderRadius: 1.5,
                border: `1px solid ${row.earlySignal ? tokens.rule : tokens.brass}`,
                backgroundColor: tokens.paper }}>
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "flex-start" }}>
            <Typography sx={{ fontFamily: mono, fontSize: "0.72rem", fontWeight: 700,
                              color: tokens.inkMuted, pt: 0.35 }}>
              {(list.page - 1) * perPage + index + 1}
            </Typography>
            <Stack spacing={0.1} sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontFamily: display, fontWeight: 700,
                                fontSize: "1rem", lineHeight: 1.25 }}>
                {row.label}
              </Typography>
              {row.parent ? (
                <Typography sx={{ fontSize: "0.78rem", color: tokens.inkMuted }}>
                  {row.parent}
                </Typography>
              ) : null}
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1}
            sx={{ alignItems: "baseline", flexWrap: "wrap" }} useFlexGap>
            {/* Never 0% for something nobody has scored with: it reads as "it
                always loses" when the truth is that no game has finished. */}
            <Typography sx={{ fontFamily: mono, fontSize: "1.5rem", fontWeight: 700,
                              lineHeight: 1,
                              color: row.winRate === null ? tokens.inkMuted : tokens.brass }}>
              {row.winRate === null ? "no rate yet" : `${row.winRate.toFixed(1)}%`}
            </Typography>
            {row.earlySignal ? (
              <Tooltip title={EARLY_SIGNAL_NOTE}>
                <Box component="span"
                  sx={{ px: 0.75, py: 0.25, borderRadius: 0.75,
                        fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                        backgroundColor: tokens.brassSoft, color: "#5c4310" }}>
                  {EARLY_SIGNAL_LABEL}
                </Box>
              </Tooltip>
            ) : null}
          </Stack>

          <Box sx={{ height: 6, borderRadius: 3,
                     backgroundColor: tokens.surface, overflow: "hidden" }}>
            <Box sx={{ height: "100%", borderRadius: 3,
                       width: `${Math.max(0, Math.min(100, row.winRate ?? 0))}%`,
                       backgroundColor: row.earlySignal ? tokens.rule : tokens.brass }} />
          </Box>

          {/* A spacer above the footer, so a row of cards lines its footers up
              however long the names above them ran. */}
          <Box sx={{ flex: 1 }} />

          <Typography sx={{ pt: 1, borderTop: `1px solid ${tokens.rule}`,
                            fontFamily: mono, fontSize: "0.66rem",
                            color: tokens.inkMuted }}>
            {[`${row.games} scored ${row.games === 1 ? "game" : "games"}`, row.note]
              .filter(Boolean).join(" · ")}
          </Typography>
        </Stack>
      ))}
    </Box>

    {paged ? (
      <Pager page={list.page} total={list.total} size={perPage}
        noun={noun} onChange={list.goTo} />
    ) : null}
    </Stack>
  );
}
