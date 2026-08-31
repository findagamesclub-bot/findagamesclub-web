"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import StarIcon from "@mui/icons-material/Star";
import { mono, tokens, type Faction } from "@/lib/tokens";
import type { RatingBand } from "@/utils/review-breakdown";

/**
 * The rating breakdown, and the filter.
 *
 * Legacy filters with a dropdown (detail.js:5786). A dropdown hides the one
 * thing worth knowing — how the ratings are spread — behind a click, and offers
 * ratings nobody gave, so choosing "2 stars" on a club with none empties the
 * list. Here the bars are the control: what you can filter by is exactly what
 * somebody has actually said.
 */
export default function ReviewBreakdown({
  bands, total, selected, onSelect, faction,
}: {
  bands: RatingBand[];
  total: number;
  /** Null is "all ratings". */
  selected: number | null;
  onSelect: (rating: number | null) => void;
  faction: Faction;
}) {
  // One rating with every review in it is not a distribution, and a bar at 100%
  // filtering to the list you are already looking at is a button that does
  // nothing.
  if (bands.length < 2) return null;

  const row = (
    key: string, label: string, count: number, percent: number, value: number | null,
  ) => {
    const on = selected === value;
    return (
      <Stack
        key={key}
        component="button"
        type="button"
        onClick={() => onSelect(value)}
        aria-pressed={on}
        direction="row"
        spacing={1.5}
        sx={{
          alignItems: "center", width: "100%", cursor: "pointer",
          px: 1.25, py: 0.875, borderRadius: 1, border: "none", textAlign: "left",
          backgroundColor: on ? faction.soft : "transparent",
          "&:hover": { backgroundColor: on ? faction.soft : tokens.surface },
        }}
      >
        <Stack direction="row" spacing={0.35}
          sx={{ alignItems: "center", width: 44, flexShrink: 0 }}>
          <Typography sx={{ fontFamily: mono, fontSize: "0.8rem",
                            fontWeight: on ? 700 : 500,
                            color: on ? faction.deep : tokens.ink }}>
            {label}
          </Typography>
          {value !== null ? (
            <StarIcon sx={{ fontSize: 13, color: tokens.brass }} />
          ) : null}
        </Stack>

        <Box sx={{ flex: 1, height: 7, borderRadius: 4, backgroundColor: tokens.rule,
                   overflow: "hidden" }}>
          <Box sx={{ width: `${percent}%`, height: "100%",
                     backgroundColor: on ? faction.base : tokens.brass }} />
        </Box>

        <Typography sx={{ fontFamily: mono, fontSize: "0.78rem", width: 26,
                          textAlign: "right", flexShrink: 0,
                          color: on ? faction.deep : tokens.inkMuted,
                          fontWeight: on ? 700 : 400 }}>
          {count}
        </Typography>
      </Stack>
    );
  };

  return (
    <Stack spacing={0.25} role="group" aria-label="Filter reviews by rating"
      sx={{ p: 1, borderRadius: 2, border: `1px solid ${tokens.rule}`,
            backgroundColor: tokens.paper }}>
      {row("all", "All", total, 100, null)}
      {bands.map((band) =>
        row(String(band.rating), String(band.rating), band.count, band.percent, band.rating))}
    </Stack>
  );
}
