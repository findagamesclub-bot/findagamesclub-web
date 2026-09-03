import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { mono, tokens } from "@/lib/tokens";
import type { Breakdown } from "@/utils/member-analytics";

/**
 * Ordered as they stack: wins first, then draws, losses, and whatever nobody
 * scored. Same colours as the record donut higher up the page, so the reader
 * learns them once.
 */
const SEGMENTS = [
  { key: "won", color: tokens.positive, one: "win", many: "wins",
    of: (r: Breakdown) => r.won },
  { key: "drawn", color: tokens.inkMuted, one: "draw", many: "draws",
    of: (r: Breakdown) => r.drawn },
  { key: "lost", color: tokens.danger, one: "loss", many: "losses",
    of: (r: Breakdown) => r.lost },
  { key: "open", color: tokens.rule, one: "not scored", many: "not scored",
    of: (r: Breakdown) => r.played - r.won - r.drawn - r.lost },
] as const;

/**
 * A ranked list where the bar is the comparison and the numbers are the proof.
 *
 * Legacy shows the same shape and it is the right one: a reader takes the
 * order off the bars in one pass, then reads the record on whichever row they
 * stopped at. The bar is measured against the leader rather than against the
 * total, so second place looks like second place instead of like a rounding
 * error on a member who plays at four clubs.
 *
 * The leader is brass, everything else brand. Brass is the app's data
 * emphasis, and the top of a ranking is the one thing on the panel worth
 * emphasising.
 */
export default function RankedBars({
  rows, metric, empty, limit = 4,
}: {
  rows: Breakdown[];
  /** Which figure ranks them, which also decides the chip's wording. */
  metric: "won" | "played";
  empty: string;
  limit?: number;
}) {
  const shown = rows.slice(0, limit);
  // Widths are games played whatever the rows are ordered by, so a bar
  // always means the same thing on both opponent panels.
  const top = Math.max(1, ...shown.map((r) => r.played));

  if (!shown.length) {
    return (
      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>{empty}</Typography>
    );
  }

  return (
    <Stack spacing={1.75}>
      {shown.map((row, i) => {
        const value = row[metric];
        const lead = i === 0 && value > 0;
        const name = row.profileId ? (
          <NextLink href={`/members/${row.profileId}`}
            style={{ color: tokens.brand, textDecoration: "none", fontWeight: 700 }}>
            {row.label}
          </NextLink>
        ) : (
          <Box component="span" sx={{ fontWeight: 700 }}>{row.label}</Box>
        );

        return (
          <Stack key={row.key} spacing={0.75}>
            <Stack direction="row" spacing={1}
              sx={{ alignItems: "baseline", justifyContent: "space-between" }}>
              <Typography variant="body2" sx={{ minWidth: 0, overflow: "hidden",
                                                textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {name}
              </Typography>
              <Typography sx={{ fontFamily: mono, fontVariantNumeric: "tabular-nums",
                                fontSize: "0.72rem", fontWeight: 700, flexShrink: 0,
                                letterSpacing: "0.06em",
                                color: lead ? tokens.brass : tokens.inkMuted }}>
                {value} {metric === "won" ? (value === 1 ? "WIN" : "WINS") : "PLAYED"}
              </Typography>
            </Stack>

            <Typography sx={{ fontFamily: mono, fontSize: "0.68rem", color: tokens.inkMuted,
                              overflow: "hidden", textOverflow: "ellipsis",
                              whiteSpace: "nowrap" }}>
              {row.record}
              {row.winRate === null ? " · not scored" : ` · ${row.winRate}% win rate`}
              {row.clubs.length ? ` · ${row.clubs.join(", ")}` : ""}
            </Typography>

            <Box sx={{ height: 8, borderRadius: 4, backgroundColor: tokens.surface,
                       border: `1px solid ${tokens.rule}`, overflow: "hidden" }}>
              <Stack direction="row"
                sx={{ height: "100%", width: `${Math.max(4, (row.played / top) * 100)}%` }}>
                {SEGMENTS.map((seg) => {
                  const n = seg.of(row);
                  if (!n) return null;
                  return (
                    <Box key={seg.key} title={`${n} ${n === 1 ? seg.one : seg.many}`}
                      sx={{ flex: n, backgroundColor: seg.color }} />
                  );
                })}
              </Stack>
            </Box>
          </Stack>
        );
      })}
    </Stack>
  );
}
