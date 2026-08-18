import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { SvgIconComponent } from "@mui/icons-material";
import { mono, tokens } from "@/lib/tokens";

export type Stat = {
  label: string;
  value: string | number | null | undefined;
  icon?: SvgIconComponent;
  note?: string;
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
 */
export default function StatLine({ stats, columns = 4 }: { stats: Stat[]; columns?: 2 | 4 }) {
  return (
    <Box
      component="dl"
      sx={{
        m: 0,
        display: "grid",
        // Breakpoints track the viewport, not the card, so four columns inside a
        // 330px card clipped "Tue 18:00" to "Tue …". Callers set this instead.
        gridTemplateColumns: `repeat(${Math.min(stats.length, columns)}, minmax(0, 1fr))`,
        gap: { xs: 1.5, sm: 2 },
        borderTop: `1px solid ${tokens.rule}`,
        borderBottom: `1px solid ${tokens.rule}`,
        py: 1.25,
      }}
    >
      {stats.map((stat) => {
        const hasValue = stat.value !== null && stat.value !== undefined && stat.value !== "";
        const Icon = stat.icon;
        return (
          <Box key={stat.label} sx={{ minWidth: 0 }}>
            <Typography component="dt" variant="overline" sx={{ color: "text.secondary", display: "block" }}>
              {stat.label}
            </Typography>
            <Box
              component="dd"
              sx={{ m: 0, display: "flex", alignItems: "center", gap: 0.625, minWidth: 0 }}
            >
              {Icon ? (
                <Icon
                  aria-hidden
                  sx={{ fontSize: 17, color: hasValue ? tokens.brass : "#B9C4D2", flexShrink: 0 }}
                />
              ) : null}
              <Typography
                component="span"
                sx={{
                  fontFamily: mono,
                  fontVariantNumeric: "tabular-nums",
                  fontSize: "1.075rem",
                  fontWeight: 500,
                  color: hasValue ? tokens.ink : tokens.inkMuted,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {hasValue ? stat.value : "—"}
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
