import Box from "@mui/material/Box";
import NextLink from "next/link";
import Typography from "@mui/material/Typography";
import type { SvgIconComponent } from "@mui/icons-material";
import { mono, tokens } from "@/lib/tokens";

export type Stat = {
  label: string;
  value: string | number | null | undefined;
  icon?: SvgIconComponent;
  note?: string;
  /**
   * Makes the figure a link. Used where the stat IS the question — "how many
   * tables" is asked by somebody about to book one, and the club page is long
   * enough that the booking panel sits below the fold on a laptop.
   */
  href?: string;
  /** Replaces the figure when linked, e.g. "10 · Book". */
  linkLabel?: string;
};

/**
 * Key facts as a datasheet stat line — the format this audience already reads.
 * Missing values render a dash rather than collapsing, so columns stay aligned
 * across cards and a gap reads as "not stated" instead of zero.
 *
 * Icons sit with the figure, not the label: at a glance you're scanning for
 * "when" and "how much", and the glyph finds that faster than the word does.
 *
 * `columns` is the caller's job because a card and a full-width page have very
 * different room, and CSS breakpoints can't tell them apart.
 *
 * `dense` puts the label beside the figure instead of above it. Stacked, four
 * stats cost four rows of text, which was most of the height of a club card
 * and pushed everything below it off the screen. Beside, they cost two.
 */
export default function StatLine({
  stats,
  columns = 4,
  dense = false,
}: {
  stats: Stat[];
  columns?: 2 | 4;
  dense?: boolean;
}) {
  return (
    <Box
      component="dl"
      sx={{
        m: 0,
        display: "grid",
        // Breakpoints track the viewport, not the card, so four columns inside a
        // 330px card clipped "Tue 18:00" to "Tue …". Callers set this instead.
        gridTemplateColumns: `repeat(${Math.min(stats.length, columns)}, minmax(0, 1fr))`,
        columnGap: dense ? 1.5 : { xs: 1.5, sm: 2 },
        rowGap: dense ? 0.5 : { xs: 1.5, sm: 2 },
        borderTop: `1px solid ${tokens.rule}`,
        borderBottom: `1px solid ${tokens.rule}`,
        py: dense ? 1 : 1.25,
      }}
    >
      {stats.map((stat) => {
        const hasValue = stat.value !== null && stat.value !== undefined && stat.value !== "";
        const Icon = stat.icon;
        const linked = Boolean(stat.href && hasValue);
        return (
          <Box
            key={stat.label}
            sx={{
              minWidth: 0,
              // Label then figure, close together. Pushing the figure to the
              // right of its cell left a gulf after the label and parked the
              // number against the next column's label, so "Tue 18:00 TABLES"
              // read as one thing.
              ...(dense && {
                display: "flex",
                alignItems: "baseline",
                gap: 0.625,
              }),
            }}
          >
            <Typography
              component="dt"
              variant="overline"
              // No fixed width. Reserving one clipped "Tue 18:00" to "Tue 18…",
              // and a time you cannot read is worse than a ragged column.
              sx={{
                color: "text.secondary",
                display: "block",
                flexShrink: 0,
                // Two pairs share a 150px cell on a tablet, and at the full
                // overline size the label left "Tue 18:00" three pixels short.
                ...(dense && { fontSize: "0.7rem", letterSpacing: "0.1em" }),
              }}
            >
              {stat.label}
            </Typography>
            <Box
              component="dd"
              sx={{ m: 0, display: "flex", alignItems: "center", gap: 0.625, minWidth: 0 }}
            >
              {Icon ? (
                <Icon
                  aria-hidden
                  sx={{ fontSize: dense ? 15 : 17, color: hasValue ? tokens.brass : "#B9C4D2", flexShrink: 0 }}
                />
              ) : null}
              <Typography
                component="span"
                sx={{
                  fontFamily: mono,
                  fontVariantNumeric: "tabular-nums",
                  // Two label-and-figure pairs per row leaves about 90px for the
                  // figure on a card, and "Tue 18:00" needs most of it.
                  fontSize: dense ? "0.92rem" : "1.075rem",
                  fontWeight: 500,
                  color: hasValue ? tokens.ink : tokens.inkMuted,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {hasValue ? stat.value : "—"}
              </Typography>

              {linked ? (
                <NextLink href={stat.href!} style={{ textDecoration: "none" }}>
                  <Typography
                    component="span"
                    sx={{
                      fontFamily: mono, fontSize: "0.78rem", fontWeight: 600,
                      color: tokens.brand, whiteSpace: "nowrap",
                      textDecoration: "underline", textUnderlineOffset: 3,
                      "&:hover": { color: tokens.brandDeep },
                    }}
                  >
                    {stat.linkLabel ?? "Open"}
                  </Typography>
                </NextLink>
              ) : null}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
