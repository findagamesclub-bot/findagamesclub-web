import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { mono, tokens } from "@/lib/tokens";

export type Stat = {
  label: string;
  value: string | number | null | undefined;
  note?: string;
};

/**
 * Key facts as a datasheet stat line — the format this audience already reads.
 * Missing values render a dash rather than collapsing, so columns stay aligned
 * across cards and a gap reads as "not stated" instead of zero.
 */
export default function StatLine({ stats }: { stats: Stat[] }) {
  return (
    <Box
      component="dl"
      sx={{
        m: 0,
        display: "grid",
        gridTemplateColumns: {
          xs: "repeat(2, minmax(0, 1fr))",
          sm: `repeat(${Math.min(stats.length, 4)}, minmax(0, 1fr))`,
        },
        gap: { xs: 1.5, sm: 2 },
        borderTop: `1px solid ${tokens.rule}`,
        borderBottom: `1px solid ${tokens.rule}`,
        py: 1.25,
      }}
    >
      {stats.map((stat) => {
        const hasValue = stat.value !== null && stat.value !== undefined && stat.value !== "";
        return (
          <Box key={stat.label} sx={{ minWidth: 0 }}>
            <Typography component="dt" variant="overline" sx={{ color: "text.secondary", display: "block" }}>
              {stat.label}
            </Typography>
            <Typography
              component="dd"
              sx={{
                m: 0,
                fontFamily: mono,
                fontVariantNumeric: "tabular-nums",
                fontSize: "0.95rem",
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
        );
      })}
    </Box>
  );
}
